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
| `content/posts/` | client (PagesCMS) | `/insights/{slug}/` after **content compile** (v2) |
| `content/pages/` | client | `/{slug}/` long-tail (v2) |
| `src/site.json` | client via PagesCMS `type: file` | SEO defaults |

**One route template** at compile time (`src/templates/post.html` in v2) — not one HTML file per post in `src/routes/`.

`.pages.yml`: `group` sidebar, `yaml-frontmatter`, `filename: "{primary}.md"`, split `media/images`.

## Why

Clean tree for agents; client-friendly editor (Insights + Site settings); router already supports nested paths (`/insights/foo/` → `dist/routes/insights/foo.html`).

## Consequences

- v1.2: CMS folders + config exist; **build ignores** `content/` until v2
- Do not add per-post files under `src/routes/`
- Compile contract in `future-desires/todo.md`

## Links

- `.pages.yml`
- `content/README.md`
