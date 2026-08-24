# Deployment

Build output is static files in `dist/`. Never edit `dist/`; rebuild from source.

## Build contract

Use Bun:

```bash
bun install
bun run build
```

Deploy settings:

| Setting | Value |
| --- | --- |
| Build command | `bun run build` |
| Output directory | `dist` |
| Dev command | `bun run dev` |
| Install command | `bun install` |
| Runtime | Bun `>= 1.4.0` |

## Vercel

Project includes Vercel config:

```json
{
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "devCommand": "bun run dev",
  "outputDirectory": "dist",
  "bunVersion": "1.x",
  "cleanUrls": true,
  "trailingSlash": true
}
```

Header defaults:

- `/assets/*` gets long immutable cache headers
- discovery files such as `llms.txt`, `robots.txt`, and `sitemap.xml` get short cache headers

Static sites remain static by default. No Vercel Functions or Middleware are enabled by framework defaults.

## Analytics and Speed Insights

`src/site.json` may include Vercel intent flags:

```json
{
  "vercel": {
    "analytics": true,
    "speedInsights": true
  }
}
```

These flags do not inject scripts. Enable Vercel features per client project and wire required scripts/packages explicitly.

`track="Event name"` on components compiles to `data-snz-track`. Runtime calls Vercel Analytics when `window.va` exists; otherwise it emits `snz:track`.

## Environment variables

Only `PUBLIC_*` variables are inlined into browser code.

Do not expose secrets through `PUBLIC_*`. Keep private provider keys in hosting integration settings or server-side systems outside the static site.

## Pre-deploy checks

Run:

```bash
bun run check
bun run doctor -- --launch
```

Measure Lighthouse against `bun run preview` or the deployed origin. `bun run dev` injects HMR and does not gzip or cache; it is the wrong target.

Fix source files, not generated output.

Launch mode may fail starter placeholder config until `src/site.json` contains production values.

## Static handoff

If handing off files instead of deploying from git, provide:

- source repo
- Bun version requirement
- build command: `bun run build`
- output directory: `dist`
- required `PUBLIC_*` env vars, if any
- hosting notes for forms/analytics/third-party scripts

## S3/R2-compatible hosting

Dedicated S3 deploy adapter is deferred. Current path: build locally or in CI, then upload `dist/` with hosting-specific tooling.

Cache policy should match framework intent:

- long immutable cache for hashed assets
- short cache or normal revalidation for HTML and discovery files

Never print or commit deploy credentials.

## Next

[Forms and embeds](./12-forms-and-embeds.md) · [Docs home](./README.md) · [Launch checks](./14-launch-checks.md)
