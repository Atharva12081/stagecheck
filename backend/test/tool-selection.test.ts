import { describe, expect, it } from "vitest";
import { classify, selectOp } from "../src/tastediff/planner.js";

describe("tool selection", () => {
  it("maps best-of questions to rank", () => {
    expect(selectOp("best_of_candidates")?.op).toBe("rank");
  });
  it("maps geographic questions to where_popular", () => {
    expect(selectOp("geographic_strength")?.op).toBe("where_popular");
  });
  it("maps momentum to trends", () => {
    expect(selectOp("momentum")?.op).toBe("trends");
  });
  it("maps discovery to recommend", () => {
    expect(selectOp("replacement_discovery")?.op).toBe("recommend");
  });
  it("maps audience differences to compare_audiences", () => {
    expect(selectOp("audience_difference")?.op).toBe("compare_audiences");
  });
  it("maps characterization to entity_tags", () => {
    expect(selectOp("characterization")?.op).toBe("entity_tags");
  });
  it("returns null for unsupported (model knows when no tool applies)", () => {
    expect(selectOp("unsupported")).toBeNull();
  });
  it("classifies unknown questions as unsupported", () => {
    expect(classify({ kind: "artist", name: "Xyz" }, false, false)).toBe("unsupported");
  });
  it("classifies alternatives as best_of_candidates", () => {
    expect(classify({ kind: "brand", name: "Pick sponsor", alternatives: ["A", "B"] }, false, true)).toBe("best_of_candidates");
  });
});
