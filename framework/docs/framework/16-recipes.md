# Agent recipes

Task-card recipes for common SANITIZE Boilerplate work.

## Shared rules

- Use Bun commands only.
- Edit source, not `dist/`.
- Prefer existing components and primitives.
- Keep routes free of `<style>` blocks.
- Put component CSS in component `<style>`.
- Use semantic HTML before classes.
- Run smallest useful check.

## Add page

**Use when:** adding a public URL.

**Files:**

- `src/pages/{slug}.html`
- optional `src/images/*`
- optional `src/site.json`

**Steps:**

```bash
bun run new route pricing
```

```html
<head>
  <SEO title="Pricing" description="Clear plans." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose the right fit.</p>
</Section>
```

**Avoid:**

- `<style>` in route
- lowercase component tags
- broken internal links
- duplicate route/content slugs

**Verify:**

```bash
bun run check
```

## Add section component

**Use when:** markup repeats or needs owned style/script.

**Files:**

- `src/components/PascalCase.html`
- page or component that calls it

**Steps:**

```bash
bun run new component Feature
```

```html
<!--
  @desc Feature item.
  @attr variant=[default|accent] :class Visual variant.
-->
<article class="card">
  {{slot}}
</article>

<style>
  .card.accent {
    background: var(--c-acc-sur);
    color: var(--c-acc-ink);
  }
</style>
```

Usage:

```html
<Feature variant="accent">
  <h2>Fast</h2>
  <p>Static output, tiny runtime.</p>
</Feature>
```

**Avoid:**

- prop-heavy copies of `Card`, `Grid`, `Button`, or `Image`
- JSON schema sidecars
- non-PascalCase filenames
- private selectors in global CSS

**Verify:**

```bash
bun run build
```

## Add layout

**Use when:** content needs columns or responsive ordering.

**Files:**

- route or component markup
- component CSS only if visual treatment is component-owned

**Use primitives:**

```html
<div g="4-2">
  <article c="2-1">Large</article>
  <article>Small</article>
</div>
```

Or built-in component:

```html
<Grid cols="4-2">
  <Card><h3>One</h3><p>...</p></Card>
  <Card><h3>Two</h3><p>...</p></Card>
</Grid>

<Grid cols="a">
  <Card><h3>Unknown count</h3><p>Auto-fit track.</p></Card>
  <Card><h3>Another</h3><p>Same rhythm.</p></Card>
</Grid>
```

Use `cols="a"`, `cols="a-sm"`, or `cols="a-lg"` when item count should auto-fit instead of using fixed breakpoint counts.

**Avoid:**

- new grid utility classes
- wrapper elements without layout purpose
- using `Stack`; prefer `.stack`

**Verify:**

```bash
bun run check
```

## Add image

**Use when:** route or component needs optimized raster image.

**Files:**

- `src/images/{name}.{png,jpg,jpeg,webp}`
- route/component that calls `<Image>`

**Steps:**

1. Add master image with unique basename.
2. Reference basename without extension.

```html
<Image src="hero" alt="Product dashboard" max="1200" loading="eager" />
```

**Avoid:**

- duplicate image basenames across roots
- vague or missing `alt`
- eager loading below fold
- styling `.img-main`; use `.media img` or `.img-tmp`

**Verify:**

```bash
bun run check
```

## Add inline markdown

**Use when:** authoring rich copy inside route/component at build time.

**Files:**

- route or component containing `<Markdown>`

**Example:**

```html
<Markdown>
## Feature table

| Feature | Status |
| --- | --- |
| Tables | Supported |

<Button label="Contact" href="/contact/" />
</Markdown>
```

**Avoid:**

- unsafe HTML
- unsafe URL protocols
- layout-heavy markdown that belongs in a template/component

**Verify:**

```bash
bun run check
```

## Add CMS posts/records

**Use when:** editable markdown posts or structured records are needed.

**Files:**

- `.pages.yml`
- `content/posts/*.md`
- `src/images/*`
- `src/templates/post.html`

**Steps:**

```bash
bun run new cms
```

Post:

```md
---
title: Intro
date: 2026-05-26
description: First post.
---

Markdown body.
```

Paths:

- `content/posts/intro.md` → `/insights/intro/`

**Avoid:**

- missing `title`
- route collisions
- layout-heavy markdown body
- media path mismatch

**Verify:**

```bash
bun run check
```

## Add custom collection

**Use when:** pages/posts are not enough.

**Files:**

- `content/collections.json`
- `content/{collection}/*.md`
- `src/templates/{template}.html`

**Config:**

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

**Avoid:**

- reserved names `posts` or `pages`
- missing required frontmatter
- route pattern collision
- expecting automatic index/feed/tag routes

**Verify:**

```bash
bun run check
```

## Debug build error

**Use when:** `build`, `check`, or `doctor` fails.

**Steps:**

1. Read exact file, line, and hint.
2. Fix source file named by error.
3. Re-run same command.
4. Report exact remaining error if still failing.

**Common causes:**

- unknown PascalCase component
- lowercase component invocation
- required attr missing
- unknown attr on strict schema
- unsafe markdown HTML or URL protocol
- broken internal link
- leftover `*.schema.json`
- route `<style>` block

**Verify:**

```bash
bun run check
```

Or re-run failing command exactly.

## Prepare launch handoff

**Use when:** preview, deploy, or client handoff is next.

**Check:**

- canonical `src/site.json` values
- public `url`
- home, 404, key routes present
- intentional titles/descriptions
- valid internal links
- image alt text present
- build command: `bun run build`
- output dir: `dist`
- browser env vars start with `PUBLIC_*`

**Verify:**

```bash
bun run check
bun run doctor -- --launch
```

## Next

[Agent workflow](./15-agent-workflow.md) · [Docs home](./README.md) · [Troubleshooting](./17-troubleshooting.md)
