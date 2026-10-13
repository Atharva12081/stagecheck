# Comparative evaluation

`npm run benchmark` is the live-only comparison requested for StageCheck. It
refuses sample fixtures and exits unless `QLOO_API_KEY` is set. The scenario
set is committed before execution and excludes the flagship.

The benchmark compares StageCheck with a one-shot Qloo ranking baseline. Two
fresh, uncached Qloo repeats provide a separate reference label. A proposed
choice is "underperforming" only if both repeats exceed the FAIL threshold and
"acceptable" only if both are within the PASS threshold; unstable middle cases
are reported as uncertain and excluded from those metric denominators.

Run a bounded evaluation (five scenarios by default):

```bash
cd backend
QLOO_API_KEY=... npm run benchmark
```

Set `BENCHMARK_MAX_SCENARIOS=3` to lower the call budget. Output is JSON and
includes every denominator, per-scenario failure, Qloo-call count, and latency.
The labels are Qloo-relative consistency checks, not commercial outcomes,
revenue predictions, causal effects, or statistically significant real-world
ground truth. The LLM-only baseline is explicitly `not_run` until a model
adapter is configured; the runner never invents its output.
