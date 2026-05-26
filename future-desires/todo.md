# Future desires (post v1.2)

Parked from challenge + plan. Not in current scope.

## v2 — content + media

- [ ] `build/content.ts` — `content/posts/*.md` → `dist/routes/insights/{slug}.html` via `src/templates/post.html`
- [ ] `content/pages` → `dist/routes/{slug}.html`
- [ ] `dev.ts` watch `content/`
- [ ] Media ingest: `media/images` → Bun.Image webp (read `.pages.yml` paths)

## SEO kit phase 2–3

- [ ] Kit 2: `FAQPage` from `<FAQ />`; `Article`/`BlogPosting` for CMS posts
- [ ] Kit 3: `dist/llms.txt` from extended `site.json` (`organization`, `sameAs`, contact)
- [ ] Optional `noindex` for demo routes (e.g. `styles`)

## DX + CI

- [ ] GitHub Action: `bun run build && bun run check` on CMS commits
- [ ] Remote media URL ingest adapter
- [ ] `check --skip-build` documented in AGENTS (fast CI when dist cached)

## Open from handoff

- [ ] PagesCMS `media.output` vs `/assets/images/` — final alignment when ingest lands
