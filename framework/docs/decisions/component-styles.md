# Component and route style bundles

**Status:** active (supersedes sibling `.css` model)  
**Date:** 2026-05-25

## Context

Global `styles.css` grew monolithic. Authors wanted co-located component CSS without extra files or SPA nav duplication.

## Chosen

- `<style>` block in `src/components/{Name}.html` (typically at end)
- Build strips from HTML, concatenates → `dist/assets/css/components.{hash}.css` inside `@layer snz.components`
- Shell `<head>` links component CSS **after** `styles.css` (component rules win over global reset)
- Build injects via `<!-- @snz-components-css -->` marker in `shell.html`
- Bundle minify: comment strip only — preserves nested CSS
- Global tokens/layout stay in `styles.css`
- Authored route `<style>` blocks extract to `dist/assets/css/routes/{slug}.{hash}.css` inside `@layer snz.pages.{slug}` and are linked from that route head
- Source layer order reserves generated ownership layers: `snz.components`, then `snz.pages`
- Sibling `{Name}.css` deprecated (build warns, still works briefly)

## Scripts (same build pass)

- Inline `<script>` in shell `<head>` → appended to hashed `dist/assets/js/app.{hash}.js`
- Inline `<script>` at top of route file → hashed app bundle with `snz.onPage(...)` guard
- No executable `<script>` in components (SEO ld+json excepted)

## Out of scope

- Scoped CSS / shadow DOM
- Inline `<style>` in built route output
- Route CSS from markdown/content fields

## Author workflow

```html
<!-- src/components/Image.html -->
<div class="img-w">…</div>
<style>
.img-w { … }
</style>
```

`bun run build` → component styles in component bundle, route styles in route bundle, markup clean in `dist/`.
