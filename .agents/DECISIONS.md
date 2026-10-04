# DECISIONS

1. **Monorepo, backend-first**: `backend/` (Fastify+Zod TS API + TasteDiff engine), `frontend/` reserved for Agent B, `evals/` fixed scenarios. Rationale: velocity + single-host demo deploy.
2. **Hackathon base URL only**: `https://hackathon.api.qloo.com`; key in `X-Api-Key` header, server-side, never to client/model. Wrong-base 401 is the #1 known pitfall.
3. **GET for /v2/insights** (query string), documented params only; invalid params are silently ignored → validate against Entity Type Parameter Guide before assuming data issues.
4. **Ranking via joint evaluation**: alternatives compared in one insights call (`filter.results.entities`), never by comparing scores across unrelated calls. Raw Qloo affinity kept separate from derived `rank_gap`; formulas documented in code.
5. **No universal compatibility %**: only defensible metrics shown; else ABSTAIN.
6. **Evidence Ledger enforcement**: user-facing names/numbers render only from ledger-joined Qloo output; LLM prose quarantined in `interpretation` field, numeric/entity claims there rejected by checker.
7. **LLM is pluggable, engine is deterministic**: rule-based planner + verdicts work with no LLM key; optional OpenAI-compatible LLM only for decomposition wording, constrained to allowlisted operations. No GPU training.
8. **ABSTAIN/REVIEW are first-class**: ambiguous resolution, empty/degraded beyond threshold, methodologically invalid comparisons → abstain, never fill gaps with world knowledge.
9. **Endpoints verified against official OpenAPI 2026-10-05** (`backend/test/qloo-contract.test.ts` locks them): `/search` types=URN; describe=`GET /entities?entity_ids=`; tags=`GET /v2/tags?filter.query=`; trends=`GET /v2/trending` with required filter.type/start/end + signal entities, percentile normalized 0-100→0-1.
10. **Sample fixtures assert no cultural claims**: generic request echoes + id-hash affinities, all `sample:true`; real-artist hardcoded affinities are forbidden (removed 2026-10-05).
