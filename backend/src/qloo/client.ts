import { QLOO_BASE, QLOO_KEY, QLOO_CACHE_MAX, QLOO_CACHE_TTL_MS, QLOO_MAX_RETRIES, QLOO_TIMEOUT_MS, SAMPLE_MODE } from "../config.js";
import type { ResultState } from "../tastediff/types.js";

export interface QlooResult<T> {
  state: ResultState;
  data: T | null;
  note: string;
  degraded?: boolean;
}

interface CacheEntry {
  exp: number;
  value: unknown;
}

const cache = new Map<string, CacheEntry>();
let callCount = 0;

export function resetQuota(): void {
  callCount = 0;
  cache.clear();
}
export function getCallCount(): number {
  return callCount;
}

function cacheGet(key: string): unknown | undefined {
  const e = cache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.exp) {
    cache.delete(key);
    return undefined;
  }
  return e.value;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= QLOO_CACHE_MAX) {
    const first = cache.keys().next();
    if (!first.done) cache.delete(first.value);
  }
  cache.set(key, { exp: Date.now() + QLOO_CACHE_TTL_MS, value });
}

async function get(path: string, params: Record<string, string>): Promise<QlooResult<unknown>> {
  const qs = new URLSearchParams(params).toString();
  const url = `${QLOO_BASE}${path}?${qs}`;
  const cached = cacheGet(url);
  if (cached !== undefined) return { state: "ok", data: cached, note: "cache" };

  if (!QLOO_KEY) {
    if (SAMPLE_MODE) {
      callCount++; // sample calls count against quota too, preserving budget realism
      return { state: "degraded", data: sampleFixture(path, params), note: "SAMPLE_MODE labeled fixture", degraded: true };
    }
    return { state: "error", data: null, note: "QLOO_API_KEY not configured" };
  }

  let lastErr = "";
  for (let attempt = 0; attempt <= QLOO_MAX_RETRIES; attempt++) {
    try {
      callCount++;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), QLOO_TIMEOUT_MS);
      const res = await fetch(url, { headers: { "X-Api-Key": QLOO_KEY }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `http ${res.status}`;
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 400 && /valid signal or filter/i.test(body)) {
          return { state: "needs_input", data: null, note: `Qloo rejected params: ${body.slice(0, 200)}` };
        }
        return { state: "error", data: null, note: `Qloo http ${res.status}: ${body.slice(0, 200)}` };
      }
      const json = (await res.json()) as Record<string, unknown>;
      const entities = (json["results"] as { entities?: unknown[] } | undefined)?.entities;
      if (Array.isArray(entities) && entities.length === 0) {
        return { state: "empty", data: json, note: "200 with empty entities" };
      }
      cacheSet(url, json);
      const degraded = Array.isArray(json["warnings"]) && (json["warnings"] as unknown[]).length > 0;
      const partial = json["success"] === false;
      return { state: partial ? "partial" : degraded ? "degraded" : "ok", data: json, note: degraded ? "warnings present" : "ok", degraded };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  return { state: "error", data: null, note: `unreachable after retries: ${lastErr}` };
}

export const qloo = {
  search: (query: string, typeUrn?: string) =>
    get("/search", typeUrn ? { query, types: typeUrn } : { query }),
  entity: (id: string) => get("/entities", { entity_ids: id }),
  insights: (params: Record<string, string>) => get("/v2/insights", params),
  compare: (params: Record<string, string>) => get("/v2/analysis/compare", params),
  trending: (params: Record<string, string>) => get("/v2/trending", params),
  tags: (query: string) => get("/v2/tags", { "filter.query": query }),
  audiences: () => get("/v2/audiences", {}),
  audienceTypes: () => get("/v2/audiences/types", {}),
};

/**
 * Generic labeled fixtures. These echo the request back with deterministic
 * placeholder values so the full loop (verdicts, repair, diff) is exercisable
 * without a key. They assert NO cultural claim about any real entity: names
 * are echoes of user input, affinities are a pure function of the id string.
 * NEVER presented as live Qloo output (mode flag enforced by orchestrator;
 * every fixture entity carries sample:true).
 */
function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return Math.round((0.3 + (h % 50) / 100) * 100) / 100; // [0.30, 0.79]
}

function sampleName(id: string): string {
  return id.replace(/^sample:/, "").replace(/:\d+$/, "") || id;
}

function sampleFixture(path: string, params: Record<string, string>): unknown {
  if (path === "/search") {
    const q = params["query"] ?? "unknown";
    return {
      results: [
        { id: `sample:${q.toLowerCase()}:1`, name: q, types: [params["types"] ?? "urn:entity:artist"], popularity: 0.5, sample: true },
      ],
    };
  }
  if (path === "/entities") {
    const id = params["entity_ids"] ?? "sample:unknown";
    return { success: true, sample: true, results: [{ id, name: sampleName(id), popularity: 0.5, sample: true }] };
  }
  if (path === "/v2/trending") {
    const vals = [62, 60, 58, 57, 55, 53, 51, 50, 48, 46, 44, 42];
    return {
      success: true,
      sample: true,
      results: {
        trending: vals.map((v, i) => ({
          date: `2026-${String((i % 12) + 1).padStart(2, "0")}-01`,
          population_percentile: v,
          population_rank_velocity: -1,
          sample: true,
        })),
      },
    };
  }
  if (path === "/v2/insights") {
    if ((params["filter.type"] ?? "") === "urn:heatmap") {
      const m = params["filter.location.query"] ?? "nowhere";
      const aff = hash01(`geo:${m.toLowerCase()}`);
      return {
        success: true,
        sample: true,
        results: {
          heatmap: [{ location: { latitude: 0, longitude: 0, geohash: "sample" }, query: { affinity: aff, sample: true } }],
        },
      };
    }
    if (params["signal.interests.entities"] && !params["filter.entities"]) {
      return {
        success: true,
        sample: true,
        results: {
          entities: [1, 2, 3].map((n) => ({
            entity_id: `sample:alt-${n}`,
            name: `Sample Alternative ${n}`,
            popularity: 0.5,
            query: { affinity: hash01(`sample:alt-${n}`), sample: true },
            sample: true,
          })),
        },
      };
    }
    const ids = (params["filter.entities"] ?? "sample:unknown").split(",");
    return {
      success: true,
      sample: true,
      results: {
        entities: ids.map((id) => ({
          entity_id: id,
          name: sampleName(id),
          popularity: 0.5,
          query: { affinity: hash01(id), sample: true },
          sample: true,
        })),
      },
    };
  }
  return { success: true, sample: true, results: { entities: [] } };
}
