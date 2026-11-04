# Agent task protocol v1

Status: protocol and local grader validation only. No measured agent trial, Astro/plain-HTML baseline, comparative result, or model spending is supplied here. Renderer timing thresholds in README do not apply to agent evaluations.

## Freeze before running

Use only synthetic “North Studio” content and local assets. Prepare equivalent three-route starting sites (`/`, `/work/`, `/about/`) with the same copy, navigation, visual brief and output contracts. Freeze and hash each source fixture, assets, accepted reference images, task prompt, grader and documentation bundle. Manually build and check each baseline first. Each task starts from its own clean fixture, never another task's solution. The bounded repair validator below uses a separate two-route fixture.

Compare STTC, Astro and plain HTML by the same user outcome. STTC may use its components/content pipeline; Astro may use its corresponding native features. Plain HTML must include a predeclared small build script for shared reuse/editorial records, or be marked incapable for those tasks. Count script setup and maintenance separately; do not excuse missing behavior. Freeze dependencies and baseline scripts before runs. No dependency installation or adapter implementation is authorized by this document.

Every stack receives its frozen local official docs and baseline source, equal search/tool permissions and the same machine class. Record docs actually consulted, documentation availability and errors. Do not expose reference solutions, prior transcripts or grader implementation to measured agents. Keep acceptance requirements visible. Differences in docs, scripts and training familiarity are workflow confounds, not isolated syntax effects.

## Eight fixed tasks

All tasks require baseline routes/content to survive, a clean build and emitted-artifact checks. Freeze literal copy and assets in the fixture bundle; the table's labels and behaviors are mandatory, not suggestions. Human review remains separate from objective acceptance.

| ID | Brief and common acceptance | Agent cap |
| --- | --- | --- |
| `branded-page` | Add `/services/` for North Studio with heading “Design that lasts”, intro, three named services (Identity, Websites, Editorial) and “View our work” link to `/work/`. Use supplied palette/type brief. At 390 and 1440 px: no horizontal overflow, legible hierarchy, working links, one h1. Human reviews design and copy separately. | 20 min / 80 tool calls |
| `component-reuse` | Add the same service card to all three routes from one shared source. Grader changes shared heading “Identity” to “Brand identity”, rebuilds, and sees change on all three; body/link remain correct. Duplicated authored copies fail even if visually identical. | 15 min / 60 calls |
| `navigation` | Add “Services” linking to existing `/services/` in shared site navigation on every route. Keyboard traversal reaches it; direct load, click, back and forward work; no dead links or duplicate nav item. | 10 min / 40 calls |
| `responsive-image` | Place supplied 1600×1000 synthetic master on `/work/` with alt “Blue geometric study”. Output dimensions preserve ratio, at least two real responsive candidates exist, browser selects appropriate candidate at frozen 390/1440 px DPR 1, no overflow or broken resource. Do not merely change `srcset` text. | 20 min / 80 calls |
| `editorial-record` | Add one authorable record “A quieter web”, date `2026-01-15`, supplied description/body to `/journal/a-quieter-web/`; list it on `/journal/`. Changing only record title updates both outputs after rebuild; draft record stays unpublished. Same authoring behavior required across stacks. | 20 min / 80 calls |
| `broken-link` | Repair home “Read Page 1” link to existing Page 1 without deleting label, target, or other content. Clean build; rendered href `/page-0001/` resolves to Page 1; `/missing/` absent. Local pilot below implements this task. | 10 min / 40 calls |
| `accessible-disclosure` | Add “Project details” disclosure containing “Made for people.” Keyboard Enter/Space toggles, state exposed to accessibility tree, focus visible, collapsed content absent from traversal, no focus trap. Native details/summary is allowed. For a custom overlay, Escape closes and returns focus. Verify real browser behavior with reduced motion and baseline navigation. | 20 min / 80 calls |
| `build-error` | Fix one seeded source syntax defect in baseline build input, retaining original content/behavior. Each stack baseline includes a demonstrably parsed source (HTML-only script must validate its input). Diagnostic identifies source; original build fails, repaired build and output checks pass. Do not disable validation or remove failing source. | 10 min / 40 calls |

Budgets are protocol ceilings, not spending authorization. Stop at either cap; agent self-correction within cap is allowed. Use the same cap per task for every stack. Record actual authorized spend limit and stop there too; absent authorization means no paid run. Separately cap human correction at 15 active minutes per artifact, sequentially, saving unresolved/time-capped results. Record waiting time in evidence, not as active correction. Do not change budgets after observing outcomes.

## Sessions, evidence and reporting

Before any comparison, preregister trial count, random seed and complete shuffled task/stack/repetition order in the evidence bundle. Use fresh isolated checkout and fresh agent session per attempt, no solution memory. Pin full source revision plus dirty patch/source hashes, fixture version/hash, OS/architecture, Bun, framework and dependency lock versions, model identifier/date, reasoning effort, service tier, sampling settings when exposed, harness/system prompt, tool versions/permissions, task prompt, docs hashes and budgets. Store extra settings in a referenced manifest; schema `settings` holds identifiers/paths to it. Unknown provider settings remain explicitly unknown. Changed configuration starts a new cohort.

