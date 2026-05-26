# Component styles bundle

**Status:** active (supersedes sibling `.css` model)  
**Date:** 2026-05-25

## Context

Global `styles.css` grew monolithic. Authors wanted co-located component CSS without extra files or SPA nav duplication.

## Chosen

- `<style>` block in `src/components/{Name}.html` (typically at end)
- Build strips from HTML, concatenates → `dist/assets/css/components.css`
- Shell `<head>` links `components.css` **after** `styles.css` (component rules win over global reset)
- Build injects via `<!-- @snz-components-css -->` marker in `shell.html`
- Bundle minify: comment strip only — preserves nested CSS
- Global tokens/layout stay in `styles.css`; per-page via `html[data-page]`
- Sibling `{Name}.css` deprecated (build warns, still works briefly)

## Scripts (same build pass)

- Inline `<script>` in shell `<head>` → appended to `dist/assets/js/app.js`
- Inline `<script>` at top of route file → `app.js` with `snz:page` guard
- No executable `<script>` in components (SEO ld+json excepted)

## Out of scope

- Scoped CSS / shadow DOM
- `<style>` in route body
- Router head merge for `<style>`

## Author workflow

```html
<!-- src/components/Image.html -->
<div class="img-w">…</div>
<style>
.img-w { … }
</style>
```

`bun run build` → styles in bundle, markup clean in `dist/`.
