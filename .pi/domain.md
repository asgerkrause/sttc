# Domain language

Glossary for this codebase. **Terms only** — no implementation detail, no file paths, no stack choices.

Agents and humans use the same words here. Client product voice still lives in `BRAND.md` when present.

## Terms

| Term | Meaning |
| ---- | ------- |
| **Shell** | Persistent site chrome (header, nav, footer, global assets). Source: `shell.html`. Build writes `dist/index.html` for hosting. Not swapped on navigation. |
| **Route root** | `<main data-route-root>` in shell — router replaces its children with composed route HTML on navigation. Not a Web Component. |
| **Boilerplate** | Reusable starter for ultra-simple client sites. Per-project `BRAND.md` / copy added when cloning — not part of renderer setup. |
| **Route** | One public URL: file in `routes/{slug}.html`. Home = `routes/index.html` → `/` (not `home.html`). Body only — composes **components**, no shell chrome. |
| **Component** | Reusable HTML **part** in `components/` — a block inside a route section, not a `<section>` wrapper. Included at **build** time only — not a runtime registry. |
| **Part** | Same as **component** — emphasis that routes own `<section>` + `.container` + headings; components supply inner markup only. |
| **Link component** | Inline / cross-nav text link (`href`, `label`). Plain `<a>` styling. |
| **Button component** | Prominent CTA — still `<a>`, distinct presentation (e.g. `data-variant="button"`). Not a `<button>` element unless form submit later. |
| **Prose component** | Body copy block — `text` attr → `<p>`. For intro/blurb without raw `<p>` in routes. |
| **Card component** | Contained unit — `title`, `body`, optional nested `link`/`button` via attrs or composition in template. Demo pattern for stacking components. |
| **Component tag** | PascalCase void tag `<Button key="value" … />` → `components/Button.html`. Build substitutes `{{key}}` placeholders. |
| **Shell component** | Component used in **shell** source (header, footer). Composed at build into `dist/` shell — not swapped on client navigation. |
| **Site config** | `site.json` — single file for site name, URL, default description, locale, OG image. Merged into **seo** component at build. |
| **SEO component** | `components/seo.html` — emits title, meta, canonical, Open Graph, Twitter, JSON-LD. Defaults from **site config**; per-route attrs override. |
| **SEO component tag** | Optional `<SEO title="…" path="…" … />` in shell `<head>` or route top → `components/SEO.html`. **Omitted** → defaults from `site.json` + route slug. |
| **Route SEO defaults** | Derived at build: slug → `path`, title pattern `{Page} — {site.name}`, description from `site.json` unless `<SEO description="…" />` set. |
| **Renderer** | Build + dev pipeline: read `src/`, resolve `<component>` tags, write composed HTML to `dist/`. Dev watches sources and rebuilds. |
| **Source** | Author-edited tree under `src/` — not served directly. |
| **Output** | `dist/` — composed routes + shell + copied assets. Runtime reads only **output**. |
| **Content** | CMS-editable structured files (Markdown/JSON + frontmatter) under `content/`. Not served directly. Editors use PagesCMS (or similar), not route HTML. |
| **Content compile** | Build step: **content** + route templates → composed **route** HTML in **output**. Keeps **component** tags in templates, not in CMS fields. |
| **Router** | Client framework at repo root `router.js` — nav, head merge, 404, `snz:page`, `html[data-page]`. Copied to **output**; do not edit per clone except via upstream boilerplate updates. |
| **Site hook** | `src/assets/js/app.js` — project-owned client code only. Boilerplate ships empty; all framework behavior in **router**. |
| **Disclosure control** | Interactive control with `aria-controls` + `aria-expanded` pointing at a target `id` (usually `<button>`). Not a component — author markup only. |
| **Framework behaviors** | Small delegated runtime (ships with **router**) that wires standard ARIA pairs (e.g. toggle **disclosure control**). No PascalCase component required. |
| **Examples** | Non-shipping demo routes/components for copy-paste. Not part of default clone surface. |
| **Agent playbook** | Repo `AGENTS.md` — how to work the boilerplate (components, build, constraints). Terse, obvious steps; studio craft tone for agents only. |
| **Stylesheet** | `src/assets/css/styles.css` — minimal base CSS only. Shell links once; per-project styling grows here or via `html[data-page]`. |
| **Component stylesheet** | Optional sibling `components/{Name}.css` — build concatenates/minifies into shell `<head>`; global tokens stay in **stylesheet**. |
| **PagesCMS config** | Repo-root `.pages.yml` — defines **content** collection paths and **media** `input`/`output` for editors ([Pages CMS](https://pagescms.org/docs/configuration/)). |
| **Media folder** | Git folder where CMS uploads land (`media/` or path from **PagesCMS config** `media.input`). Build ingests into optimized assets in **output** — not served raw. |
| **Static route** | **Route** authored in `src/routes/` — layout/marketing shells; not generated from **content**. |
| **Generated route** | **Route** emitted by **content compile** from `content/{collection}/` — e.g. blog post, team member. |
| **Image encode** | Build-time `Bun.Image` resize/webp; optional per-**Image** attrs `quality`, `max` for heavy **media folder** uploads. |
| **SEO kit** | Autonomous build outputs for search + answer engines: baseline graph, sitemap, robots, optional AEO files. Phased — not all in v1.1. |
| **SEO kit baseline** | **SEO kit** phase 1: `Organization` + `WebSite` + per-route `WebPage`; `sitemap.xml`; `robots.txt`; canonical/OG from **site config**. |
| **SEO kit content** | **SEO kit** phase 2: add `FAQPage` when route has FAQ markup; `Article`/`BlogPosting` for **generated route** CMS entries. |
| **SEO kit AEO** | **SEO kit** phase 3: root `llms.txt` + extended **site config** (`organization`, `sameAs`, contact) for LLM/crawler discovery. |
| **AEO** | Answer-engine optimization — machine-readable facts (schema, `llms.txt`, clear Q&A) so AI systems can cite the site accurately. |
| **GEO** | Generative-engine optimization — same practical goal as **AEO** in this boilerplate; both served by **SEO kit** + honest page copy. |
| **Build check** | `bun run check` — post-build validation (routes, SEO graph, broken refs, component attrs). DX guardrail; not a test suite. |
| **Content model B** | Hybrid PagesCMS: **static route** shells in `src/routes/`; **posts** collection → **generated route** under `/insights/{slug}/`; optional **pages** collection for long-tail. |
| **Route template** | Single HTML skeleton for **content compile** (e.g. `src/templates/post.html`) — not one file per CMS entry in `src/routes/`. |
| **PagesCMS group** | `type: group` in `.pages.yml` — sidebar bucket only; no extra files. |

## Related

- Engineering decisions: `docs/decisions/`
- Session scratch (ephemeral): `.pi/scratch/` (gitignored)
