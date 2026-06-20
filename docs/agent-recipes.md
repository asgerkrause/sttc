# Agent recipes

Short task cards for common `@snz/bp` work. Use with `docs/agent-guide.md` and `docs/components.md`.

## Rules every recipe inherits

- Edit source, not `dist/`.
- Use Bun commands only.
- Prefer existing components and primitives before new code.
- Put component CSS in component `<style>`.
- Put page overrides in `src/styles.css` or split global CSS owner files.
- Keep route files free of `<style>` blocks.
- Run smallest check that proves change.

## Add page

Use when adding a new public route.

Likely files:

- `src/pages/{slug}.html`
- `src/site.json` only if defaults need adjustment
- `src/images/*` only if page needs new images

Steps:

```bash
bun run new route pricing
```

Then edit `src/pages/pricing.html`:

```html
<head>
  <SEO title="Pricing" description="Clear plans." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose the right fit.</p>
</Section>
```

Common failures:

- broken internal link
- lowercase component tag
- missing required component attr
- route `<style>` block
- duplicate slug from authored/content/generated route

Verify:

```bash
bun run check
```

## Add section or component

Use when existing markup repeats or route needs reusable part.

Likely files:

- `src/components/PascalName.html`
- `src/pages/*.html` using component

Steps:

```bash
bun run new component Feature
```

Keep component slot-first unless stable config earns attrs:

```html
<!--
  @desc Feature item.
  @attr variant=[default|accent] :class Visual variant.
-->
<article class="crd">
  {{slot}}
</article>

<style>
  .crd.accent {
    background: var(--a);
    color: var(--ai);
  }
</style>
```

Use in page:

```html
<Feature variant="accent">
  <h2>Fast</h2>
  <p>Static output, tiny runtime.</p>
</Feature>
```

Common failures:

- filename not PascalCase
- schema attr required but missing in usage
- unknown enum value
- private selector placed in global CSS
- prop-heavy component duplicating `Card`, `Grid`, `Button`, or `Image`

Verify:

```bash
bun run build
```

Use `bun run doctor` when CSS ownership changed.

## Add image

Use when page/component needs optimized raster image.

Likely files:

- `src/images/{name}.{png,jpg,jpeg,webp}`
- or `media/images/{name}.{png,jpg,jpeg,webp}`
- `src/pages/*.html` or component using `<Image>`

Steps:

1. Add master image with unique basename.
2. Reference basename without extension.

```html
<Image src="hero" alt="Product dashboard" max="1200" loading="eager" />
```

Common failures:

- duplicate basename across image roots
- missing or weak `alt`
- eager loading below fold
- styling missing preview behavior; target `.img-w img` or `.img-tmp`, not nonexistent `.img-main`

Verify:

```bash
bun run check
```

## Add CMS scaffold/content page/post

Use when client needs editable pages or posts.

Likely files:

- `.pages.yml`
- `content/pages/*.md`
- `content/posts/*.md`
- `media/images/*`
- `src/templates/page.html`
- `src/templates/post.html`

Steps:

```bash
bun run new cms
```

Add page:

```md
---
title: About
description: Company story.
---

Markdown body.
```

Paths:

- `content/pages/about.md` -> `/about/`
- `content/posts/intro.md` -> `/insights/intro/`

Common failures:

- missing `title` frontmatter
- authored page already owns same slug
- layout-heavy content placed in markdown body instead of template
- media path not matching PagesCMS config

Verify:

```bash
bun run check
```

## Add custom collection

Use when built-in `pages` and `posts` are not enough.

Likely files:

- `content/collections.json`
- `content/{collection}/*.md`
- `src/templates/{template}.html`

Steps:

Add collection config:

```json
{
  "collections": [
    {
      "name": "projects",
      "path": "content/projects",
      "template": "project.html",
      "route": "work/{slug}",
      "required": ["title"]
    }
  ]
}
```

Add template at `src/templates/project.html` and content under `content/projects/`.

Common failures:

- using reserved names `posts` or `pages`
- missing required frontmatter
- route pattern collision
- expecting automatic index/feed/tag pages for custom collections

Verify:

```bash
bun run check
```

## Debug build error

Use when `bun run build`, `check`, or `doctor` fails.

Likely files:

- file named in error
- component used by named route
- `src/site.json` for SEO/config errors
- content markdown named in error

Steps:

1. Read exact error file/line/hint.
2. Fix source file named by error.
3. Re-run same command.
4. Escalate only after reproducing with clean command output.

Common failures:

- unknown component from PascalCase typo
- required attr missing
- unknown attr on strict schema
- unsafe markdown HTML or URL protocol
- broken internal link
- leftover `*.schema.json` sidecar
- route `<style>` block

Verify:

```bash
bun run check
```

Or re-run failing command exactly.

## Prepare launch/deploy checklist

Use before preview, client handoff, or deploy wiring.

Likely files:

- `src/site.json`
- `vercel.json` if Vercel project
- docs/handoff notes owned by project

Checklist:

- final `src/site.json` values
- intended canonical `url`
- home, 404, and key routes present
- SEO titles/descriptions intentional
- internal links valid
- image `alt` text present
- no source references to `dist/`
- deploy build command: `bun run build`
- deploy output dir: `dist`
- runtime env only via `PUBLIC_*` if used in `src/app.ts`

Common failures:

- assuming Vite output path
- enabling analytics by `site.json` intent only
- missing Bun version requirement
- stale template/package sync before publish-adjacent work

Verify:

```bash
bun run check
bun run doctor -- --launch
```

Use `bun run doctor` when CSS changed. Use launch mode before deploy/client handoff; starter placeholders may fail until real `src/site.json` values and route descriptions are set.

## Sync/check create template

Use when starter template or package create output may drift.

Likely files:

- `templates/default/**`
- `packages/create-snz-bp/template/default/**`

Commands:

```bash
bun run prepare:create-template
bun run check:create-template
```

Common failures:

- edited starter but not packaged create template
- generated package template differs from `templates/default`
- publish-adjacent work skipped private guard

Verify:

```bash
bun run check:create-template
```

For docs-only claims about starter/template paths, run `bun run check:create-template` when practical.
