/** Frontend types matching backend VerifiedReport / DecisionContract exactly. */

export type Verdict = 'PASS' | 'FAIL' | 'REVIEW' | 'ABSTAIN';
export type DecisionKind = 'artist' | 'brand' | 'place' | 'movie' | 'tv_show' | 'destination';

export interface EvidenceEntry {
  id: string;
  kind: 'user_input' | 'qloo_output' | 'calculation';
  op: string;
  ref: string;
  summary: string;
  affinity?: number;
  payload: unknown;
}

export interface ResolvedEntity {
  query: string;
  id: string;
  name: string;
  type: string;
  ambiguous: boolean;
}

export interface DecisionContract {
  id: string;
  kind: DecisionKind;
  original: string;
  context: string;
  market?: string;
  entities: ResolvedEntity[];
  candidates: string[];
  op: string;
  opReason: string;
  questionClass: string;
  evidence: EvidenceEntry[];
  derived: Record<string, number>;
  verdict: Verdict;
  verdictReason: string;
  evidenceQuality: 'strong' | 'thin' | 'insufficient';
  repairAllowed: boolean;
  replacement?: string;
  replacementEvidence: EvidenceEntry[];
  reverify?: Verdict;
}

export interface RevisedPlanEntry {
  kind: DecisionKind;
  choice: string;
  verdict: Verdict;
}

export interface VerifiedReport {
  title: string;
  mode: 'live' | 'sample' | 'unconfigured';
  decisions: DecisionContract[];
  revisedPlan: RevisedPlanEntry[];
  unresolved: string[];
  qlooCalls: number;
  latencyMs: number;
  interpretation: string;
}

export interface PlanItem {
  kind?: DecisionKind;
  name: string;
  context?: string;
  market?: string;
  alternatives?: string[];
}

export interface Plan {
  title?: string;
  markets?: string[];
  items: PlanItem[];
}
