# STATE — StageCheck / TasteDiff (Agent A backend)

Date: 2026-10-04. Repo was empty; Agent A built the backend foundation end-to-end.

Stack: backend TypeScript (Fastify + Zod, Node 26), `frontend/` working demo shell (Agent B owns UX), `evals/` fixed scenarios, Dockerfile single-host deploy.
Qloo: hackathon base URL baked in, key via `QLOO_API_KEY` server-side only. No key yet → labeled `SAMPLE_MODE`; live smoke script ready.

Verified working (2026-10-04):
- `tsc --noEmit` clean; Vitest 29/29 pass (tool-selection, verdicts, ledger, security, stubbed orchestrator incl. FAIL→repair→reverify, unknown/injection ABSTAIN, error handling).
- `evals/run.ts`: 4 scenarios, tool_selection 6/6, repair_reverify 3/3, claim_violations 0, avg 5.8 calls/verify.
- Live server boot: /api/health, /api/verify, /mcp (list+call), validation 400s, static frontend 200.

2026-10-05 corrections (Agent A):
- Official OpenAPI recheck fixed 4 wrong assumptions before live key arrives: `/search` types now URN; describe uses `GET /entities?entity_ids=`; tags use `filter.query`; trends rewritten to `GET /v2/trending` (+filter.type/start/end/signal, percentile 0-100 normalized). New `test/qloo-contract.test.ts` locks paths (34/34 pass, evals still clean).
- Evidence integrity: removed hardcoded XG/aespa/Weeknd sample affinities from `client.ts` (fabricated cultural claims); sample fixtures are generic labeled echoes. Filed BLOCKERS #2 (SAMPLE badge) + #3 for Agent B.
- 2026-10-05 finalization sprint: frontend SAMPLE DATA banner + header pill; backend serves `frontend/dist` with SPA fallback + traversal guard; Dockerfile builds both stages (no SAMPLE_MODE in prod); report mode now live|sample|unconfigured; local git committed (secret scan clean).
- Repeatability: stubbed eval suite run twice → identical verdicts/call-counts/metrics (only wall-clock latency varies). Docker engine unavailable locally; image validated by review only.

Next (Agent A):
1. Live QLOO_API_KEY → smoke + flagship contradiction hunt (BLOCKERS #1).
2. Live repeatability/latency numbers; tighten thresholds if live affinities behave differently.
3. Consider `bias`/`explainability` tuning once live data is visible.

Demo contract for Agent B: `POST /api/verify { plan }` → report/diff JSON; `GET /api/health`; `POST /mcp`. Backend serves `frontend/` statically. Do not expose QLOO_API_KEY client-side.
