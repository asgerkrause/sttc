# Client site playbook

Use this when starting or finishing a first client marketing site with `@snz/bp`.

## Goal

Build from source, keep surface small, ship static output. No runtime framework. No `dist/` edits.

## Happy path

### 1. Create site

Use project-approved create/scaffold flow, then install with Bun.

```bash
bun install
bun run check
```

If working inside this repo starter, source lives in `templates/default/`. In a client site, source lives at repo root.

### 2. Edit site config

Update `src/site.json` first:

- `name`
- `url`
- `description`
- `locale`
- `ogImage`
- optional `scroll`

Keep values real. SEO, sitemap, manifest, route JSON, feeds, and llms files read from this config.

### 3. Add pages

Create route files under `src/pages/`.

```bash
bun run new route about
```

Or add by hand:

```html
<head>
  <SEO title="About" description="What this client does." />
</head>

<Section>
  <h1>About</h1>
  <p>Useful page copy.</p>
</Section>
```

Rules:

- `src/pages/index.html` -> `/`
- `src/pages/about.html` -> `/about/`
- `src/pages/work/case.html` -> `/work/case/`
- route files contain body markup, not shell chrome
- optional top `<head>` may hold `<SEO>` and transition meta
- no `<style>` inside route files

### 4. Use built-in components

Start with existing components before writing new ones:

- `<Section>` for section + `.c` container
- `<Grid>` for grids
- `<Card>` for contained content
- `<Button>` / `<Link>` for actions
- `<Image>` for optimized images
- `<Markdown>` for inline build-time markdown
- `<FAQ>` / `<Accordion>` for native disclosure content
- `<Code>` for code blocks

Example:

```html
<Section>
  <div class="w">
    <h1>Clear headline</h1>
    <p>Short proof-led intro.</p>
    <div class="btns">
      <Button href="/contact/" label="Start project" />
      <Link href="/work/" label="See work" />
    </div>
  </div>
</Section>
```

Need reusable pattern? Add one component in `src/components/PascalName.html`. Keep schema comment, slot-first markup, and component CSS in same file.

### 5. Add images

Put source images in one of:

- `src/images/` for project-owned images
- `src/images/` for PagesCMS uploads

Use media roots for other public files:

- `src/videos/` for video files published at `/assets/videos/`
- `src/files/` for PDFs, audio, zips, and downloads published at `/assets/files/`

Anything in these roots is public; keep drafts/private files elsewhere.

Use logical unique basenames:

```html
<Image src="hero" alt="Product interface" max="1200" loading="eager" />
```

Build emits responsive WebP assets. Use `loading="eager"` only above fold.

### 6. Optional CMS setup

Only add CMS when client needs editable content.

```bash
bun run new cms
```

Built-in content paths:

- `content/posts/intro.md` -> `/insights/intro/`

Minimum frontmatter:

```md
---
title: About
description: Why this page exists.
---

Markdown body.
```

Use `src/templates/post.html` and custom collection templates for content render shells. Keep PascalCase components in templates, not CMS body fields when layout matters.

### 7. Style only as needed

CSS is power layer, not first step.

Use existing primitives first:

- `.c` container
- `.w` stack rhythm
- `.crd` card shell
- `.btns`, `.lnks`
- `[g]`, `[c]`, `[r]`, `[o]` grid attrs

Global CSS owns tokens, reset, type, grid, wrappers, motion, and page overrides. Component-specific selectors belong in component `<style>` blocks.

### 8. Check work

Use smallest check that proves change:

```bash
bun run check
bun run doctor
bun run doctor -- --launch
```

Use `doctor` when CSS ownership changed. Use `doctor -- --launch` before deploy/client handoff; it adds stricter SEO/a11y/site checks and may fail starter placeholder config until `src/site.json` has real production values. Fix source files, never generated output.

### 9. Deploy or static handoff

Build output is `dist/`.

```bash
bun run build
```

Handoff needs:

- source repo
- exact Bun version meeting `>=1.3.14`
- deploy command: `bun run build`
- output dir: `dist`
- environment notes, only if app code uses `PUBLIC_*` vars

Vercel starter config exists. Keep analytics/speed insights explicit per client; `src/site.json.vercel` flags are intent only unless project wires required scripts/packages.

## Do not do this

- Do not edit `dist/`; generated and gitignored.
- Do not add npm/Vite/framework assumptions.
- Do not add npm dependencies for basic pages, images, routing, or SEO.
- Do not put component CSS in global CSS.
- Do not rely on hydration, virtual DOM, or runtime component registry.
- Do not keep both `src/app.ts` and `src/app.js`.
- Do not put route-local `<style>` blocks in `src/pages/`.
- Do not hand-edit `framework/docs/components-catalog.md`.

## Launch checklist

Run before client preview or static handoff:

- [ ] `src/site.json` has final `name`, `url`, `description`, `locale`, `ogImage`.
- [ ] Home, 404, and key pages exist under `src/pages/` or content routes.
- [ ] Navigation links resolve.
- [ ] Images have useful `alt` text; above-fold images use `loading="eager"` only when needed.
- [ ] Page titles/descriptions are intentional.
- [ ] No component CSS leaked into global CSS.
- [ ] `bun run check` passes.
- [ ] `bun run doctor` passes if CSS changed.
- [ ] `bun run doctor -- --launch` runs before deploy/client handoff; warnings reviewed, errors fixed.
- [ ] Deploy config points build command to `bun run build` and output to `dist`.
