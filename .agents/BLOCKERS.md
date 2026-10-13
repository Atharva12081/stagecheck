# BLOCKERS

1. **[HUMAN OWNER] QLOO_API_KEY is unavailable in the current environment.** Archived October 6 screenshots show a prior LIVE run, but smoke, comparative benchmarking, and fresh flagship reproduction cannot be rerun now. Configure the key only as a server-side Render secret; never commit, log, or expose it to the frontend.
2. **Resolved:** the frontend visibly labels LIVE, SAMPLE DATA, and NOT CONFIGURED; sample output cannot be mistaken for current live evidence.
3. **Resolved:** sample fixtures are generic request echoes, and the live-only comparative benchmark refuses to run without `QLOO_API_KEY`.
4. **AI-use disclosure (if required by rules):** rules text reviewed 2026-10-04 shows no explicit AI-attribution clause, but owner + Agent B should confirm before submission and add any required disclosure to Devpost (not in code).
5. **Owner action required: deploy + verify + Devpost submit.**
   Deploy (5 min, Render free tier):
   1. https://dashboard.render.com → New + → Web Service → connect `Atharva12081/stagecheck` → runtime Docker (auto-detected via Dockerfile, `render.yaml` present).
   2. Environment → add `QLOO_API_KEY` = your hackathon key (Dashboard → Environment Variables; never commit it).
   3. Deploy → open `/api/health` (expect `qloo:"live"`) → run the default plan once → confirm FAIL Liquid Death → Nike PASS.
   Then run `npm run benchmark`, update `.agents/DEVPOST.md` only with actual output, and submit before Oct 30, 11:45pm EDT.
6. **For Agent B:** `POST /api/verify` contract is stable; `frontend/` is yours. Backend files under `backend/` are Agent A–owned — flag issues here instead of editing them. Report contract gaps here, not by forking the API.
