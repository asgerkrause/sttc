# SEO kit (phased)

**Status:** active  
**Date:** 2026-05-25

## Context

Clones need autonomous search + answer-engine signals without hand-maintained sitemaps or per-page SEO files. Build now ships baseline SEO plus content-aware discovery artifacts.

## Options considered

1. **Runtime SEO** — rejected; static boilerplate, build-time only
2. **Hand-edited sitemap** — rejected; drifts, bad DX
3. **Phased build kit** — baseline first, then content-aware discovery and richer AEO/GEO fields

## Chosen

**Shipped:** `build/seo.ts` + `build/discovery.ts` emit `Organization`, `WebSite`, `WebPage`, FAQ-style component schemas, `BlogPosting` for CMS posts, `sitemap.xml`, `robots.txt`, feeds, `llms.txt`, `llms-full.txt`, `site.manifest.json`, route JSON, and ai-plugin metadata. Manifest and route JSON include `schemaVersion` plus structured generator metadata. `bun run check` validates required discovery output.

**Next:** extend `site.json` with richer organization/contact/topic fields.

## Why

Matches north star: ship speed (one `site.json` + build) + SEO/AEO depth without clutter. Editors never touch schema XML.

## Consequences

- All public route slugs (except `404`) appear in sitemap, including generated content routes.
- `site.json` `url` must be production origin before deploy.
- Richer AEO/GEO fields are tracked in GitHub issues.
- Manifest consumers can branch on `schemaVersion` and generator metadata instead of guessing output shape.

## Links

- `docs/decisions/src-layout-and-seo.md`
- `.pi/domain.md` — **SEO kit** terms
