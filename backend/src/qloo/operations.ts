import { qloo, type QlooResult } from "./client.js";
import type { DecisionKind, QlooOp, ResolvedEntity } from "../tastediff/types.js";

export const FILTER_TYPE: Record<DecisionKind, string> = {
  artist: "urn:entity:artist",
  brand: "urn:entity:brand",
  place: "urn:entity:place",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
  destination: "urn:entity:destination",
};

/** /search `types` takes filter-type URNs (verified against official OpenAPI). */
const SEARCH_TYPE: Record<DecisionKind, string> = {
  artist: "urn:entity:artist",
  brand: "urn:entity:brand",
  place: "urn:entity:place",
  movie: "urn:entity:movie",
  tv_show: "urn:entity:tv_show",
  destination: "urn:entity:destination",
};

export interface RankedCandidate {
  id: string;
  name: string;
  affinity: number;
  popularity?: number;
  explain?: unknown;
}

export interface RankOutcome {
  result: QlooResult<unknown>;
  candidates: RankedCandidate[];
}

function asEntities(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== "object") return [];
  const r = (data as Record<string, unknown>)["results"] as Record<string, unknown> | unknown[] | undefined;
  if (Array.isArray(r)) return r as Record<string, unknown>[]; // /search shape: { results: [...] }
  const e = r?.["entities"];
  return Array.isArray(e) ? (e as Record<string, unknown>[]) : [];
}

function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

/** resolve: entity resolution with ambiguity detection. */
export async function opResolve(query: string, kind: DecisionKind): Promise<{ result: QlooResult<unknown>; resolved: ResolvedEntity[]; typeMatched: boolean }> {
  const result = await qloo.search(query, SEARCH_TYPE[kind]);
  const hits = result.state === "ok" || result.state === "degraded" || result.state === "partial" ? asEntities(result.data) : [];
  const expected = FILTER_TYPE[kind];
  const matched = hits.filter((h) => {
    const t = h["types"];
    return Array.isArray(t) ? (t as unknown[]).includes(expected) : str(h["type"]) === expected;
  });
  const pool = matched.length > 0 ? matched : [];
  // Live-calibrated ambiguity: an exact top hit with no same-named rival is
  // NOT ambiguous (collaborations/sub-brands below it don't confuse identity).
  // A non-exact top hit, or a same-named rival, means uncertain identity.
  const norm = (s: string): string => s.toLowerCase().trim();
  const exactName = norm(query);
  const firstExact = pool.length > 0 && norm(str(pool[0]!["name"])) === exactName;
  const dupe = pool.slice(1).some((h) => norm(str(h["name"])) === exactName);
  const ambiguous = pool.length > 1 && (!firstExact || dupe);
  const resolved: ResolvedEntity[] = pool.slice(0, 3).map((h, i) => ({
    query,
    id: str(h["entity_id"] ?? h["id"]),
    name: str(h["name"], query),
    type: expected,
    ambiguous: ambiguous && i === 0,
  }));
  return { result, resolved, typeMatched: matched.length > 0 };
}

/** describe: entity metadata + tags for characterization. */
export async function opDescribe(id: string): Promise<QlooResult<unknown>> {
  return qloo.entity(id);
}

/** recommend: discovery of alternatives anchored on a signal entity. */
export async function opRecommend(kind: DecisionKind, signalEntityId: string, take = 8): Promise<RankOutcome> {
  const result = await qloo.insights({
    "filter.type": FILTER_TYPE[kind],
    "signal.interests.entities": signalEntityId,
    take: String(take),
  });
  return { result, candidates: rankList(result) };
}

/**
 * rank: evaluate chosen + alternatives TOGETHER in one insights call against a
 * SHARED signal (the rest of the plan). Live-verified: affinity only exists
 * signal-scoped at entity.query.affinity; filter.entities is deprecated in
 * favor of filter.results.entities, which returns affinity when a signal is
 * present. Comparability rule: affinities from this single response share the
 * signal scale; never compare across calls.
 */
export async function opRank(kind: DecisionKind, ids: string[], signalEntityIds: string[], extra?: Record<string, string>): Promise<RankOutcome> {
  if (signalEntityIds.length === 0) {
    return { result: { state: "needs_input", data: null, note: "ranking requires a shared plan-context signal" }, candidates: [] };
  }
  const result = await qloo.insights({
    "filter.type": FILTER_TYPE[kind],
    "signal.interests.entities": signalEntityIds.join(","),
    "filter.results.entities": ids.join(","),
    "feature.explainability": "true",
    take: String(Math.max(ids.length, 5)),
    ...extra,
  });
  return { result, candidates: rankList(result) };
}

function rankList(result: QlooResult<unknown>): RankedCandidate[] {
  if (!result.data) return [];
  return asEntities(result.data).map((e) => {
    const q = e["query"] as Record<string, unknown> | undefined;
    const aff = q && typeof q["affinity"] === "number" ? (q["affinity"] as number) : num(e["affinity"]);
    return {
      id: str(e["entity_id"] ?? e["id"]),
      name: str(e["name"], "unknown"),
      affinity: aff,
      popularity: typeof e["popularity"] === "number" ? (e["popularity"] as number) : undefined,
      explain: q?.["explainability"],
    };
  });
}

