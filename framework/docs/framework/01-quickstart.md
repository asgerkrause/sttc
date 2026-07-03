# Quickstart

## Requirements

- Bun `>= 1.3.14`.
- Use Bun commands only.

## Run locally

```bash
bun run dev
```

Dev server runs at `http://localhost:3000`, watches source files, hot reloads routes, and shows build errors in page.

## Add page

```bash
bun run new route pricing
```

Or create `src/pages/pricing.html`:

```html
<head>
  <SEO title="Pricing" description="Clear plans and terms." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose a plan.</p>
</Section>
```

`src/pages/pricing.html` builds to `/pricing/`. `src/pages/index.html` builds to `/`.

## Add component

Create `src/components/Feature.html`:

```html
<!--
  @desc Feature item with heading and body.
  @attr title! Heading text.
  @attr variant=[default|accent] :class Visual variant.
-->
<article class="crd">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
</article>

<style>
  .crd.accent {
    background: var(--c-acc);
    color: var(--c-acc-ink);
  }
</style>
```

Use it in a route:

```html
<Feature title="Fast" variant="accent">
  Static output, tiny runtime.
</Feature>
```

Component rules:

- File name is PascalCase and matches tag name.
- Leading comment declares attributes.
- `{{slot}}` receives children.
- Component-specific CSS lives in component `<style>`.

Full contract: [`../components.md`](../components.md).

## Add image

Put image master in `src/images/hero.png`, then use:

```html
<Image src="hero" alt="Product interface" max="1200" loading="eager" />
```

Build emits responsive WebP assets.

## Add content

CMS content is opt-in:

```bash
bun run new cms
```

Then add markdown:

```md
---
title: Hello
description: First post.
draft: false
---

Markdown body.
```

Built-in paths:

- `content/posts/intro.md` → `/insights/intro/`

Draft posts are excluded from production builds.

## Check work

```bash
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
```

Use smallest command that proves change. Docs-only edits usually need no command. Structural source edits should run `bun run build` or `bun run check`.

## Next

[Overview](./00-overview.md) · [Docs home](./README.md) · [Project structure](./02-project-structure.md)
