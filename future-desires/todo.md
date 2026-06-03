# Future desires

Current roadmap lives in GitHub Issues + Project: https://github.com/sanitizestudio/snz-bp/issues

## Shipped in v2

- [x] `build/content.ts` — `content/posts/*.md` → `dist/routes/insights/{slug}.html` via `src/templates/post.html`
- [x] `content/pages/*.md` → `dist/routes/{slug}.html` via `src/templates/page.html`
- [x] `dev.ts` watches `content/`
- [x] `media/images` masters feed Bun.Image webp output
- [x] Responsive image variants + `srcset` for `<Image />`
- [x] `FAQPage`/FAQ-style component schema discovery and `BlogPosting` for content posts
- [x] `llms.txt`, `llms-full.txt`, feeds, sitemap, robots, ai-plugin, and manifest discovery artifacts

## v2 hardening

- [ ] PagesCMS `media.output` vs `/assets/images/` — final public path contract
- [ ] Duplicate logical image-name detection across `src/assets/images` and `media/images`
- [ ] CMS markdown safety: reject scripts/styles with file/hint
- [ ] Tag slugging while preserving labels
- [ ] Router focus + live-region navigation announcements
- [ ] Source-level checks for route/content collisions, media config, and template placeholders

## Extension surface

- [ ] Component preset CLI: `snz-bp add component hero|logos|pricing|testimonial`
- [ ] Theme/token packs
- [ ] Custom content collections beyond posts/pages
- [ ] Component preview/catalog route
- [ ] Extended AEO/GEO site config (`organization`, `sameAs`, contact, topics)

## Publish readiness

- [ ] GitHub Action: root + starter template checks
- [ ] Manifest schema/generator versioning
- [ ] Package publish metadata/checklist
- [ ] Migration registry
- [ ] Remote media URL ingest adapter