/**
 * where_popular: heatmap affinity for one entity per market (live-verified:
 * filter.type=urn:heatmap + signal + filter.location.query; market score is
 * the cell query affinity). Markets are compared by RANK ORDER only, never by
 * treating cross-call scores as a single scale.
 */
export async function opWherePopular(kind: DecisionKind, entityId: string, markets: string[]): Promise<{ result: QlooResult<unknown>; byMarket: { market: string; affinity: number }[] }> {
  const byMarket: { market: string; affinity: number }[] = [];
  let last: QlooResult<unknown> = { state: "empty", data: null, note: "no markets" };
  const kindKey = `entity_${FILTER_TYPE[kind].split(":").pop()}_affinity`;
  for (const market of markets) {
    const r = await qloo.insights({
      "filter.type": "urn:heatmap",
      "signal.interests.entities": entityId,
      "filter.location.query": market,
      "filter.location.radius": "0",
    });
    last = r;
    let affinity = 0;
    if (r.data && typeof r.data === "object") {
      const res = (r.data as Record<string, unknown>)["results"] as Record<string, unknown> | undefined;
      const cells = res?.["heatmap"];
      const first = Array.isArray(cells) ? (cells[0] as Record<string, unknown> | undefined) : undefined;
      const q = first?.["query"] as Record<string, unknown> | undefined;
      const v = q?.[kindKey] ?? q?.["affinity"];
      if (typeof v === "number") affinity = v;
    }
    byMarket.push({ market, affinity });
  }
  return { result: last, byMarket };
}

/**
 * trends: momentum via GET /v2/trending (verified against official OpenAPI:
 * requires filter.type + filter.start_date + filter.end_date; entity passed
 * via signal.interests.entities; response rows live at results.trending[]
 * with population_percentile on a 0-100 scale, normalized here to 0-1).
 * slope = mean(second half) − mean(first half), rounded to 4dp.
 */
export async function opTrends(kind: DecisionKind, entityId: string, weeks = 12): Promise<{ result: QlooResult<unknown>; slope: number; points: number }> {
  const end = new Date();
  const start = new Date(end.getTime() - weeks * 7 * 86400_000);
  const iso = (d: Date): string => d.toISOString().slice(0, 10);
  const result = await qloo.trending({
    "filter.type": FILTER_TYPE[kind],
    "signal.interests.entities": entityId,
    "filter.start_date": iso(start),
    "filter.end_date": iso(end),
  });
  let slope = 0;
  let points = 0;
  if (result.data && typeof result.data === "object") {
    const r = (result.data as Record<string, unknown>)["results"] as Record<string, unknown> | undefined;
    const rows = r?.["trending"];
    if (Array.isArray(rows)) {
      const vals = (rows as Record<string, unknown>[])
        .map((p) => num(p["population_percentile"]) / 100)
        .filter((v) => v > 0);
      points = vals.length;
      if (vals.length >= 3) {
        const half = Math.floor(vals.length / 2);
        const avg = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
        slope = avg(vals.slice(half)) - avg(vals.slice(0, half));
        slope = Math.round(slope * 1e4) / 1e4;
      }
    }
  }
  return { result, slope, points };
}

/** entity_tags: tag-level characterization. */
export async function opTags(query: string): Promise<QlooResult<unknown>> {
  return qloo.tags(query);
}

/** compare_audiences: /v2/analysis/compare two entity groups. */
export async function opCompare(a: string[], b: string[], filterType?: string): Promise<QlooResult<unknown>> {
  return qloo.compare({
    "a.signal.interests.entities": a.join(","),
    "b.signal.interests.entities": b.join(","),
    ...(filterType ? { "filter.type": filterType } : {}),
  });
}

/** audience_info: lookup audiences / audience types for demographic signals. */
export async function opAudiences(): Promise<{ audiences: QlooResult<unknown>; types: QlooResult<unknown> }> {
  const [audiences, types] = await Promise.all([qloo.audiences(), qloo.audienceTypes()]);
  return { audiences, types };
}

export const OPS: Record<QlooOp, string> = {
  resolve: "entity resolution via /search (validates IDs before any claim)",
  describe: "entity metadata via /v2/entities/{id}",
  recommend: "candidate discovery via /v2/insights anchored on a verified signal entity",
  rank: "joint ranking via /v2/insights filter.results.entities + explainability",
  compare_audiences: "group comparison via /v2/analysis/compare",
  where_popular: "geographic affinity via /v2/insights filter.location.query per market",
  trends: "momentum via /v2/trends time series",
  entity_tags: "characterization via /v2/tags + entity metadata",
  audience_info: "demographic context via /v2/audiences",
  explain: "explainability metadata (feature.explainability=true on the ranking call)",
};
