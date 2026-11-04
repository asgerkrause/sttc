# SNZ performance benchmarks

Dependency-free Bun benchmarks for the renderer live here. Generated fixtures and raw results belong under `.snz/benchmarks/` and must not be committed.

Public performance claims are limited to the tested tools, pinned versions, fixtures, machines, and metrics. Freeze methodology before measured runs, validate equivalent output, include process startup and production checks, publish every raw sample and invalidation reason, and never remove outliers silently.

Internal runs cover clean builds, route/component scaling, content scaling, media copying, CPU time, peak RSS, and output bytes. `warm` means a repeated complete atomic build with normal prior output/cache state retained; `route-edit` changes one route before each complete rebuild. Neither name implies incremental rendering. Category runs require separate approval to install peers and controlled Linux x64 and arm64 hosts.

A category-leading claim requires 30 valid randomized samples per cell, correct output for every peer, SNZ fastest in every claimed cell, and a bootstrap 95% confidence interval for `SNZ / next-best` below `0.95`, followed by independent reproduction.

```bash
bun framework/benchmarks/bench.ts validate
bun framework/benchmarks/bench.ts internal --scenario routes --mode clean --scale 100 --warmups 5 --samples 30
bun framework/benchmarks/bench.ts internal --scenario routes --mode warm --scale 100 --warmups 5 --samples 30
bun framework/benchmarks/bench.ts internal --scenario routes --mode route-edit --scale 100 --warmups 5 --samples 30
bun framework/benchmarks/bench.ts category --dry-run
```

## Agent task evaluation

[Agent task protocol](./agent-tasks.md) defines eight fixed tasks, matched outcomes across STTC/Astro/plain HTML, budgets, fresh sessions, retained failures and separate human review. [Result schema](./agent-results.schema.json) distinguishes observations, unknown measurements and not-run work. Renderer performance sample thresholds above are not agent-study statistical justification.

`bun test framework/tests/agent-eval.test.ts` validates one bounded broken-link grader against actual generated good/bad STTC artifacts. Evidence remains in `.snz/benchmarks/agent-tasks/`. This is grader validation, not measured AI productivity; no comparative agent trials have run. See the protocol for preparing a fresh attempt and the remaining baseline/grader work before comparison.
