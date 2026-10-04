import { describe, expect, it } from "vitest";
import { allowedClaims, checkInterpretation, entry } from "../src/tastediff/ledger.js";
import type { DecisionContract } from "../src/tastediff/types.js";

function fakeDecision(): DecisionContract {
  return {
    id: "d1", kind: "artist", original: "Sample A", context: "", entities: [],
    candidates: [], op: "rank", opReason: "", questionClass: "best_of_candidates",
    evidence: [entry("qloo_output", "rank", "d1", "ok", { results: { entities: [{ name: "Sample A", affinity: 0.82 }] } })],
    derived: { rank_gap: 0 }, verdict: "PASS", verdictReason: "", evidenceQuality: "strong",
    repairAllowed: true, replacementEvidence: [],
  };
}

describe("evidence ledger enforcement", () => {
  it("allows ledger-joined names and derived numbers", () => {
    const allowed = allowedClaims([fakeDecision()]);
    expect(allowed.names.has("sample a")).toBe(true);
    expect(checkInterpretation("Solid pick overall.", allowed)).toEqual([]);
  });
  it("rejects smuggled numbers", () => {
    const allowed = allowedClaims([fakeDecision()]);
    expect(checkInterpretation("It scores 97.5 with fans.", allowed).length).toBeGreaterThan(0);
  });
  it("rejects unverified proper names", () => {
    const allowed = allowedClaims([fakeDecision()]);
    expect(checkInterpretation("Consider booking Taylor Swift instead.", allowed).length).toBeGreaterThan(0);
  });
});