Keep every attempted run, timeout, failure, transcript, tool error, command/log, artifact and invalidation reason. A tool/network failure is infrastructure-invalid only under the frozen rule, with evidence; preserve it even if replaced. Never remove an inconvenient failure or silently retry. Repeated trials are useful, but no fixed count here establishes statistical confidence. Randomization and repetition are coordinator work still to be performed.

Freeze agent artifact before human rescue. Count every hint/rescue and each human edit session, including interventions that fail. Record agent time separately from reviewer time and correction time, and retain before/after snapshots. Primary report: objective acceptance without intervention, numerator/denominator per task/stack. Also report acceptance after rescue, unresolved repairs and capped correction effort. Tokens and cost come only from actual provider/harness measurements; unavailable is `null`, not estimated zero. A build exit of zero alone never proves acceptance.

Design and content reviewers use frozen rubric independently of objective checks: brief fidelity, hierarchy/readability at both viewports, copy accuracy/completeness. Blind rendered stack identity where practical. Retain reviewer disagreements, familiarity, reasons and adjudication; do not relabel an objective failure because it looks good. Human review is still review time when no edits are needed. Schema allows `not-run` review; never count that as quality approval.

Report task-specific observations only. No universal superiority, causal grammar claim, invented confidence interval or extrapolated reliability. If a task cannot be made equivalent, disclose and exclude it from aggregate comparison. Training familiarity, model drift, small samples, fixture representativeness and reviewer expertise remain unknowns. Improve one observed repeated failure, then rerun affected tasks and a held-out variant under matched conditions. Version protocol/grader changes and rescore saved artifacts or rerun all affected stacks.

## Bounded local grader validation

```sh
bun test framework/tests/agent-eval.test.ts
```

This test creates fresh synthetic STTC sites under `.snz/benchmarks/agent-tasks/`. It reuses `createFixture` and `validateFixture` from `bench.ts` without changing performance benchmarks. It builds styled broken output using `--allow-broken-links` solely to challenge independent literal link/target checks. Exit zero must still grade fail. It then checks ordinary build failure, repairs actual source href and rebuilds normally: all checks must pass. Missing output must fail. Saved failures, sources, generated output, stdout, stderr, command/exit evidence and results remain on disk, including test failures. Existing validator also checks route inventories/representations. This is a narrow link grader, not a general accessibility/design grader or adversarial-agent sandbox.

Each invocation retains a unique `evidence-*` directory with `result.json`. Results use `kind: grader-validation`, null model/token/cost/agent-time values, and `not-run` human reviews. Deterministic test repair is setup, not measured human correction. No AI success measurement is inferred. The schema is in `agent-results.schema.json`; tests exercise its current vocabulary against observed results, malformed fields, negative cost, missing fields and truncated JSON without a dependency. The test helper is not a general JSON Schema implementation. Schema validates shape, not truth: coordinator must verify evidence, required task checks, budget/settings completeness and outcome consistency before admitting an agent trial.

## Fresh agent handoff (not yet run)

Coordinator prepares a new fixture:

```sh
bun framework/benchmarks/agent-eval.ts prepare
```

Command prints a new fixture path. Save starting source hash; copy only fixture `src/` to an isolated task directory with no prior evidence, test code or solutions. Supply fixed framework executable path/version and local STTC docs as read-only resources; give write access only to fixture source. Do not grant access to this shared checkout. Use the existing approved harness/model; no API client is included here.

Exact task prompt (substitute paths before freezing):

> Repair the home-page “Read Page 1” link so it opens the existing Page 1 route at `/page-0001/`. Preserve all headings, cards, styles and existing routes. Edit source only in `<fixture>/src/`; do not edit generated output, framework or checks. Build with `bun <framework>/framework/build/index.ts` from `<fixture>`. Use the supplied local documentation. Stop after 10 minutes or 40 tool calls, whichever comes first, and report changed files and checks. No dependency installs, external network, delegates or human hints.

After stopping, freeze source and transcript. Coordinator grades from the pinned framework checkout:

```sh
bun framework/benchmarks/agent-eval.ts grade <fixture>
```

This writes new evidence, rebuilds and returns nonzero unless build and artifact checks pass. The emitted record remains **grader-validation**, even when pointed at an agent artifact: coordinator must create a separate `agent-trial` observation referencing it, filling actual session/settings/effort/interventions and human review. Do not relabel local self-check records as agent attempts. Finish missing design/content review separately. This command covers only broken-link objective acceptance; preservation of every card/style and source-scope constraints requires frozen source diff review. Other seven task graders and Astro/plain-HTML fixtures are deliberately not implemented; comparison waits for equivalent baselines and calibrated acceptance.

Raw evidence stays ignored/local. Review synthetic logs, paths, media and archives before any sharing; `.snz` ignore rules do not sanitize uploads. No client data, credentials or production material belongs in these fixtures.
