export type Verdict = "PASS" | "FAIL" | "REVIEW" | "ABSTAIN";
export type ResultState = "ok" | "needs_input" | "partial" | "degraded" | "empty" | "error";
export type DecisionKind = "artist" | "brand" | "place" | "movie" | "tv_show" | "destination";

/** Qloo operation the planner may select. Closed allowlist — the model cannot invent tools. */
export type QlooOp =
  | "resolve"
  | "describe"
  | "recommend"
  | "rank"
  | "compare_audiences"
  | "where_popular"
  | "trends"
  | "entity_tags"
  | "audience_info"
  | "explain";

export type QuestionClass =
  | "best_of_candidates"
  | "geographic_strength"
  | "momentum"
  | "replacement_discovery"
  | "audience_difference"
  | "characterization"
  | "unsupported";

/** A culturally testable decision. */
export interface DecisionContract {
  id: string;
  kind: DecisionKind;
  original: string;
  context: string;
  market?: string;
  entities: ResolvedEntity[];
  candidates: string[];
  op: QlooOp;
  opReason: string;
  questionClass: QuestionClass;
  evidence: EvidenceEntry[];
  derived: Record<string, number>;
  verdict: Verdict;
  verdictReason: string;
  evidenceQuality: "strong" | "thin" | "insufficient";
  repairAllowed: boolean;
  replacement?: string;
  replacementEvidence: EvidenceEntry[];
  reverify?: Verdict;
}

export interface ResolvedEntity {
  query: string;
  id: string;
  name: string;
  type: string;
  ambiguous: boolean;
}

/** Append-only provenance record. */
export interface EvidenceEntry {
  id: string;
  kind: "user_input" | "qloo_output" | "calculation";
  op: QlooOp | "plan" | "verdict" | "repair";
  ref: string;
  summary: string;
  affinity?: number;
  payload: unknown;
}

export interface VerifiedReport {
  title: string;
  mode: "live" | "sample" | "unconfigured";
  decisions: DecisionContract[];
  revisedPlan: { kind: DecisionKind; choice: string; verdict: Verdict }[];
  unresolved: string[];
  qlooCalls: number;
  latencyMs: number;
  interpretation: string;
}
