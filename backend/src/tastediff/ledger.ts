import type { DecisionContract, EvidenceEntry, QlooOp } from "./types.js";
import { nextEvidenceId, resetFallbackContext } from "../request-context.js";

export function entry(
  kind: EvidenceEntry["kind"],
  op: QlooOp | "plan" | "verdict" | "repair",
  ref: string,
  summary: string,
  payload: unknown,
  affinity?: number,
): EvidenceEntry {
  return { id: nextEvidenceId(), kind, op, ref, summary, payload, ...(affinity !== undefined ? { affinity } : {}) };
}

export function resetLedgerSeq(): void {
  resetFallbackContext();
}

/** Names + numbers the report is allowed to state: exactly the ledger-joined set. */
export function allowedClaims(decisions: DecisionContract[]): { names: Set<string>; numbers: Set<string> } {
  const names = new Set<string>();
  const numbers = new Set<string>();
  for (const d of decisions) {
    for (const e of [...d.evidence, ...d.replacementEvidence]) {
      if (e.kind === "user_input") continue;
      // qloo_output: names + numbers. calculation: numbers only (deterministic
      // math over valid Qloo output; prose summaries are never collected).
      collect(e.payload, names, numbers, e.kind === "qloo_output");
    }
    for (const ent of d.entities) names.add(ent.name.toLowerCase());
    for (const [k, v] of Object.entries(d.derived)) {
      numbers.add(fmt(v));
      void k;
    }
  }
  return { names, numbers };
}

function collect(payload: unknown, names: Set<string>, numbers: Set<string>, takeNames: boolean): void {
  if (payload === null || payload === undefined) return;
  if (typeof payload === "number" && Number.isFinite(payload)) {
    numbers.add(fmt(payload));
    return;
  }
  if (typeof payload === "string") {
    if (/^[0-9a-f-]{8,}$/i.test(payload)) return; // ids are not claims
    if (takeNames && payload.length <= 80 && /[A-Za-z]/.test(payload)) names.add(payload.toLowerCase());
    return;
  }
  if (Array.isArray(payload)) {
    for (const v of payload) collect(v, names, numbers, takeNames);
    return;
  }
  if (typeof payload === "object") {
    const o = payload as Record<string, unknown>;
    if (takeNames && typeof o["name"] === "string") names.add((o["name"] as string).toLowerCase());
    for (const [k, v] of Object.entries(o)) {
      if (k === "affinity" || k === "popularity" || k === "rank_gap" || k === "slope") {
        if (typeof v === "number") numbers.add(fmt(v));
      } else collect(v, names, numbers, takeNames);
    }
  }
}

function fmt(v: number): string {
  return v.toFixed(2);
}

const NUMBER_RE = /\b\d+\.\d+\b|\b\d+%\b/;

/**
 * Enforcement: interpretation prose must not smuggle unsupported numbers or
 * entity-like proper nouns. Names/numbers in templated sections are safe
 * because they are interpolated exclusively from ledger entries.
 */
export function checkInterpretation(text: string, allowed: { names: Set<string>; numbers: Set<string> }): string[] {
  const violations: string[] = [];
  if (!text.trim()) return violations;
  const nums = text.match(NUMBER_RE);
  if (nums) {
    const bad = nums.filter((n) => {
      const norm = n.endsWith("%") ? Number(n.slice(0, -1)) / 100 : Number(n);
      return ![...allowed.numbers].some((a) => Math.abs(Number(a) - norm) < 0.005 || a === n);
    });
    if (bad.length > 0) violations.push(`unsupported numbers in interpretation: ${bad.join(", ")}`);
  }
  const proper = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) ?? [];
  const badNames = proper.filter((p) => !allowed.names.has(p.toLowerCase()));
  if (badNames.length > 0) violations.push(`unverified names in interpretation: ${[...new Set(badNames)].join(", ")}`);
  return violations;
}
