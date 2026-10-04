export const QLOO_BASE = "https://hackathon.api.qloo.com";
export const QLOO_KEY = process.env.QLOO_API_KEY ?? "";
export const SAMPLE_MODE = process.env.SAMPLE_MODE === "true";
export const PORT = Number(process.env.PORT ?? 8080);

// Verdict thresholds (documented, deterministic).
export const PASS_GAP = 0.05; // rank_gap <= this with solid evidence -> PASS
export const FAIL_GAP = 0.15; // rank_gap >= this -> FAIL (chosen far behind best)
export const MIN_EVIDENCE = 2; // min ranked candidates needed for PASS/FAIL, else REVIEW/ABSTAIN
export const AFFINITY_FLOOR = 0.05; // affinities below this are noise -> abstain-leaning

// Reliability bounds.
export const QLOO_TIMEOUT_MS = 12_000;
export const QLOO_MAX_RETRIES = 2;
export const QLOO_CACHE_TTL_MS = 5 * 60_000;
export const QLOO_CACHE_MAX = 500;
export const MAX_CALLS_PER_VERIFY = 24;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 30;

export type QlooMode = "live" | "sample" | "unconfigured";
export function qlooMode(): QlooMode {
  if (QLOO_KEY) return "live";
  if (SAMPLE_MODE) return "sample";
  return "unconfigured";
}
