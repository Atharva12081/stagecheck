# BLOCKERS

1. **[HUMAN OWNER] QLOO_API_KEY missing.** No key in env. Need hackathon key (request form: https://forms.gle/zz12orkLHTAneLGz6, guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide). Until then backend runs in labeled `SAMPLE_MODE`; live smoke (`npm run smoke` in `backend/`) and flagship contradiction hunt are pending. Do NOT put the key in frontend, logs, repo, or screenshots — `export QLOO_API_KEY=...` server-side only.
2. **[AGENT B — REQUIRED] Frontend never displays report `mode`.** Backend returns `mode: live|sample` on every report, but the UI renders sample verdicts indistinguishable from live Qloo verdicts. Add a visible SAMPLE badge (and keep it) whenever `mode === 'sample'`. Judges must never read simulated numbers as Qloo data.
3. **[AGENT B] Sample fixtures are generic echoes as of 2026-10-05.** The hardcoded XG/aespa/Weeknd sample affinities were removed (fabricated cultural claims). Sample mode now returns request-echoed entities with hash-derived affinities, so the flagship demo's verdicts will differ until the live key lands. Demo copy that assumes a specific FAIL must wait for live data.
4. **AI-use disclosure (if required by rules):** rules text reviewed 2026-10-04 shows no explicit AI-attribution clause, but owner + Agent B should confirm before submission and add any required disclosure to Devpost (not in code).
5. **Owner action required: deploy + Devpost submit (only remaining human steps).**
   Deploy (5 min, Render free tier):
   1. https://dashboard.render.com → New + → Web Service → connect `Atharva12081/stagecheck` → runtime Docker (auto-detected via Dockerfile, `render.yaml` present).
   2. Environment → add `QLOO_API_KEY` = your hackathon key (Dashboard → Environment Variables; never commit it).
   3. Deploy → open `/api/health` (expect `qloo:"live"`) → run the default plan once → confirm FAIL Liquid Death → Nike PASS.
   Then Devpost: paste `.agents/DEVPOST.md`, set demo URL to the Render URL, attach `docs/flagship-results.png` + `docs/flagship-diff.png`, submit before Oct 30, 11:45pm EDT.
6. **For Agent B:** `POST /api/verify` contract is stable; `frontend/` is yours. Backend files under `backend/` are Agent A–owned — flag issues here instead of editing them. Report contract gaps here, not by forking the API.
