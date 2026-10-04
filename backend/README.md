# StageCheck backend (Agent A)

Fastify + Zod TypeScript API implementing the TasteDiff verification engine over the Qloo hackathon API.

## Run

```bash
npm install
export QLOO_API_KEY=...        # server-side only; never commit
npm run dev                     # :8080
npm test
npm run smoke                    # live bounded Qloo smoke (needs key)
```

`SAMPLE_MODE=true` enables explicitly labeled sample data (never confused with live Qloo output).

## Endpoints

- `GET /api/health` → `{ ok, qloo: live|sample|unconfigured, version }`
- `POST /api/verify` `{ plan: { title?, markets?, items: [{kind, name, context?}] } }` → verified report/diff
- `POST /mcp` JSON-RPC: `tools/list`, `tools/call tastediff_verify {plan}`

Kinds: `artist | brand | place | movie | tv_show | destination`. Markets are locality names (e.g. "Austin").

## Rules enforced in code

- Qloo key in `X-Api-Key` header, hackathon base URL only.
- Alternatives ranked jointly in one insights call (`filter.results.entities`); raw `affinity` kept separate from derived `rank_gap = top_affinity − chosen_affinity`.
- Four verdicts: PASS / FAIL / REVIEW / ABSTAIN. No universal compatibility %.
- Every user-facing name/number renders from the Evidence Ledger; `interpretation` prose must contain no numbers or unverified names (checked).
