import type { DecisionContract, DecisionKind, QlooOp, QuestionClass } from "./types.js";

export interface PlanItem {
  kind?: DecisionKind;
  name: string;
  context?: string;
  market?: string;
  alternatives?: string[];
}

const KIND_HINTS: { re: RegExp; kind: DecisionKind }[] = [
  { re: /\b(opener|headliner|band|singer|rapper|dj|artist|act)\b/i, kind: "artist" },
  { re: /\b(sponsor|brand|partner|beer|beverage|apparel)\b/i, kind: "brand" },
  { re: /\b(venue|club|arena|theater|hall|stadium|restaurant|hotel)\b/i, kind: "place" },
  { re: /\b(film|movie|aftermovie|documentary)\b/i, kind: "movie" },
  { re: /\b(series|tv|stream)\b/i, kind: "tv_show" },
  { re: /\b(city|market|tour stop|destination)\b/i, kind: "destination" },
];

export function inferKind(name: string, context: string): DecisionKind {
  const text = `${context} ${name}`;
  for (const h of KIND_HINTS) if (h.re.test(text)) return h.kind;
  return "artist";
}

/** Deterministic tool selection. Maps question class -> exactly one Qloo op, with reason. Returns null (unsupported) when no op can answer. */
export function selectOp(q: QuestionClass): { op: QlooOp; reason: string } | null {
  switch (q) {
    case "best_of_candidates":
      return { op: "rank", reason: "Candidates must be evaluated together in one ranking call so affinities share a scale." };
    case "geographic_strength":
      return { op: "where_popular", reason: "Market fit is a geographic-affinity question answered by location-scoped insights." };
    case "momentum":
      return { op: "trends", reason: "Gaining/losing momentum is a time-series question answered by trending data." };
    case "replacement_discovery":
      return { op: "recommend", reason: "Alternatives must be discovered from Qloo anchored on verified entities, not invented." };
    case "audience_difference":
      return { op: "compare_audiences", reason: "Group differences are answered by the analysis/compare endpoint." };
    case "characterization":
      return { op: "entity_tags", reason: "Cultural characterization comes from tags/describe metadata." };
    case "unsupported":
      return null;
  }
}

/** Classify what a decision is asking. Conservative: unknown -> unsupported (abstain path). */
export function classify(item: PlanItem, hasMarket: boolean, hasAlternatives: boolean): QuestionClass {
  const ctx = `${item.context ?? ""} ${item.name}`.toLowerCase();
  if (/(which .* best|best aligns|choose between|rank|versus| vs |compare)/.test(ctx) && hasAlternatives) return "best_of_candidates";
  if (/(where|market|city|geo|strong in|tour stop)/.test(ctx) && (hasMarket || /market|city|tour/.test(ctx))) return "geographic_strength";
  if (/(momentum|trending|gaining|losing steam|hype)/.test(ctx)) return "momentum";
  if (/(replace|alternative|substitute|instead)/.test(ctx)) return "replacement_discovery";
  if (/(audience|demographic|fanbase|differ)/.test(ctx)) return "audience_difference";
  if (/(vibe|character|genre|style|describe|what kind)/.test(ctx)) return "characterization";
  if (hasAlternatives) return "best_of_candidates";
  if (hasMarket) return "geographic_strength";
  return "unsupported";
}

/** Decompose a plan into decision contracts. Deterministic; an LLM may propose wording upstream but contracts + op selection here are authoritative. */
export function decompose(items: PlanItem[], markets: string[]): DecisionContract[] {
  return items.map((item, index) => {
    const kind = item.kind ?? inferKind(item.name, item.context ?? "");
    const market = item.market ?? markets[0];
    const q = classify(item, markets.length > 0, (item.alternatives?.length ?? 0) > 0);
    const sel = selectOp(q);
    const id = `d${index + 1}`;
    return {
      id,
      kind,
      original: item.name,
      context: item.context ?? "",
      ...(market !== undefined ? { market } : {}),
      entities: [],
      candidates: item.alternatives ?? [],
      op: sel?.op ?? "resolve",
      opReason: sel ? sel.reason : "No Qloo operation can answer this question; must abstain rather than invent evidence.",
      questionClass: q,
      evidence: [],
      derived: {},
      verdict: "ABSTAIN",
      verdictReason: "Not yet evaluated.",
      evidenceQuality: "insufficient",
      repairAllowed: kind !== "destination",
      replacementEvidence: [],
    } satisfies DecisionContract;
  });
}

export function resetSeq(): void {
  // Retained for compatibility with direct callers; IDs are request-local.
}
