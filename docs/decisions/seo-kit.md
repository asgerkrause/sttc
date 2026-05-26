# SEO kit (phased)

**Status:** active  
**Date:** 2026-05-25

## Context

Clones need autonomous search + answer-engine signals without hand-maintained sitemaps or per-page SEO files. Challenge picked **Kit 3 phased**; v1.2 ships baseline only.

## Options considered

1. **Runtime SEO** — rejected; static boilerplate, build-time only
2. **Hand-edited sitemap** — rejected; drifts, bad DX
3. **Phased build kit** — baseline now, content-aware + AEO later

## Chosen

**Phase 1 (v1.2):** `build/seo.ts` — `Organization` + `WebSite` + `WebPage` in JSON-LD; `dist/sitemap.xml`; `dist/robots.txt`; `bun run check` validates output.

**Phase 2 (v2):** `FAQPage` when route has FAQ markup; `Article`/`BlogPosting` for CMS **generated route** entries.

**Phase 3 (v2+):** `dist/llms.txt` from extended `site.json` (contact, `sameAs`, etc.).

## Why

Matches north star: ship speed (one `site.json` + build) + SEO/AEO depth without clutter. Editors never touch schema XML.

## Consequences

- All public **static route** slugs (except `404`) appear in sitemap
- `site.json` `url` must be production origin before deploy
- Phase 2+ tracked in `future-desires/todo.md`

## Links

- `docs/decisions/src-layout-and-seo.md`
- `.pi/domain.md` — **SEO kit** terms
