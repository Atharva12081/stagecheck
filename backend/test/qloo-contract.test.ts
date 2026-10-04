import { describe, expect, it, vi, beforeEach } from "vitest";

process.env.QLOO_API_KEY = "contract-key";

const seen: string[] = [];

function stub(handler: (url: string) => unknown): void {
  seen.length = 0;
  vi.stubGlobal("fetch", async (url: unknown) => {
    seen.push(String(url));
    const data = handler(String(url));
    return { ok: true, status: 200, text: async () => JSON.stringify(data), json: async () => data };
  });
}

describe("qloo api contract (verified against official OpenAPI 2026-10-05)", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolve uses /search with URN types", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { opResolve } = await import("../src/qloo/operations.js");
    resetQuota();
    stub(() => ({ results: [{ id: "id-1", name: "X" }] }));
    await opResolve("X", "artist");
    expect(seen[0]).toContain("/search?");
    expect(seen[0]).toContain("types=urn%3Aentity%3Aartist");
  });

  it("describe uses /entities?entity_ids=", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { opDescribe } = await import("../src/qloo/operations.js");
    resetQuota();
    stub(() => ({ results: [{ id: "id-1", name: "X" }] }));
    await opDescribe("id-1");
    expect(seen[0]).toContain("/entities?");
    expect(seen[0]).toContain("entity_ids=id-1");
  });

  it("trends uses /v2/trending with type + date window + signal", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { opTrends } = await import("../src/qloo/operations.js");
    resetQuota();
    stub(() => ({ success: true, results: { trending: [70, 60, 50].map((v) => ({ population_percentile: v })) } }));
    const t = await opTrends("artist", "id-1", 12);
    expect(seen[0]).toContain("/v2/trending?");
    expect(seen[0]).toContain("filter.type=urn%3Aentity%3Aartist");
    expect(seen[0]).toContain("signal.interests.entities=id-1");
    expect(seen[0]).toContain("filter.start_date=");
    expect(seen[0]).toContain("filter.end_date=");
    expect(t.points).toBe(3);
    expect(t.slope).toBeLessThan(0);
  });

  it("tags uses /v2/tags?filter.query=", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { opTags } = await import("../src/qloo/operations.js");
    resetQuota();
    stub(() => ({ results: [] }));
    await opTags("folk");
    expect(seen[0]).toContain("/v2/tags?");
    expect(seen[0]).toContain("filter.query=folk");
  });

  it("rank issues a single joint insights call", async () => {
    const { resetQuota } = await import("../src/qloo/client.js");
    const { opRank } = await import("../src/qloo/operations.js");
    resetQuota();
    stub(() => ({ success: true, results: { entities: [] } }));
    await opRank("brand", ["a", "b"], {});
    expect(seen.filter((u) => u.includes("/v2/insights"))).toHaveLength(1);
    expect(seen[0]).toContain("filter.results.entities=a%2Cb");
  });
});
