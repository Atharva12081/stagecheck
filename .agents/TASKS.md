# TASKS

## Engineering — current
- [x] Repo scaffold + coordination files
- [x] Qloo adapter (search/entities/insights/compare/trends/tags/audiences) with failure-state normalization, retries, cache, quota guard
- [x] TasteDiff engine: contracts, planner/tool-selection, verdicts, ledger, repair/reverify, orchestrator
- [x] API routes + MCP endpoint + security middleware + static frontend serving
- [x] Unit/contract/evidence/concurrency/adversarial tests (42 Vitest, all pass)
- [x] Eval runner (4 scenarios: 6/6 tool selection, 3/3 repairs, 0 claim violations)
- [x] Official-OpenAPI recheck: fixed /search types, /entities, /v2/tags, /v2/trending + contract tests (34/34 pass)
- [x] Evidence integrity: generic labeled sample fixtures (removed hardcoded artist affinities)
- [x] Dockerfile + root README + MIT LICENSE
- [x] Correctness audit and regression fixes for the six mission risks
- [x] GitHub Actions CI workflow including production Docker build
- [x] Live-only comparative benchmark harness with explicit denominators
- [ ] Fresh live smoke, benchmark, and flagship reproduction (blocked on API key)
- [ ] Public Render deployment (blocked on owner login and server-side key)

## Product/submission
- [x] Frontend flow, explicit evidence modes, diff, mobile check, accessibility check
- [x] Honest Devpost draft and concise judge walkthrough
- [ ] Add verified public URL and fresh live benchmark results
- [ ] Owner completes eligibility/rights attestations and final submission

## Rules
- Agent A may read anything; do not rewrite Agent B's `frontend/` components except to fix critical breakage.
- Substantial work → update STATE.md/TASKS.md concisely. No journals.
