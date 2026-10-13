import { AFFINITY_FLOOR, FAIL_GAP, MIN_EVIDENCE, PASS_GAP } from "../config.js";
import type { ResultState, Verdict } from "./types.js";

export interface VerdictInput {
  state: ResultState;
  ranked: { name: string; affinity: number }[];
  chosenName: string;
  ambiguous: boolean;
  methodValid: boolean;
}

/**
 * Deterministic verdicts. rank_gap = top_affinity − chosen_affinity (same-call scale only).
 * - PASS: chosen top (or within PASS_GAP) with >= MIN_EVIDENCE candidates.
 * - FAIL: chosen trails best by >= FAIL_GAP.
 * - REVIEW: middle ground / thin evidence / ambiguous resolution.
 * - ABSTAIN: empty/error/needs_input, noise-level affinities, invalid method, or unsupported.
 */
export function decide(v: VerdictInput): { verdict: Verdict; reason: string; gap: number; quality: "strong" | "thin" | "insufficient" } {
  if (v.state === "needs_input" || v.state === "error") {
    return { verdict: "ABSTAIN", reason: `Qloo ${v.state}: ${v.state === "needs_input" ? "valid signal/filter required" : "request failed"}. No verdict without evidence.`, gap: 0, quality: "insufficient" };
  }
  if (v.state === "empty") {
    return { verdict: "ABSTAIN", reason: "Qloo returned no entities; insufficient evidence for any verdict.", gap: 0, quality: "insufficient" };
  }
  if (!v.methodValid) {
    return { verdict: "ABSTAIN", reason: "Comparison would be methodologically invalid (cross-call scales). Abstaining.", gap: 0, quality: "insufficient" };
  }
  if (v.ranked.length === 0) {
    return { verdict: "ABSTAIN", reason: "No ranked candidates returned.", gap: 0, quality: "insufficient" };
  }
  const top = Math.max(...v.ranked.map((r) => r.affinity));
  const chosen = v.ranked.find((r) => r.name.toLowerCase() === v.chosenName.toLowerCase())?.affinity;
  if (chosen === undefined) {
    return { verdict: "REVIEW", reason: "Chosen option absent from ranked results; needs human review.", gap: top, quality: "thin" };
  }
  if (top < AFFINITY_FLOOR && chosen < AFFINITY_FLOOR) {
    return { verdict: "ABSTAIN", reason: "Affinities are noise-level; evidence too weak for a verdict.", gap: 0, quality: "insufficient" };
  }
  const gap = Math.round((top - chosen) * 1e4) / 1e4;
  const quality = v.ranked.length >= MIN_EVIDENCE && !v.ambiguous ? "strong" : v.ranked.length >= MIN_EVIDENCE ? "thin" : "insufficient";
  if (v.ambiguous) {
    return { verdict: "REVIEW", reason: `Entity resolution ambiguous; top affinity ≈${top.toFixed(2)} but identity uncertain.`, gap, quality: "thin" };
  }
  if (v.ranked.length < MIN_EVIDENCE) {
    return { verdict: "REVIEW", reason: `Only ${v.ranked.length} ranked candidate returned; at least ${MIN_EVIDENCE} are required for PASS or FAIL.`, gap, quality: "insufficient" };
  }
  if (v.state === "partial" || v.state === "degraded") {
    if (gap >= FAIL_GAP) return { verdict: "FAIL", reason: `Degraded evidence but chosen trails best by ≈${gap.toFixed(2)} (≥ ${FAIL_GAP}).`, gap, quality: "thin" };
    return { verdict: "REVIEW", reason: `Qloo result ${v.state}; evidence usable but flagged.`, gap, quality: "thin" };
  }
  if (gap <= PASS_GAP) return { verdict: "PASS", reason: `Chosen within ≈${gap.toFixed(2)} of best (≤ ${PASS_GAP}) on a shared scale.`, gap, quality };
  if (gap >= FAIL_GAP) return { verdict: "FAIL", reason: `Chosen trails best by ≈${gap.toFixed(2)} (≥ ${FAIL_GAP}). Contradiction found.`, gap, quality };
  return { verdict: "REVIEW", reason: `Gap ≈${gap.toFixed(2)} is inconclusive; human judgment needed.`, gap, quality };
}
