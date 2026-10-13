# STATE — StageCheck / TasteDiff (Agent A backend)

Date: 2026-10-13. Repository and remote `main` re-audited before changes.

Stack: backend TypeScript (Fastify + Zod, Node 22), React frontend,
fixed regression evals, live-only comparative benchmark, and single-host Docker deploy.
Qloo: hackathon base URL baked in; key is server-side only. No key is available
in the current environment, so fresh live verification is blocked.

Verified 2026-10-13:
- Fixed all six mission audit risks: minimum candidate evidence, PASS-only repair
  adoption, winner-first fresh reverification, request-local quota/evidence IDs,
  Docker dependency layout, and real GitHub Actions CI configuration.
- 42/42 Vitest tests pass; backend build and fixed eval pass (6/6 tool
  selection, 1/1 abstention, 2/2 repairs, 0 claim violations); frontend lint
  and build pass.
- Mobile-width workflow verified locally; invalid plans return 400; rate limit
  returned 429 after the configured burst; WCAG A/AA automated scan has zero
  violations.
- `https://stagecheck.onrender.com/api/health` is not deployed (Render routing
  404). Render dashboard requires owner login. Docker engine is unavailable
  locally, so the workflow's Docker build must be confirmed in GitHub Actions.
- Live-only comparative runner preregisters non-flagship scenarios and refuses
  to run without a key. No comparative improvement claim is currently made.

Verified working (2026-10-04):
- `tsc --noEmit` clean; Vitest 29/29 pass (tool-selection, verdicts, ledger, security, stubbed orchestrator incl. FAIL→repair→reverify, unknown/injection ABSTAIN, error handling).
- `evals/run.ts`: 4 scenarios, tool_selection 6/6, repair_reverify 3/3, claim_violations 0, avg 5.8 calls/verify.
- Live server boot: /api/health, /api/verify, /mcp (list+call), validation 400s, static frontend 200.

2026-10-06 LIVE (key secured server-side only, never in repo/logs):
- Contract re-verified live: affinity is signal-scoped (`entity.query.affinity`); `filter.entities` deprecated → `filter.results.entities` + signal (no warnings); heatmap geo confirmed; trending empty for tested entities (momentum deprioritized).
- Hunted 12 rank + 3 geo scenarios (~70 calls). FLAGSHIP: Taylor Swift stadium tour sponsor — Liquid Death FAILS (gap 0.25: Nike 0.88 > Coca-Cola 0.84 > Liquid Death 0.64), repaired to Nike, reverified PASS. Reproduced byte-identical twice (10 calls each).
- Hostile review (2026-10-06): Implementation 9.5, Design 9, Impact 8.5, Idea 9.5, Indispensability 10, Agentic 9, Originality 9.5, Integrity 10, Reliability 9, Demo clarity 9.5, Memorability 9. Only sub-9 is Impact breadth — accepted, no destabilizing change. DEFAULT_PLAN is now the flagship.
- Engine: sibling-signal joint ranking, heatmap rank-order + tie guard, exact-match resolution, reproduce-top repair, rank-only repair. 38/38 tests, evals clean.

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
