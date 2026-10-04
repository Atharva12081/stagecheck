import { describe, expect, it } from "vitest";
import { decide } from "../src/tastediff/verdict.js";

describe("verdicts", () => {
  it("PASS when chosen is best", () => {
    const o = decide({ state: "ok", ranked: [{ name: "A", affinity: 0.8 }, { name: "B", affinity: 0.5 }], chosenName: "A", ambiguous: false, methodValid: true });
    expect(o.verdict).toBe("PASS");
    expect(o.gap).toBeCloseTo(0);
  });
  it("FAIL on genuine contradiction", () => {
    const o = decide({ state: "ok", ranked: [{ name: "A", affinity: 0.8 }, { name: "B", affinity: 0.4 }], chosenName: "B", ambiguous: false, methodValid: true });
    expect(o.verdict).toBe("FAIL");
    expect(o.gap).toBeCloseTo(0.4);
  });
  it("REVIEW in the middle band", () => {
    const o = decide({ state: "ok", ranked: [{ name: "A", affinity: 0.8 }, { name: "B", affinity: 0.7 }], chosenName: "B", ambiguous: false, methodValid: true });
    expect(o.verdict).toBe("REVIEW");
  });
  it("ABSTAIN on empty", () => {
    expect(decide({ state: "empty", ranked: [], chosenName: "A", ambiguous: false, methodValid: true }).verdict).toBe("ABSTAIN");
  });
  it("ABSTAIN on error/needs_input", () => {
    expect(decide({ state: "error", ranked: [], chosenName: "A", ambiguous: false, methodValid: true }).verdict).toBe("ABSTAIN");
    expect(decide({ state: "needs_input", ranked: [], chosenName: "A", ambiguous: false, methodValid: true }).verdict).toBe("ABSTAIN");
  });
  it("ABSTAIN on noise-level affinities", () => {
    expect(decide({ state: "ok", ranked: [{ name: "A", affinity: 0.01 }], chosenName: "A", ambiguous: false, methodValid: true }).verdict).toBe("ABSTAIN");
  });
  it("ABSTAIN on methodologically invalid comparisons", () => {
    expect(decide({ state: "ok", ranked: [{ name: "A", affinity: 0.9 }], chosenName: "A", ambiguous: false, methodValid: false }).verdict).toBe("ABSTAIN");
  });
  it("REVIEW on ambiguous resolution", () => {
    expect(decide({ state: "ok", ranked: [{ name: "A", affinity: 0.9 }], chosenName: "A", ambiguous: true, methodValid: true }).verdict).toBe("REVIEW");
  });
  it("thin evidence on degraded still fails a far trailer", () => {
    const o = decide({ state: "degraded", ranked: [{ name: "A", affinity: 0.9 }, { name: "B", affinity: 0.5 }], chosenName: "B", ambiguous: false, methodValid: true });
    expect(o.verdict).toBe("FAIL");
    expect(o.quality).toBe("thin");
  });
});
