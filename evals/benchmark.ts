import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface Scenario {
  id: string;
  signal: string;
  proposed: string;
  alternatives: string[];
  expectedAbstain?: boolean;
}

interface Ranked {
  id: string;
  name: string;
  affinity: number;
}

const here = dirname(fileURLToPath(import.meta.url));
const all = JSON.parse(readFileSync(join(here, "benchmark-scenarios.json"), "utf8")) as Scenario[];
const requestedMax = Number(process.env.BENCHMARK_MAX_SCENARIOS ?? 5);
const maxScenarios = Number.isFinite(requestedMax) ? Math.max(1, Math.min(all.length, requestedMax)) : 5;
const repeats = 2;

if (!process.env.QLOO_API_KEY) {
  console.error("Live comparative benchmark not run: QLOO_API_KEY is required server-side. No sample or fixture results are accepted.");
  process.exit(2);
}
process.env.SAMPLE_MODE = "";

function rankedFrom(payload: unknown): Ranked[] {
  if (!payload || typeof payload !== "object") return [];
  const results = (payload as Record<string, unknown>)["results"] as Record<string, unknown> | undefined;
  const entities = results?.["entities"];
  if (!Array.isArray(entities)) return [];
  return (entities as Record<string, unknown>[]).flatMap((entity) => {
    const query = entity["query"] as Record<string, unknown> | undefined;
    const id = entity["entity_id"] ?? entity["id"];
    const name = entity["name"];
    const affinity = query?.["affinity"] ?? entity["affinity"];
    return typeof id === "string" && typeof name === "string" && typeof affinity === "number"
      ? [{ id, name, affinity }]
      : [];
  });
}

function gapFor(rows: Ranked[], name: string): number | null {
  const chosen = rows.find((row) => row.name.toLowerCase() === name.toLowerCase());
  if (!chosen || rows.length < 2) return null;
  return Math.round((Math.max(...rows.map((row) => row.affinity)) - chosen.affinity) * 10_000) / 10_000;
}

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 10_000) / 10_000;
}

