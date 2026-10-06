import { MAX_CALLS_PER_VERIFY, MIN_GEO_SPREAD, QLOO_KEY, SAMPLE_MODE } from "../config.js";
import { getCallCount } from "../qloo/client.js";
import { opCompare, opDescribe, opRank, opRecommend, opResolve, opTags, opTrends, opWherePopular, opAudiences } from "../qloo/operations.js";
import { decompose, type PlanItem } from "./planner.js";
import { decide } from "./verdict.js";
import { allowedClaims, checkInterpretation, entry } from "./ledger.js";
import { repairAndReverify } from "./repair.js";
import type { DecisionContract, EvidenceEntry, VerifiedReport } from "./types.js";

export interface PlanInput {
  title?: string;
  markets?: string[];
  items: PlanItem[];
  interpretation?: string;
}

function push(d: DecisionContract, e: EvidenceEntry): void {
  d.evidence.push(e);
}

async function evaluate(d: DecisionContract, markets: string[], siblings: Map<string, string>): Promise<void> {
  push(d, entry("user_input", "plan", d.id, `Plan choice "${d.original}" (${d.kind})${d.market ? ` in ${d.market}` : ""}.`, { choice: d.original }));

  if (d.questionClass === "unsupported") {
    d.verdict = "ABSTAIN";
    d.verdictReason = "No Qloo operation can answer this question. Abstaining rather than guessing.";
    d.evidenceQuality = "insufficient";
    push(d, entry("calculation", "verdict", d.id, d.verdictReason, null));
    return;
  }

  // Anchors are resolved in verifyPlan's pre-pass (d.entities). An empty list
  // means unknown entity or kind/type mismatch — both abstain.
  const anchor = d.entities[0];
  if (!anchor) {
    d.verdict = "ABSTAIN";
    d.verdictReason = "Entity not found in Qloo, or no kind-matching entity found; unknown entities are abstained, never invented.";
    d.evidenceQuality = "insufficient";
    push(d, entry("calculation", "verdict", d.id, d.verdictReason, null));
    return;
  }
  const ambiguous = anchor.ambiguous;

  switch (d.op) {
    case "rank": {
      // Shared signal = the rest of the plan (sibling anchors). Affinity is
      // signal-scoped, so candidates are scored by fit with plan context.
      const signalIds = [...siblings.values()].filter((id) => id !== anchor.id).slice(0, 3);
      if (signalIds.length === 0) {
        d.verdict = "ABSTAIN";
        d.verdictReason = "No other plan decisions resolved to anchor a joint ranking; abstaining rather than scoring without a shared scale.";
        d.evidenceQuality = "insufficient";
        push(d, entry("calculation", "verdict", d.id, d.verdictReason, null));
        break;
      }
      const candIds = new Map<string, string>();
      candIds.set(anchor.id, anchor.name);
      for (const c of d.candidates.slice(0, 4)) {
        const rr = await opResolve(c, d.kind);
        push(d, entry("qloo_output", "resolve", d.id, `Candidate "${c}" state=${rr.result.state}.`, rr.result.data));
        if (rr.resolved[0] && rr.typeMatched) candIds.set(rr.resolved[0].id, rr.resolved[0].name);
      }
      const ranked = await opRank(
        d.kind,
        [...candIds.keys()],
        signalIds,
        d.market ? { "filter.location.query": d.market, "filter.location.radius": "0" } : undefined,
      );
      push(d, entry("qloo_output", "rank", d.id, `Joint ranking state=${ranked.result.state}, n=${ranked.candidates.length}.`, ranked.result.data));
      const out = decide({
        state: ranked.result.state,
        ranked: ranked.candidates.map((c) => ({ name: c.name, affinity: c.affinity })),
        chosenName: anchor.name,
        ambiguous,
        methodValid: true,
      });
      d.verdict = out.verdict;
      d.verdictReason = out.reason;
      d.evidenceQuality = out.quality;
      d.derived = { rank_gap: out.gap };
      push(d, entry("calculation", "verdict", d.id, `${out.verdict}: ${out.reason}`, { rank_gap: out.gap }));
      break;
    }
    case "where_popular": {
      const ms = markets.length > 0 ? markets : d.market ? [d.market] : [];
      if (ms.length < 2) {
        d.verdict = "ABSTAIN";
        d.verdictReason = "Geographic verdicts need at least two markets to order; single-market affinity has no comparison basis.";
        d.evidenceQuality = "insufficient";
        push(d, entry("calculation", "verdict", d.id, d.verdictReason, null));
        break;
      }
      const geo = await opWherePopular(d.kind, anchor.id, ms);
      push(d, entry("qloo_output", "where_popular", d.id, `Markets: ${geo.byMarket.map((m) => `${m.market}=${m.affinity.toFixed(2)}`).join(", ")}.`, geo.byMarket));
      const order = [...geo.byMarket].sort((a, b) => b.affinity - a.affinity);
      const chosenRank = order.findIndex((m) => m.market === d.market);
      const spread = order.length > 0 ? Math.round(((order[0]!.affinity - order[order.length - 1]!.affinity)) * 1e4) / 1e4 : 0;
      if (geo.result.state === "error" || geo.result.state === "empty") {
        d.verdict = "ABSTAIN";
        d.verdictReason = `Geographic evidence unavailable (${geo.result.note}).`;
        d.evidenceQuality = "insufficient";
      } else if (spread < MIN_GEO_SPREAD) {
        d.verdict = "REVIEW";
        d.verdictReason = `Markets effectively tied (spread ${spread.toFixed(3)} < ${MIN_GEO_SPREAD}); no meaningful geographic signal.`;
        d.evidenceQuality = "thin";
      } else if (chosenRank <= 0) {
        d.verdict = "PASS";
        d.verdictReason = `${d.market} ranks #1 of ${order.length} markets by affinity order.`;
        d.evidenceQuality = ambiguous ? "thin" : "strong";
      } else if (chosenRank === order.length - 1 && order.length >= 3) {
        d.verdict = "FAIL";
        d.verdictReason = `${d.market} ranks last of ${order.length} markets; stronger markets exist in-plan.`;
        d.evidenceQuality = "strong";
      } else {
        d.verdict = "REVIEW";
        d.verdictReason = `${d.market} ranks #${chosenRank + 1} of ${order.length}; inconclusive.`;
        d.evidenceQuality = "thin";
      }
      push(d, entry("calculation", "verdict", d.id, `${d.verdict}: ${d.verdictReason}`, null));
      break;
    }
    case "trends": {
      const t = await opTrends(d.kind, anchor.id);
      push(d, entry("qloo_output", "trends", d.id, `Trend state=${t.result.state}, points=${t.points}, slope=${t.slope.toFixed(3)}.`, t.result.data));
      if (t.result.state === "error" || t.result.state === "empty" || t.points < 3) {
        d.verdict = "ABSTAIN";
        d.verdictReason = "Insufficient trend history for a momentum verdict.";
        d.evidenceQuality = "insufficient";
      } else if (t.slope < -0.05) {
        d.verdict = "FAIL";
        d.verdictReason = `Momentum declining (slope ${t.slope.toFixed(3)}); plan assumes strength.`;
        d.evidenceQuality = "strong";
      } else if (t.slope > 0.05) {
        d.verdict = "PASS";
        d.verdictReason = `Momentum rising (slope ${t.slope.toFixed(3)}).`;
        d.evidenceQuality = "strong";
      } else {
        d.verdict = "REVIEW";
        d.verdictReason = `Trend flat (slope ${t.slope.toFixed(3)}); no clear signal.`;
        d.evidenceQuality = "thin";
      }
      d.derived = { slope: t.slope };
      break;
    }
    case "compare_audiences": {
      const others = d.candidates.slice(0, 2);
      const otherIds: string[] = [];
      for (const c of others) {
        const rr = await opResolve(c, d.kind);
        if (rr.resolved[0] && rr.typeMatched) otherIds.push(rr.resolved[0].id);
      }
      if (otherIds.length === 0) {
        d.verdict = "ABSTAIN";
        d.verdictReason = "Audience comparison needs two resolvable groups; abstaining.";
        d.evidenceQuality = "insufficient";
        break;
      }
      const cmp = await opCompare([anchor.id], otherIds);
      push(d, entry("qloo_output", "compare_audiences", d.id, `Compare state=${cmp.state}.`, cmp.data));
      d.verdict = cmp.state === "ok" || cmp.state === "partial" ? "REVIEW" : "ABSTAIN";
      d.verdictReason = cmp.state === "ok" || cmp.state === "partial" ? "Audience differences returned; interpretation needs human review." : `Compare unavailable (${cmp.note}).`;
      d.evidenceQuality = d.verdict === "REVIEW" ? "thin" : "insufficient";
      break;
    }
    case "entity_tags":
    case "describe": {
      const [desc, tags] = await Promise.all([opDescribe(anchor.id), opTags(anchor.name)]);
      push(d, entry("qloo_output", d.op === "describe" ? "describe" : "entity_tags", d.id, `Describe=${desc.state}, tags=${tags.state}.`, { describe: desc.data, tags: tags.data }));
      d.verdict = desc.state === "ok" || tags.state === "ok" ? "REVIEW" : "ABSTAIN";
      d.verdictReason = d.verdict === "REVIEW" ? "Characterization evidence returned; descriptive only, no pass/fail implied." : "No characterization evidence available.";
      d.evidenceQuality = d.verdict === "REVIEW" ? "thin" : "insufficient";
      break;
    }
    case "recommend": {
      const rec = await opRecommend(d.kind, anchor.id, 8);
      push(d, entry("qloo_output", "recommend", d.id, `Discovery state=${rec.result.state}, n=${rec.candidates.length}.`, rec.result.data));
      d.verdict = rec.result.state === "ok" ? "REVIEW" : "ABSTAIN";
      d.verdictReason = rec.result.state === "ok" ? "Alternatives discovered; ranked reverification required before adoption." : `Discovery unavailable (${rec.result.note}).`;
      d.evidenceQuality = rec.result.state === "ok" ? "thin" : "insufficient";
      break;
    }
    case "audience_info":
    case "explain":
    case "resolve": {
      const aud = d.op === "audience_info" ? await opAudiences() : null;
      if (aud) push(d, entry("qloo_output", "audience_info", d.id, `Audiences=${aud.audiences.state}.`, aud.audiences.data));
      d.verdict = "REVIEW";
      d.verdictReason = "Contextual evidence only; no pass/fail implied.";
      d.evidenceQuality = "thin";
      break;
    }
  }
}

