# Simplified authoring surface

## Decision

Prefer a flat starter authoring surface:

```txt
src/
  pages/
  components/
  images/
  styles.css
  app.js or app.ts
  site.json
```

## Rules

- `src/pages/**/*.html` is canonical for authored routes.
- `src/routes/**/*.html` remains supported as legacy input; `src/pages` wins on slug collisions.
- Nested pages map by path: `blog/index.html` → `/blog/`, `work/case.html` → `/work/case/`.
- `src/styles.css` is canonical global CSS. `src/styles/styles.css` remains supported.
- `src/app.js` or `src/app.ts` is canonical site script. `src/app/app.js` remains supported.
- CMS files (`content/`, `media/`, `.pages.yml`, `src/templates/`) are opt-in, not shipped in the default starter.

## Why

Starter should show only files client authors touch on day one. Framework/runtime and CMS surface stay available without making every new site look larger than it is.

## Notes

Discovery uses `Bun.Glob` for nested pages and low-risk HTML scans. Build output stays unchanged: `dist/index.html`, `dist/routes/*.html`, route JSON, sitemap, feeds, and manifest.
