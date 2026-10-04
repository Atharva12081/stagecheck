# TASKS

## Agent A (backend) — active
- [x] Repo scaffold + coordination files
- [x] Qloo adapter (search/entities/insights/compare/trends/tags/audiences) with failure-state normalization, retries, cache, quota guard
- [x] TasteDiff engine: contracts, planner/tool-selection, verdicts, ledger, repair/reverify, orchestrator
- [x] API routes + MCP endpoint + security middleware + static frontend serving
- [x] Unit/contract/evidence/adversarial tests (29 Vitest, all pass)
- [x] Eval runner (4 scenarios: 6/6 tool selection, 3/3 repairs, 0 claim violations)
- [x] Official-OpenAPI recheck: fixed /search types, /entities, /v2/tags, /v2/trending + contract tests (34/34 pass)
- [x] Evidence integrity: generic labeled sample fixtures (removed hardcoded artist affinities)
- [x] Dockerfile + root README + MIT LICENSE
- [ ] Live Qloo smoke test + flagship contradiction scenario (blocked on API key)
- [ ] Live repeatability/latency/quota numbers; threshold tuning on real affinities

## Agent B (product/frontend) — owned by B
- [ ] Frontend + UX + demo experience on top of `POST /api/verify` (working shell in `frontend/` is replaceable)
- [ ] Devpost narrative, judge review, red-team findings → file backend issues in BLOCKERS.md
- [ ] Publishing: public GitHub repo + hosted demo URL (see BLOCKERS.md)

## Rules
- Agent A may read anything; do not rewrite Agent B's `frontend/` components except to fix critical breakage.
- Substantial work → update STATE.md/TASKS.md concisely. No journals.