async function main(): Promise<void> {
  const [{ PASS_GAP, FAIL_GAP }, { verifyPlan }, { opRank }, { resetQuota, getCallCount }] = await Promise.all([
    import("../backend/src/config.js"),
    import("../backend/src/tastediff/orchestrator.js"),
    import("../backend/src/qloo/operations.js"),
    import("../backend/src/qloo/client.js"),
  ]);

  const scenarios = all.slice(0, maxScenarios);
  const rows: Record<string, unknown>[] = [];
  const counts = {
    underperforming: 0,
    acceptable: 0,
    uncertain: 0,
    expectedAbstain: 0,
    stageDetected: 0,
    baselineDetected: 0,
    stagePreserved: 0,
    baselinePreserved: 0,
    stageUnnecessaryChanges: 0,
    baselineUnnecessaryChanges: 0,
    stageReverifiedRepairs: 0,
    stageRepairOpportunities: 0,
    abstentionCorrect: 0,
    unsupportedFirmVerdicts: 0,
    failures: 0,
    stageCalls: 0,
    referenceCalls: 0,
    stageLatencyMs: 0,
  };

  for (const scenario of scenarios) {
    const started = Date.now();
    const report = await verifyPlan({
      title: scenario.id,
      items: [
        { kind: "brand", name: scenario.proposed, context: "Which of these sponsors best aligns with this headliner?", alternatives: scenario.alternatives },
        { kind: "artist", name: scenario.signal, context: "Describe this headliner's cultural profile." },
      ],
    });
    const latencyMs = Date.now() - started;
    counts.stageLatencyMs += latencyMs;
    counts.stageCalls += report.qlooCalls;
    const decision = report.decisions[0]!;

    if (scenario.expectedAbstain) {
      counts.expectedAbstain++;
      if (decision.verdict === "ABSTAIN") counts.abstentionCorrect++;
      else counts.failures++;
      rows.push({ id: scenario.id, reference: "expected-unresolvable-control", stageVerdict: decision.verdict, stageCalls: report.qlooCalls, latencyMs });
      continue;
    }

    const rankEvidence = decision.evidence.find((e) => e.kind === "qloo_output" && e.op === "rank");
    const initial = rankedFrom(rankEvidence?.payload);
    const signalId = report.decisions[1]?.entities[0]?.id;
    if (initial.length < 2 || !signalId) {
      counts.failures++;
      rows.push({ id: scenario.id, failure: "StageCheck did not produce a resolvable joint ranking", stageVerdict: decision.verdict, stageCalls: report.qlooCalls, latencyMs });
      continue;
    }

    const baselineChoice = [...initial].sort((a, b) => b.affinity - a.affinity)[0]!.name;
    const ids = initial.map((row) => row.id);
    resetQuota();
    const references: Ranked[][] = [];
    for (let i = 0; i < repeats; i++) {
      const reference = await opRank("brand", ids, [signalId], undefined, true);
      if (reference.result.state !== "ok" && reference.result.state !== "partial" && reference.result.state !== "degraded") break;
      references.push(reference.candidates);
    }
    const referenceCalls = getCallCount();
    counts.referenceCalls += referenceCalls;
    if (references.length !== repeats) {
      counts.failures++;
      rows.push({ id: scenario.id, failure: `Only ${references.length}/${repeats} independent reference rankings succeeded`, stageCalls: report.qlooCalls, referenceCalls, latencyMs });
      continue;
    }

    const proposedGaps = references.map((reference) => gapFor(reference, scenario.proposed));
    if (proposedGaps.some((gap) => gap === null)) {
      counts.failures++;
      rows.push({ id: scenario.id, failure: "Proposed choice absent from an independent reference ranking", proposedGaps, stageCalls: report.qlooCalls, referenceCalls, latencyMs });
      continue;
    }
    const gaps = proposedGaps as number[];
    const underperforming = gaps.every((gap) => gap >= FAIL_GAP);
    const acceptable = gaps.every((gap) => gap <= PASS_GAP);
    const stageChanged = report.revisedPlan[0]?.choice !== scenario.proposed;
    const baselineChanged = baselineChoice.toLowerCase() !== scenario.proposed.toLowerCase();

    if (underperforming) {
      counts.underperforming++;
      counts.stageRepairOpportunities++;
      if (decision.verdict === "FAIL") counts.stageDetected++;
      if (baselineChanged) counts.baselineDetected++;
      const repaired = report.revisedPlan[0]?.choice;
      if (stageChanged && repaired && references.every((reference) => (gapFor(reference, repaired) ?? Infinity) <= PASS_GAP)) {
        counts.stageReverifiedRepairs++;
      }
    } else if (acceptable) {
      counts.acceptable++;
      if (!stageChanged) counts.stagePreserved++;
      else counts.stageUnnecessaryChanges++;
      if (!baselineChanged) counts.baselinePreserved++;
      else counts.baselineUnnecessaryChanges++;
    } else {
      counts.uncertain++;
    }
    if ((decision.verdict === "PASS" || decision.verdict === "FAIL") && decision.evidenceQuality === "insufficient") counts.unsupportedFirmVerdicts++;

    rows.push({
      id: scenario.id,
      referenceLabel: underperforming ? "underperforming" : acceptable ? "acceptable" : "uncertain",
      referenceGaps: gaps,
      stageVerdict: decision.verdict,
      stageChoice: report.revisedPlan[0]?.choice,
      baselineChoice,
      stageCalls: report.qlooCalls,
      referenceCalls,
      latencyMs,
    });
  }

  const result = {
    generatedAt: new Date().toISOString(),
    mode: "live",
    methodology: {
      scenariosCommittedBeforeRun: true,
      reference: `${repeats} fresh Qloo joint-ranking repeats, separate from the StageCheck and one-shot decisions`,
      groundTruthScope: "Qloo-relative stability only; not real-world commercial performance, revenue, or causal lift",
      thresholds: { passGap: PASS_GAP, failGap: FAIL_GAP },
      uncertainCasesExcludedFromDetectionAndPreservationDenominators: true,
    },
    denominators: {
      scenariosAttempted: scenarios.length,
      underperforming: counts.underperforming,
      acceptable: counts.acceptable,
      uncertain: counts.uncertain,
      expectedAbstain: counts.expectedAbstain,
      failures: counts.failures,
    },
    stageCheck: {
      underperformerDetection: { numerator: counts.stageDetected, denominator: counts.underperforming, rate: rate(counts.stageDetected, counts.underperforming) },
      acceptablePreservation: { numerator: counts.stagePreserved, denominator: counts.acceptable, rate: rate(counts.stagePreserved, counts.acceptable) },
      unnecessaryChanges: { numerator: counts.stageUnnecessaryChanges, denominator: counts.acceptable, rate: rate(counts.stageUnnecessaryChanges, counts.acceptable) },
      reverifiedRepairs: { numerator: counts.stageReverifiedRepairs, denominator: counts.stageRepairOpportunities, rate: rate(counts.stageReverifiedRepairs, counts.stageRepairOpportunities) },
      abstentionCorrectness: { numerator: counts.abstentionCorrect, denominator: counts.expectedAbstain, rate: rate(counts.abstentionCorrect, counts.expectedAbstain) },
      unsupportedFirmVerdicts: counts.unsupportedFirmVerdicts,
      qlooCalls: counts.stageCalls,
      averageLatencyMs: Math.round(counts.stageLatencyMs / scenarios.length),
    },
    oneShotQloo: {
      underperformerDetection: { numerator: counts.baselineDetected, denominator: counts.underperforming, rate: rate(counts.baselineDetected, counts.underperforming) },
      acceptablePreservation: { numerator: counts.baselinePreserved, denominator: counts.acceptable, rate: rate(counts.baselinePreserved, counts.acceptable) },
      unnecessaryChanges: { numerator: counts.baselineUnnecessaryChanges, denominator: counts.acceptable, rate: rate(counts.baselineUnnecessaryChanges, counts.acceptable) },
      note: "Uses the top entity from the initial joint ranking; it does not repair and freshly reverify.",
    },
    llmOnly: {
      status: "not_run",
      reason: "No model adapter is configured for this repository; no LLM-only numbers are inferred or fabricated.",
    },
    referenceQlooCalls: counts.referenceCalls,
    rows,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exit(counts.failures === 0 && counts.unsupportedFirmVerdicts === 0 ? 0 : 1);
}

void main();
