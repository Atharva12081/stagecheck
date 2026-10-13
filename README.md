# StageCheck — cultural preflight for live entertainment

Reusable engine: **TasteDiff**. Before a tour, festival, promoter, artist team, or
sponsorship team spends money executing a plan, StageCheck checks the plan's
culturally dependent decisions against Qloo: verification, contradiction
detection, targeted repair, reverification.

## Layout

- `backend/` — Fastify + Zod TypeScript API + TasteDiff engine (Agent A). See `backend/README.md`.
- `frontend/` — demo UI served by the backend (Agent B owns UX/design).
- `evals/` — fixed scenarios + runner (`npm run eval` in `backend/`).
- `.agents/` — shared STATE / TASKS / DECISIONS / BLOCKERS.

## Quick start

```bash
cd backend && npm install
export QLOO_API_KEY=...   # server-side only; hackathon base URL is baked in
npm run dev               # http://localhost:8080 (API + frontend)
npm test                  # 42 unit/contract/evidence/concurrency/adversarial tests
npm run eval              # 4 fixed scenarios, tool-selection + claim metrics
npm run benchmark         # bounded live-only StageCheck vs one-shot comparison
npm run smoke             # bounded live Qloo check (3 read-only calls)
```

Without a key, set `SAMPLE_MODE=true` for explicitly labeled sample output —
never confused with live Qloo results.

## API

- `POST /api/verify` — `{ plan }` → `{ decisions[{verdict, evidence, repair…}], revisedPlan, unresolved }`
- `POST /mcp` — JSON-RPC `tools/list` + `tools/call tastediff_verify`
- `GET /api/health` — `{ ok, qloo: live|sample|unconfigured }`

License: MIT.

Demo scenarios are hypothetical planning exercises; no artist/brand
affiliation, endorsement, or actual sponsorship is implied.

## Evaluation and deployment status

- CI runs backend tests/build/evals, frontend lint/build, and a production
  Docker build on every push and pull request.
- `evals/benchmark.ts` preregisters non-flagship scenarios and reports actual
  denominators, failures, calls, latency, uncertainty, and Qloo-relative
  limitations. It exits instead of using sample data when no live key exists.
- The October 6 flagship screenshots in `docs/` are archived live evidence,
  not proof that a public deployment is currently reachable.
- No public deployment URL is currently verified. See
  `docs/JUDGE_WALKTHROUGH.md` for the final owner checklist.
