import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.QLOO_API_KEY = process.env.QLOO_API_KEY ?? "eval-key";
process.env.SAMPLE_MODE = process.env.LIVE_EVAL ? "" : "true";

const here = dirname(fileURLToPath(import.meta.url));

/** Deterministic stub: chosen trails alternatives -> forces FAIL/repair path on rank scenarios. */
function stubFetch(): void {
  (globalThis as Record<string, unknown>)["fetch"] = async (u: unknown) => {
    const url = String(u);
    const json = (): unknown => {
      if (url.includes("/search")) {
        const q = new URL(url).searchParams.get("query") ?? "X";
        if (/xyxxy|nonexistent|12345/i.test(q)) return { results: [] };
        const n = /acme/i.test(q) ? 2 : 1;
        return { results: Array.from({ length: n }, (_, i) => ({ id: `id-${q}-${i}`, name: i === 0 ? q : `${q} (alt)` })) };
      }
      if (url.includes("/v2/insights")) {
        const p = new URL(url).searchParams;
        if (p.get("signal.interests.entities")) {
          return { success: true, results: { entities: [{ entity_id: "id-rep", name: "Verified Alt", affinity: 0.88, popularity: 0.6 }] } };
        }
        const ids = (p.get("filter.results.entities") ?? "id-solo").split(",");
        return {
          success: true,
          results: {
            entities: ids.map((id, i) => ({
              entity_id: id,
              name: id.replace(/^id-/, "").replace(/-\d$/, ""),
              affinity: i === 0 ? 0.35 : 0.85,
              popularity: 0.5,
            })),
          },
        };
      }
      if (url.includes("/v2/trending")) {
        const vals = [0.7, 0.65, 0.6, 0.5, 0.4, 0.3];
        return { success: true, results: { trending: vals.map((v, i) => ({ date: `2026-0${i + 1}-01`, population_percentile: v * 100 })) } };
      }
      return { success: true, results: { entities: [] } };
    };
    return { ok: true, status: 200, text: async () => JSON.stringify(json()), json: async () => json() };
  };
}

async function main(): Promise<void> {
const { resetQuota } = await import("../backend/src/qloo/client.js");
const { verifyPlan } = await import("../backend/src/tastediff/orchestrator.js");
const { allowedClaims } = await import("../backend/src/tastediff/ledger.js");

stubFetch();

let toolCorrect = 0;
let toolTotal = 0;
let abstainCorrect = 0;
let abstainTotal = 0;
let repairsOk = 0;
let repairsTotal = 0;
let claimViolations = 0;
let totalCalls = 0;
let totalLatency = 0;
let scenarios = 0;

for (const f of readdirSync(join(here, "scenarios")).filter((x) => x.endsWith(".json"))) {
  const s = JSON.parse(readFileSync(join(here, "scenarios", f), "utf8")) as {
    name: string; title: string; markets: string[];
    items: { kind: string; name: string; context?: string; market?: string; alternatives?: string[] }[];
    expect: { ops: string[]; mustAbstain?: number[] };
  };
  scenarios++;
  resetQuota();
  const t0 = Date.now();
  const report = await verifyPlan({ title: s.title, markets: s.markets, items: s.items as never });
  const latency = Date.now() - t0;
  totalLatency += latency;
  totalCalls += report.qlooCalls;

  s.expect.ops.forEach((op, i) => {
    toolTotal++;
    if (report.decisions[i]?.op === op) toolCorrect++;
    else console.log(`  MISS ${s.name}[${i}]: expected op ${op}, got ${report.decisions[i]?.op}`);
  });
  for (const i of s.expect.mustAbstain ?? []) {
    abstainTotal++;
    if (report.decisions[i]?.verdict === "ABSTAIN") abstainCorrect++;
    else console.log(`  MISS ${s.name}[${i}]: expected ABSTAIN, got ${report.decisions[i]?.verdict}`);
  }
  for (const d of report.decisions) {
    if (d.verdict === "FAIL") {
      repairsTotal++;
      if (d.replacement && d.reverify) repairsOk++;
      else console.log(`  MISS ${s.name}/${d.id}: FAIL without reverified replacement`);
    }
    if ((d.verdict === "PASS" || d.verdict === "FAIL") && d.evidenceQuality === "insufficient") {
      claimViolations++;
      console.log(`  MISS ${s.name}/${d.id}: firm verdict on insufficient evidence`);
    }
  }
  // Unsupported-claim scan: every number in the JSON report must come from the ledger.
  // KNOWN: system threshold constants rendered in templated verdict reasons (not cultural claims).
  const KNOWN = new Set(["0.05", "0.15"]);
  const allowed = allowedClaims(report.decisions);
  const nums = JSON.stringify({ ...report, interpretation: undefined }).match(/\b\d+\.\d+\b/g) ?? [];
  for (const n of new Set(nums)) {
    if (KNOWN.has(n)) continue;
    if (![...allowed.numbers].some((a) => Math.abs(Math.abs(Number(a)) - Number(n)) < 0.005)) {
      claimViolations++;
      console.log(`  MISS ${s.name}: number ${n} not traceable to ledger`);
    }
  }
  console.log(`ok ${s.name}: verdicts=[${report.decisions.map((d) => d.verdict).join(",")}] calls=${report.qlooCalls} latency=${latency}ms`);
}

console.log(`\nscenarios=${scenarios} tool_selection=${toolCorrect}/${toolTotal} abstention=${abstainCorrect}/${abstainTotal} repair_reverify=${repairsOk}/${repairsTotal} claim_violations=${claimViolations} avg_calls=${(totalCalls / scenarios).toFixed(1)} avg_latency=${Math.round(totalLatency / scenarios)}ms`);
  process.exit(toolCorrect === toolTotal && claimViolations === 0 ? 0 : 1);
}

void main();
