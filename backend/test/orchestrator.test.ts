import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.QLOO_API_KEY = "test-key";

function stubFetch(handler: (url: string) => unknown): void {
  vi.stubGlobal("fetch", async (url: unknown) => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(handler(String(url))),
    json: async () => handler(String(url)),
  }));
}

describe("orchestrator loop (stubbed Qloo)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds a contradiction, repairs, and reverifies", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    stubFetch((url: string) => {
      if (url.includes("/search")) {
        const q = new URL(url).searchParams.get("query") ?? "X";
        const types = new URL(url).searchParams.get("types") ?? "urn:entity:artist";
        return { results: [{ entity_id: `id-${q}`, name: q, types: [types] }] };
      }
      if (url.includes("/v2/insights")) {
        const u = new URL(url);
        const ids = (u.searchParams.get("filter.results.entities") ?? "").split(",").filter(Boolean);
        // First candidate (chosen) weak, alternatives strong -> FAIL then repair PASS.
        const entities = ids.map((id, i) => ({
          entity_id: id,
          name: id.replace("id-", ""),
          popularity: 0.5,
          query: { affinity: i === 0 ? 0.3 : 0.85 },
        }));
        if (u.searchParams.get("signal.interests.entities") && ids.length === 0) {
          return { success: true, results: { entities: [{ entity_id: "id-Alt", name: "Alt", popularity: 0.6, query: { affinity: 0.85 } }] } };
        }
        return { success: true, results: { entities } };
      }
      return { success: true, results: { entities: [] } };
    });
    const report = await verifyPlan({
      title: "Tour",
      markets: ["Austin"],
      items: [
        { kind: "artist", name: "Weak Act", context: "choose between openers", alternatives: ["Strong Act"] },
        { kind: "artist", name: "Headliner", context: "headliner for the tour" },
      ],
    });
    expect(report.mode).toBe("live");
    const d = report.decisions[0]!;
    expect(d.verdict).toBe("FAIL");
    expect(d.derived["rank_gap"]).toBeGreaterThan(0.15);
    expect(d.replacement).toBeTruthy();
    expect(d.reverify).toMatch(/PASS|REVIEW/);
    expect(report.revisedPlan[0]!.choice).toBe(d.replacement);
  });

  it("abstains on unknown entities and unsupported questions", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    stubFetch((url: string) => {
      if (url.includes("/search")) return { results: [] };
      return { success: true, results: { entities: [] } };
    });
    const report = await verifyPlan({
      items: [
        { kind: "artist", name: "Nonexistent Xyz Act" },
        { kind: "place", name: "Mystery Venue" },
      ],
    });
    for (const d of report.decisions) expect(d.verdict).toBe("ABSTAIN");
    expect(report.unresolved).toEqual([]);
  });

  it("handles API errors without inventing verdicts", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 500, text: async () => "boom", json: async () => ({}) }));
    const report = await verifyPlan({ items: [{ kind: "artist", name: "Anyone" }] });
    expect(report.decisions[0]!.verdict).toBe("ABSTAIN");
  });
});
