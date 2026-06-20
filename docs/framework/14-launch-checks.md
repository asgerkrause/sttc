# Launch checks

Use launch checks before deploy, client preview, or static handoff.

## Commands

Minimum:

```bash
bun run check
```

Pre-launch:

```bash
bun run doctor -- --launch
```

Use `bun run doctor` when CSS ownership changed. It runs CSS audit plus strict check.

## What launch mode checks

`bun run doctor -- --launch` keeps normal strict checks, then adds launch readiness checks.

Site config:

- `src/site.json.url` is public HTTPS
- no localhost, private, `.local`, or example URLs
- `src/site.json.ogImage` exists as configured value

Routes and content:

- private URLs absent from HTML/JSON output
- draft content not emitted in production output
- route titles present and unique
- route descriptions reviewed; duplicates warn
- H1 and route semantics checked
- image `alt` text present
- icon-only links have accessible names
- vague link text warns

Discovery:

- `llms.txt`
- `llms-full.txt`
- `site.manifest.json`
- `.well-known/ai-plugin.json`
- manifest has routes and components arrays

Warnings are not automatic blockers, but require human review.

## Manual launch checklist

- [ ] `src/site.json` has final `name`, `url`, `description`, `locale`, and `ogImage`.
- [ ] Home page exists.
- [ ] 404 page exists.
- [ ] Key pages exist under `src/pages/` or content routes.
- [ ] Navigation links resolve.
- [ ] Forms post to real endpoint or are replaced with contact links.
- [ ] Third-party embeds use provider embed URLs and accessible `title` text.
- [ ] Images have useful `alt`; decorative images use `alt=""`.
- [ ] Above-fold images use `loading="eager"` only when needed.
- [ ] Page titles and descriptions are intentional.
- [ ] No component CSS leaked into global CSS.
- [ ] Analytics/Speed Insights are explicitly wired if requested.
- [ ] Deploy config uses `bun run build` and `dist`.
- [ ] `bun run doctor -- --launch` passes or warnings are documented.

## Failure handling

Fix source files:

- routes in `src/pages/`
- components in `src/components/`
- styles in `src/styles.css` or `src/styles/*`
- content in `content/`
- templates in `src/templates/`
- site metadata in `src/site.json`

Do not edit `dist/`.

## Evidence to keep

For launch handoff, record:

```txt
bun run check
bun run doctor -- --launch
```

Include command results and any reviewed warnings.

## Next

[Deployment](./13-deployment.md) · [Docs home](./README.md) · [Agent workflow](./15-agent-workflow.md)
