import { opRank, opRecommend, opResolve } from "../qloo/operations.js";
import { decide } from "./verdict.js";
import { entry } from "./ledger.js";
import type { DecisionContract } from "./types.js";

/**
 * Repair: only failed decisions with repairAllowed. Candidates come from Qloo
 * discovery anchored on a verified entity — never invented. Each replacement
 * is re-ranked jointly against the same context; only a PASS/REVIEW reverify
 * may enter the revised plan, else the decision stays unresolved.
 */
export async function repairAndReverify(d: DecisionContract): Promise<void> {
  if (d.verdict !== "FAIL" || !d.repairAllowed) return;
  const anchor = d.entities[0];
  if (!anchor) {
    d.replacementEvidence.push(entry("calculation", "repair", d.id, "No verified anchor entity; cannot discover alternatives.", null));
    return;
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
    const ranked = await opRank(d.kind, ids, d.market ? { "signal.location.query": d.market } : {});
    d.replacementEvidence.push(entry("qloo_output", "rank", d.id, `Reverification of ${alt.name}: state=${ranked.result.state}.`, ranked.result.data));
    const out = decide({
      state: ranked.result.state,
      ranked: ranked.candidates.map((c) => ({ name: c.name, affinity: c.affinity })),
      chosenName: alt.name,
      ambiguous: resolved.resolved[0]?.ambiguous ?? false,
      methodValid: true,
    });
    if (out.verdict === "PASS" || out.verdict === "REVIEW") {
      d.replacement = alt.name;
      d.reverify = out.verdict;
      d.replacementEvidence.push(entry("calculation", "repair", d.id, `Replacement ${alt.name} reverified: ${out.verdict} (rank_gap=${out.gap.toFixed(2)}).`, { rank_gap: out.gap }));
      return;
    }
  }
  d.replacementEvidence.push(entry("calculation", "repair", d.id, "No alternative reverified; original failure stands unresolved.", null));
}
