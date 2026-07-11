---
name: snz-diagnose
description: Use when SANITIZE dev, build, check, doctor, content, media, or routing behavior fails or becomes confusing.
---
<!-- @snz-skill snz-diagnose 91351e361eb4d3ffb33267c56c248a7076a67fcf9226a6231d13f859f88bdd5d -->

# SANITIZE Diagnose

## Principle

Treat loud errors as the shortest path to the source defect. Reproduce first, follow the reported file, line, and hint, then make the smallest source correction.

## Workflow

1. Read `AGENTS.md` and run the exact failing command without broadening it.
2. Capture the complete error, including file, line, hint, and exit code.
3. Classify the owner: route, component/schema, CSS ownership, content/frontmatter, collection, image/media, site config, deployment config, or framework internals.
4. Inspect the reported source and its nearest valid example. Check recent diffs only when the source evidence is ambiguous.
5. State one falsifiable root-cause hypothesis. Do not stack speculative fixes.
6. Fix source only. Never edit `dist/` or store source in `.snz/`.
7. Re-run the exact failing command. Broaden verification only after it passes.

## Escalation

Escalate to framework internals only when reproduced evidence contradicts the emitted hint or the same valid source fails across a minimal fixture. Do not weaken strict validation to hide an authored typo or malformed record.

Stop and ask when the intended component, route, slug, asset, or content model is ambiguous. After two disproven hypotheses, reset the evidence instead of adding another patch.

## Evidence to return

- Reproduction command and exact failure class.
- Root cause tied to a source path and observed evidence.
- Minimal correction and rerun result.
- Any remaining uncertainty or reason for framework escalation.
