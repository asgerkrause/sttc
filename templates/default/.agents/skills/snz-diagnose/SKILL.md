---
name: snz-diagnose
description: Use when SANITIZE dev, build, check, doctor, content, media, routing, or optional style compilation fails.
---
<!-- @snz-skill snz-diagnose 57d870fd7aef910b3e08ae1e9021f9faa3209494a204d6594fd4d65fbb1853bd -->

# SANITIZE Diagnose

## Principle

Reproduce first, follow the reported source file, line, and hint, then make the smallest source correction.

## Workflow

1. Read `AGENTS.md` and run the exact failing command.
2. Capture the complete error and exit code.
3. Classify the owner: route, component/schema, optional CSS, content/frontmatter, collection, media, site config, deployment, or renderer internals.
4. Inspect the reported source and nearest valid example.
5. State one falsifiable cause. Do not stack speculative fixes.
6. Fix source only; never edit `dist/` or store source in `.snz/`.
7. Rerun the exact failure, then broaden verification after it passes.

Escalate to renderer internals only when valid minimal source reproduces behavior that contradicts the documented contract. Never weaken validation to hide malformed authored input.

## Evidence

Return reproduction, supported cause, minimal correction, rerun result, and remaining uncertainty.
