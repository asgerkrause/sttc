# Content model (PagesCMS hybrid B)

**Status:** active  
**Date:** 2026-05-25

## Context

Most clones use [Pages CMS](https://pagescms.org/) lightly: marketing shells in git, blog/insights in CMS. Challenge rejected posts-first (C) and pages-only (A).

## Options considered

1. **A — Pages only** — editors own almost all URLs; weak for fixed marketing IA
2. **B — Hybrid** — static `src/routes/` + CMS collections
3. **C — Posts-first** — too little agent-controlled structure for studio clones

## Chosen

**Hybrid B:**

| Source | Who | URLs |
| ------ | --- | ---- |
| `src/routes/` | dev/agent | home, about, contact, 404, … |
| `content/posts/` | client (PagesCMS) | `/insights/{slug}/` after content compile |
| `content/pages/` | client | `/{slug}/` long-tail routes after content compile |
| `src/site.json` | client via PagesCMS `type: file` | SEO defaults |

**Route templates** compile content at build time (`src/templates/post.html`, `src/templates/page.html`) — not one HTML file per post/page in `src/routes/`.

`.pages.yml`: `group` sidebar, `yaml-frontmatter`, `filename: "{primary}.md"`, split `media/images`.

## Why

Clean tree for agents; client-friendly editor (Insights + Site settings); router already supports nested paths (`/insights/foo/` → `dist/routes/insights/foo.html`).

## Consequences

- Build compiles `content/posts/` and `content/pages/` into generated route files.
- Dev watches `content/` and rebuilds on edits.
- Do not add per-post files under `src/routes/`.
- Markdown renders at build time through `build/markdown.ts`; unsafe HTML and unsafe URLs fail loudly.
- Current hardening work lives in GitHub issues: media path alignment, content safety, tag slugging, and source collision checks.

## Links

- `.pages.yml`
- `content/README.md`
- `docs/decisions/markdown-rendering.md`
