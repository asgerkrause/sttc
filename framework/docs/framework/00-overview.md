# Overview

`@snz/sttc` is a Bun-native static site builder. Authors write HTML, CSS, TypeScript/JavaScript, images, and optional markdown content. Build output is static files in `dist/`.

## What it provides

- File-based pages from `src/pages/**/*.html`.
- Build-time HTML components from `src/components/*.html`.
- Shared shell from `src/shell.html`.
- Responsive image output from masters and CMS uploads in `src/images/`.
- Optional markdown content from `content/`.
- Bundled app code from `src/app.ts` or `src/app.js`.
- Router runtime from `framework/runtime/router.js`.
- SEO, sitemap, feeds, manifest, route JSON, llms files, and JSON-LD output.
- Strict build errors with file, line, and hint where possible.

## Build flow

1. Read site config from `src/site.json`.
2. Parse components from `src/components/*.html`.
3. Compose routes from `src/pages/**/*.html`, legacy `src/routes/**/*.html`, and optional content markdown.
4. Extract component styles and lifecycle scripts.
5. Bundle site code with `Bun.build`.
6. Process images with `Bun.Image`.
7. Emit HTML, assets, route JSON, discovery files, feeds, sitemap, and robots.
8. Run strict checks.

## Runtime model

Shell HTML loads once. The router fetches route fragments from `/routes/{slug}.html` and swaps them into the shell's `body > main`. Browser API lives on `window.snz`:

```js
snz.navigate('/about/')
snz.page()
snz.onPage('about', fn)
snz.onPage('*', fn)
snz.prefetch('/contact/')
snz.beforeNavigate(fn)
snz.afterNavigate(fn)
```

No virtual DOM. No hydration system. No required client framework.

## Source vs output

Edit source files under `src/`, optional `content/`, and `framework/` when working on the engine. Build writes `dist/`. Never edit `dist/` by hand.

## Next

[Docs home](./README.md) · [Quickstart](./01-quickstart.md)
