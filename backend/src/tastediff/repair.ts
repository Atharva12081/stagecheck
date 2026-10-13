import { opRank, opRecommend, opResolve } from "../qloo/operations.js";
import { decide } from "./verdict.js";
import { entry } from "./ledger.js";
import type { DecisionContract } from "./types.js";

/** Id of the max-affinity entity in a stored rank payload (fresh evidence only). */
function topAffId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const r = (payload as Record<string, unknown>)["results"] as Record<string, unknown> | undefined;
  const ents = r?.["entities"];
  if (!Array.isArray(ents)) return null;
  let best: string | null = null;
  let bestAff = -Infinity;
  for (const e of ents as Record<string, unknown>[]) {
    const q = e["query"] as Record<string, unknown> | undefined;
    const a = q && typeof q["affinity"] === "number" ? (q["affinity"] as number) : typeof e["affinity"] === "number" ? (e["affinity"] as number) : -1;
    const id = typeof (e["entity_id"] ?? e["id"]) === "string" ? (e["entity_id"] ?? e["id"]) as string : null;
    if (id && a > bestAff) {
      bestAff = a;
      best = id;
    }
  }
  return best;
}

/**
 * Repair: only failed decisions with repairAllowed. Candidates come from Qloo
 * discovery anchored on a verified entity — never invented. Each replacement
 * is re-ranked jointly against the same context; only a PASS reverify may
 * enter the revised plan, else the decision stays unresolved.
 */
export async function repairAndReverify(d: DecisionContract, siblings: Map<string, string> = new Map()): Promise<void> {
  // Only rank failures are repairable: candidate substitution is the one
  // intervention that can itself be jointly reverified. Trend/audience
  // failures stay unresolved rather than force a fix.
  if (d.verdict !== "FAIL" || !d.repairAllowed || d.op !== "rank") return;
  const anchor = d.entities[0];
  if (!anchor) {
    d.replacementEvidence.push(entry("calculation", "repair", d.id, "No verified anchor entity; cannot discover alternatives.", null));
    return;
  }
  // Same shared signal as the original ranking, so the reverify scale matches.
  const signalIds = [...siblings.values()].filter((id) => id !== anchor.id).slice(0, 3);
  if (signalIds.length === 0) {
    d.replacementEvidence.push(entry("calculation", "repair", d.id, "No shared plan-context signal for reverification; left unresolved.", null));
    return;
  }
  const extra = d.market ? { "filter.location.query": d.market, "filter.location.radius": "0" } : undefined;

  // First: reproducibility check. Re-run the joint ranking fresh; if the
  // original winner reproduces on top, adopt it — the repeat call is new
  // evidence, not reuse, and it doubles as a stability gate.
  const rankEv = d.evidence.find((e) => e.op === "rank" && e.kind === "qloo_output");
  const winner = topAffId(rankEv?.payload);
  if (winner && winner !== anchor.id) {
    const re = await opRank(d.kind, [anchor.id, winner], signalIds, extra, true);
    d.replacementEvidence.push(entry("qloo_output", "rank", d.id, `Reproducibility re-rank state=${re.result.state}.`, re.result.data));
    const wname = re.candidates.find((c) => c.id === winner)?.name ?? "candidate";
    const out = decide({
      state: re.result.state,
      ranked: re.candidates.map((c) => ({ name: c.name, affinity: c.affinity })),
      chosenName: wname,
      ambiguous: false,
      methodValid: true,
    });
    if (out.verdict === "PASS") {
      d.replacement = wname;
      d.reverify = out.verdict;
      d.replacementEvidence.push(entry("calculation", "repair", d.id, `Winner ${wname} reproduced on fresh evidence: ${out.verdict} (gap ${out.gap.toFixed(2)}).`, { rank_gap: out.gap }));
      return;
    }
    d.replacementEvidence.push(entry("calculation", "repair", d.id, `Winner did not reproduce cleanly (${out.verdict}); trying discovery.`, null));
  }
  const discovered = await opRecommend(d.kind, anchor.id, 8);
  d.replacementEvidence.push(entry("qloo_output", "recommend", d.id, `Discovery call state=${discovered.result.state}.`, discovered.result.data));
  const pool = discovered.candidates.filter((c) => c.id !== anchor.id).slice(0, 4);
  if (pool.length === 0 || discovered.result.state === "empty" || discovered.result.state === "error") {
    d.replacementEvidence.push(entry("calculation", "repair", d.id, "Discovery yielded no usable alternatives; left unresolved.", null));
    return;
  }
  for (const alt of pool) {
    const resolved = await opResolve(alt.name, d.kind);
    const altId = resolved.resolved[0]?.id ?? alt.id;
    const ids = [anchor.id, altId];
    const ranked = await opRank(d.kind, ids, signalIds, extra, true);
    d.replacementEvidence.push(entry("qloo_output", "rank", d.id, `Reverification of ${alt.name}: state=${ranked.result.state}.`, ranked.result.data));
    const out = decide({
      state: ranked.result.state,
      ranked: ranked.candidates.map((c) => ({ name: c.name, affinity: c.affinity })),
      chosenName: alt.name,
      ambiguous: resolved.resolved[0]?.ambiguous ?? false,
      methodValid: true,
    });
    if (out.verdict === "PASS") {
      d.replacement = alt.name;
      d.reverify = out.verdict;
      d.replacementEvidence.push(entry("calculation", "repair", d.id, `Replacement ${alt.name} reverified: ${out.verdict} (rank_gap=${out.gap.toFixed(2)}).`, { rank_gap: out.gap }));
      return;
    }
  }
  d.replacementEvidence.push(entry("calculation", "repair", d.id, "No alternative reverified; original failure stands unresolved.", null));
}
