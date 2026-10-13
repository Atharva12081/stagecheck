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
    expect(d.reverify).toBe("PASS");
    expect(report.revisedPlan[0]!.choice).toBe(d.replacement);
  });

  it("reverifies the known winner before discovery and survives discovery failure", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    let discoveryCalls = 0;
    stubFetch((url: string) => {
      const u = new URL(url);
      if (url.includes("/search")) {
        const q = u.searchParams.get("query") ?? "X";
        const types = u.searchParams.get("types") ?? "urn:entity:artist";
        return { results: [{ entity_id: `id-${q}`, name: q, types: [types] }] };
      }
      if (url.includes("/v2/insights")) {
        const ids = (u.searchParams.get("filter.results.entities") ?? "").split(",").filter(Boolean);
        if (ids.length === 0) {
          discoveryCalls++;
          return { success: false, results: { entities: [] } };
        }
        return { success: true, results: { entities: ids.map((id, i) => ({ entity_id: id, name: id.replace("id-", ""), query: { affinity: i === 0 ? 0.3 : 0.85 } })) } };
      }
      return { success: true, results: { entities: [] } };
    });
    const report = await verifyPlan({ items: [
      { kind: "brand", name: "Weak", context: "choose between sponsors", alternatives: ["Winner"] },
      { kind: "artist", name: "Signal", context: "Is this artist gaining momentum?" },
    ] });
    expect(report.decisions[0]?.replacement).toBe("Winner");
    expect(report.decisions[0]?.reverify).toBe("PASS");
    expect(discoveryCalls).toBe(0);
  });

  it("keeps REVIEW-only alternatives out of the revised plan", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    let rankCalls = 0;
    stubFetch((url: string) => {
      const u = new URL(url);
      if (url.includes("/search")) {
        const q = u.searchParams.get("query") ?? "X";
        const types = u.searchParams.get("types") ?? "urn:entity:artist";
        return { results: [{ entity_id: `id-${q}`, name: q, types: [types] }] };
      }
      if (url.includes("/v2/insights")) {
        const ids = (u.searchParams.get("filter.results.entities") ?? "").split(",").filter(Boolean);
        if (ids.length === 0) return { success: true, results: { entities: [{ entity_id: "id-Discovered", name: "Discovered", query: { affinity: 0.8 } }] } };
        rankCalls++;
        const affinities = rankCalls === 1 ? [0.3, 0.85] : [0.8, 0.7];
        return { success: true, results: { entities: ids.map((id, i) => ({ entity_id: id, name: id.replace("id-", ""), query: { affinity: affinities[i] ?? 0.7 } })) } };
      }
      return { success: true, results: { entities: [] } };
    });
    const report = await verifyPlan({ items: [
      { kind: "brand", name: "Original", context: "choose between sponsors", alternatives: ["Winner"] },
      { kind: "artist", name: "Signal", context: "Is this artist gaining momentum?" },
    ] });
    expect(report.decisions[0]?.verdict).toBe("FAIL");
    expect(report.decisions[0]?.replacement).toBeUndefined();
    expect(report.revisedPlan[0]?.choice).toBe("Original");
    expect(report.unresolved).toContain("Original");
  });

  it("isolates quota and evidence IDs across concurrent verifications", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { verifyPlan } = await import("../src/tastediff/orchestrator.js");
    resetQuota();
    vi.stubGlobal("fetch", async (input: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 2));
      const url = String(input);
      const u = new URL(url);
      if (url.includes("/search")) {
        const q = u.searchParams.get("query") ?? "X";
        const types = u.searchParams.get("types") ?? "urn:entity:artist";
        return { ok: true, status: 200, text: async () => "", json: async () => ({ results: [{ entity_id: `id-${q}`, name: q, types: [types] }] }) };
      }
      const ids = (u.searchParams.get("filter.results.entities") ?? "").split(",").filter(Boolean);
      return { ok: true, status: 200, text: async () => "", json: async () => ({ success: true, results: { entities: ids.map((id, i) => ({ entity_id: id, name: id.replace("id-", ""), query: { affinity: i === 0 ? 0.8 : 0.6 } })) } }) };
    });
    const make = (prefix: string) => verifyPlan({ items: [
      { kind: "brand", name: `${prefix} Choice`, context: "choose between sponsors", alternatives: [`${prefix} Alt`] },
      { kind: "artist", name: `${prefix} Signal`, context: "Is this artist gaining momentum?" },
    ] });
    const [a, b] = await Promise.all([make("A"), make("B")]);
    expect(a.qlooCalls).toBe(5);
    expect(b.qlooCalls).toBe(5);
    expect(a.decisions[0]?.id).toBe("d1");
    expect(b.decisions[0]?.id).toBe("d1");
    expect(a.decisions[0]?.evidence[0]?.id).toBe("e1");
    expect(b.decisions[0]?.evidence[0]?.id).toBe("e1");
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
