# Devpost copy — DRAFT, all claims verified live 2026-10-06 (update URLs before pasting)

## Title
StageCheck — cultural preflight for live entertainment

## Tagline
Don't guess what fits. Verify it against Qloo before you spend a dollar.

## Description
Every agent can generate a tour plan. No agent checks whether the plan's
cultural bets will land. StageCheck is the verification layer: submit an
already-proposed plan, and it tests each culturally dependent decision
against Qloo's taste graph before anyone executes it.

How it works:
1. **Decompose** — the plan becomes Decision Contracts (sponsor picks,
   openers, markets, venues), each naming the exact Qloo test that can
   evaluate it.
2. **Test** — the agent selects the right Qloo operation per decision:
   joint ranking, heatmap geography, trends, audience comparison, discovery.
   Alternatives are always scored together in one call, never by comparing
   numbers across unrelated calls.
3. **Verdict** — PASS, FAIL, REVIEW, or ABSTAIN. The system abstains when
   evidence is thin, entities don't resolve, or the comparison would be
   methodologically invalid — it never fills gaps with model knowledge.
4. **Repair + reverify** — only failed decisions are touched. Replacements
   come from Qloo and must pass their own joint re-ranking before entering
   the revised plan.
5. **Diff** — the final output is a before/after decision diff, with every
   name and number traceable to an append-only Evidence Ledger.

Real flagship, reproduced 3x live: a Taylor Swift stadium tour with
Liquid Death as pitched sponsor. Qloo joint ranking (Nike 0.88 >
Coca-Cola 0.84 > Liquid Death 0.64, one shared signal scale) FAILs the
pick by a 0.25 gap; the system replaces it with Nike and a fresh
re-ranking reverifies PASS. Nothing unresolved.

For agents too: TasteDiff is exposed as an MCP-compatible tool
(`tastediff_verify`), so any agent can preflight its own plan.

## Built with
Qloo Taste AI API (hackathon server), TypeScript, Fastify, React, Zod.
Deterministic engine: 38 automated tests, fixed-scenario evals, zero
unsupported-claim tolerance in CI.

## Links (fill before submit)
- Live demo: <RENDER URL HERE>
- Repo: https://github.com/Atharva12081/stagecheck
- Screenshots: docs/flagship-results.png, docs/flagship-diff.png
