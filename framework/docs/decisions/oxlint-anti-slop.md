# Oxlint and anti-slop

**Status:** active
**Date:** 2026-11-18

## Decision

Lint the repository with Oxlint and a local copy of the anti-slop plugin in `tools/oxlint/anti-slop/`. `bun run lint` runs `oxlint --deny-warnings` with `.oxlintrc.json`. CI and `framework:verify` run it. The plugin is a development tool. It is not in the published package and created sites do not get it.

Eleven of the plugin's fifteen rules are enabled at `error`. Four are not enabled yet:

- `no-runtime-typeof`
- `no-unknown-parameters`
- `no-unsafe-dictionary-type`
- `require-safety-comment-for-type-assertion`

## Why

When adopted, those four rules reported 234 findings. Most were in the hand-written readers for `site.json`, front matter, content records, and component data. Those readers check `unknown` input with `typeof` and then assert a type. The rules want each input decoded into a typed value at its boundary instead.

That conversion changes the input layer of the renderer. It must keep the current build errors, which name the file, the line, and a fix. The conversion goes one input at a time, without a new runtime dependency.

## Progress

- `site.json` is converted. `framework/build/site-config.ts` decodes it into a `SiteConfig` with no type assertions, and `framework/build/json.ts` holds the shared `Json` type and guards. All four rules are enabled for those two files through `overrides` in `.oxlintrc.json`. `no-runtime-typeof` there uses `allowInTypeGuards`, so `typeof` appears only inside `value is T` guards. Every error the old parser reported keeps its message, hint, file, and line. The decoder also rejects unknown keys and checks the fields the old parser passed through unchecked.
- Next: front matter and content records, then component and route data.

## Revisit when

- An input is converted to a typed decoder with identical error messages. Then add its files to the `overrides` entry.
- All inputs are converted. Then enable the four rules for the whole repository and remove this exception.

## Verification

```bash
bun run lint
bun run framework:verify
```
