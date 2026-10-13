# Devpost copy — DRAFT (rerun live evidence and update URLs before submission)

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

Archived flagship evidence captured from runs visibly labeled LIVE on October
6, 2026 (hypothetical planning scenario; no affiliation, endorsement, or
actual sponsorship implied): a Taylor Swift stadium tour with
Liquid Death as pitched sponsor. Qloo joint ranking (Nike 0.88 >
Coca-Cola 0.84 > Liquid Death 0.64, one shared signal scale, gap ≈0.25) FAILs the
pick by a 0.25 gap; the system replaces it with Nike and a fresh
re-ranking reverifies PASS. The sponsor intervention is fully repaired and
reverified; the independent market check remains REVIEW (the tested markets
are effectively tied, so the system preserves that uncertainty rather than
forcing a verdict). No decision is left silently unhandled.

Before submission, these values must be rerun on the final public deployment.
If current Qloo evidence differs, this paragraph and the screenshots must be
updated rather than preserving the old outcome.

For agents too: TasteDiff is exposed as an MCP-compatible tool
(`tastediff_verify`), so any agent can preflight its own plan.

## Built with
Qloo Taste AI API (hackathon server), TypeScript, Fastify, React, Zod.
Deterministic engine: 42 automated tests; fixed regression evaluation at 6/6
tool-selection checks, 1/1 expected abstention, 2/2 reverified repairs, and 0
claim violations. A separate live-only comparative runner reports StageCheck
against one-shot Qloo ranking with explicit denominators and uncertainty; add
its actual output here only after running it with the final server-side key.

## Links (fill before submit)
- Live demo: <RENDER URL HERE>
- Repo: https://github.com/Atharva12081/stagecheck
- Screenshots: docs/flagship-results.png, docs/flagship-diff.png
- Reproduction: docs/JUDGE_WALKTHROUGH.md
