# StageCheck judge walkthrough

## The 15-second idea

Other agents recommend plans. StageCheck verifies an existing plan, changes
only a failed decision, and requires a fresh PASS before a replacement enters
the revised plan.

## 90-second demo

1. Open the public demo and point out the **LIVE** status. If the status is
   SAMPLE or NOT CONFIGURED, stop: that run is not Qloo evidence.
2. Run the default hypothetical tour plan.
3. Show the market decision retained as **REVIEW**. StageCheck does not force a
   confident conclusion from a near tie.
4. Show the sponsor decision: Liquid Death **FAIL**, followed by the proposed
   Nike repair and its separate **PASS** reverification.
5. Expand the evidence ledger so the judge can see the Qloo outputs and the
   deterministic verdict calculation.
6. Open **View Diff**. Taylor Swift is preserved; only the failed sponsor is
   changed.
7. Explain the safety behavior: unknown entities, insufficient comparison
   candidates, Qloo errors, and unsupported questions abstain instead of being
   filled with model guesses.

## Reproducibility

```bash
cd backend
npm ci
npm test
npm run build
npm run eval
QLOO_API_KEY=... npm run benchmark
```

The fixed regression evaluation is not a real-world performance benchmark.
The live comparative benchmark uses two fresh Qloo repeats as a Qloo-relative
reference, reports uncertain cases separately, and makes no revenue or causal
claim.

## Evidence status

`flagship-results.png` and `flagship-diff.png` were captured from a run visibly
labeled LIVE on October 6, 2026. They are historical evidence. Before the
Devpost deadline, rerun the exact default plan on the final public deployment,
confirm the result still reproduces, and replace the screenshots if Qloo's
current response changes.

## Owner gate before submission

- Public URL returns HTTP 200 and `/api/health` reports `qloo: "live"`.
- Default workflow completes on desktop and mobile without authentication.
- Fresh flagship outcome matches the copy and screenshots; otherwise update
  all three truthfully.
- Live benchmark JSON is saved with its denominators and failures.
- GitHub Actions is green on the submitted commit.
- Devpost contains the working demo URL, public repository URL, accurate copy,
  screenshots, and the owner's required eligibility/rights attestations.