export async function verifyPlan(plan: PlanInput): Promise<VerifiedReport> {
  const t0 = Date.now();
  const markets = (plan.markets ?? []).slice(0, 6);
  const decisions = decompose(plan.items, markets);
  // Pre-pass: resolve every decision's anchor once, so rank evaluations can
  // score candidates against the rest of the plan (shared signal, one call).
  const anchors = new Map<string, string>();
  for (const d of decisions) {
    if (d.questionClass === "unsupported") continue;
    if (getCallCount() >= MAX_CALLS_PER_VERIFY) break;
    const r = await opResolve(d.original, d.kind);
    push(d, entry("qloo_output", "resolve", d.id, `Resolution state=${r.result.state}, hits=${r.resolved.length}.`, r.result.data));
    if (r.result.state !== "error" && r.result.state !== "needs_input" && r.resolved[0]) {
      d.entities = r.resolved;
      anchors.set(d.id, r.resolved[0].id);
    }
  }
  for (const d of decisions) {
    if (getCallCount() >= MAX_CALLS_PER_VERIFY && d.verdict === "ABSTAIN" && d.evidence.length === 0) {
      d.verdictReason = "Quota guard: Qloo call budget exhausted; abstaining safely.";
      continue;
    }
    await evaluate(d, markets, anchors);
    if (d.verdict === "FAIL" && getCallCount() < MAX_CALLS_PER_VERIFY) await repairAndReverify(d, anchors);
  }
  const revisedPlan = decisions.map((d) => ({
    kind: d.kind,
    choice: d.replacement && d.reverify ? d.replacement : d.original,
    verdict: (d.replacement && d.reverify ? d.reverify : d.verdict) as DecisionContract["verdict"],
  }));
  const unresolved = decisions.filter((d) => d.verdict === "FAIL" && !d.replacement).map((d) => d.original);
  const mode = SAMPLE_MODE ? "sample" : QLOO_KEY ? "live" : "unconfigured";
  const allowed = allowedClaims(decisions);
  const violations = checkInterpretation(plan.interpretation ?? "", allowed);
  const interpretation = violations.length > 0 ? "" : (plan.interpretation ?? "");
  return {
    title: plan.title ?? "Untitled plan",
    mode,
    decisions,
    revisedPlan,
    unresolved,
    qlooCalls: getCallCount(),
    latencyMs: Date.now() - t0,
    interpretation,
  };
}
