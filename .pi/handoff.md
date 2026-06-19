# Handoff

Single entry point for `/plan` and `/implement`. Update after `/prd` and `/challenge`.

## Summary

**Boilerplate renderer** for ultra-simple client sites. `src/` → build → `dist/`. Components (not blocks), `site.json` SEO, fixed 404 fetch. No brand workflow in this repo.

## PRD

- Path: `.pi/prd/{{slug}}.md`
- Status: draft | ready

## Domain language (delta)

- **PascalCase components** (`<Button />`, `components/Button.html`, `SEO.html`)
- Demo components: **link**, **button**, **prose**, **card**
- **Route SEO defaults** when `<component seo />` omitted (slug + `site.json`)
- Delete stale root `routes/`, `blocks/`, `assets/` (empty); keep `docs/decisions/`

## Decisions (delta)

- `docs/decisions/src-layout-and-seo.md` — src/dist split, SEO from site.json

## Challenge settled (2026-05-23)

- **PagesCMS:** `content/` (structured) → **content compile** → routes. Optional `.pages.yml` per clone. `site.json` may mirror CMS settings or stay build-only.
- **Clone surface:** minimal routes; **route components** ship in `src/components/` (Button, Link, Prose, Card + shell). `examples/` = extra patterns only.
- **Client JS:** framework in root `router.js` (incl. `html[data-page]`). `src/assets/js/app.js` = empty **site hook**.
- **Docs:** `README.md` = human quickstart. `AGENTS.md` = agent playbook — how to use/build **components**, folder rules, commands; **max simplicity** (caveman-clear, Karpathy-direct, SNZ craft — not client `BRAND` voice).
- **Content compile:** phase 2 (v1 = HTML routes only; README notes future `content/` + PagesCMS).
- **CSS:** keep minimal reset/layout in `src/assets/css/styles.css` (rename from `main.css`). Shell links it. User extends later — no strip.
- **Dev watch:** watch `src/assets/` in `dev.ts`; add `content/` when phase 2 lands.

## Challenge settled (2026-05-25) — v2 roadmap

| Area | Choice |
| ---- | ------ |
| **Pain priority** | Styling (A) + assets (C) + DX (D); CMS significant |
| **CSS** | Hybrid (**4**): global tokens + `styles.css`; optional `components/{Name}.css` → build bundles into shell `<head>` |
| **Images** | Bun.Image encode + optional `<Image quality max />`; warn on huge masters (**3**) |
| **CMS media** | Hybrid (**4**): read `.pages.yml` `media.input` (repo folder); remote URL ingest later |
| **CMS copy** | Hybrid (**3**): hand `src/routes/` for marketing shells; `content/` collections → generated routes ([PagesCMS](https://pagescms.org/docs/configuration/) — `.pages.yml`, `content/`, `media/`) |
| **Clone bar** | **D**: starter `.pages.yml`, `content/`, `media/`, README deploy path, `bun run check` when added. **E** deferred — optional single-job `bun run build` later |

**Build order (proposed):**

1. **v1.1** — component CSS bundle; image `quality`/`max`; clone skeleton (`content/`, `media/`, `.pages.yml` stub)
2. **v2** — content compile (PagesCMS collections → routes); media ingest from `.pages.yml` paths
3. **v2+** — remote media adapter; CI workflow if regressions hurt

## v1.2 shipped (2026-05-25)

- `build/seo.ts`, `build/check.ts`, `.pages.yml`, decision docs, `future-desires/todo.md`
- Commands: `bun run build`, `bun run check`

## Challenge settled (2026-05-25) — boilerplate strength

**North star (user):** **A** ship speed + **C** SEO/schema/AEO/GEO (max autonomous). PagesCMS on most clones — **light** setups (not enterprise CMS). **DX:** minimal files, no clutter.

**SEO kit (settled):** **Kit 3 phased** — baseline → content-aware → AEO (`llms.txt`). User defers to studio recommendation.

**Content model (settled):** **B hybrid** — static `src/routes/` + CMS `posts` → `/insights/{slug}/`; optional `pages` long-tail. One **route template**; no per-post route files. PagesCMS: [configuration](https://pagescms.org/docs/configuration/), [media](https://pagescms.org/docs/configuration/media/), [content](https://pagescms.org/docs/configuration/content/).

## Current handoff (2026-06-19)

Repo moved from `/Users/krause/Downloads/dev/snz-renderer` to `/Users/krause/GitHub/snz-bp`. Old Downloads folder was deleted after fresh clone verification.

Latest pushed baseline:

- GitHub: `sanitizestudio/snz-bp`, `main`, tip `142bc50`.
- Fresh clone verification passed: `bun install`, `bun run doctor`, `bun test` (`92 pass`).
- Added Bun/TypeScript baseline: `tsconfig.json`, `typecheck`, `@types/bun`, `typescript`, lockfile.
- Added Vercel adapter defaults: root/template `vercel.json`, cache headers, Bun build/output config.
- Added `track="Event name"` component attr → `data-snz-track`, runtime `snz.track()`, click delegation, `snz:track` fallback.
- Added dev server `idleTimeout: 255` to quiet Bun SSE timeout noise.
- Removed accidental `node_modules` commit with follow-up commit; HEAD has no tracked `node_modules`.

Next sensible work:

1. Decide whether to enable Vercel Analytics/Speed Insights injection from `site.json.vercel` or keep docs-only for now.
2. Harden PagesCMS: generated/synced `.pages.yml`, media output checks, clearer content/frontmatter errors.
3. Add Vercel checks to `snz-bp doctor`: validate `vercel.json`, output dir, build command, Bun version, analytics package/flags.
4. Later: consider `noUncheckedIndexedAccess: true` after fixing indexed access assumptions across build/tests.

## Open questions

- Should `site.json.vercel.analytics` inject Vercel analytics automatically, or stay advisory until package/deploy setup is explicit?
- Should Vercel adapter be always-on in starter, or scaffolded by `snz-bp new vercel` later?
- **PagesCMS media `output` vs `/assets/images/`** — align `.pages.yml` `output` with dist paths, or rewrite in content compile?

## Suggested next step

- [x] Challenge v2 + `<component>` tag syntax (no comment directives)
- [x] Challenge v3 — boilerplate DX (2026-05-23)
- [x] `/plan` → `/implement` for v1 refactor (2026-05-23)
- [x] Challenge v4 + implement behaviors + Accordion/FAQ (2026-05-24)
- [x] Challenge v5 — v2 roadmap (2026-05-25)
- [x] v1.2 — inline component `<style>`, script extract, `build/` folder (2026-05-25)
- [x] **v1.2** SEO kit + `bun run check` + `.pages.yml` (2026-05-25)
- [ ] Clone per client; edit `src/site.json` + `src/routes/`

## Engagement check

Boilerplate scope — no client engagement.
