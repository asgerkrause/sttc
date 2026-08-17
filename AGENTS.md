# AGENTS.md — STTC

STTC (`@snz/sttc`) is an HTML-first, Bun-native static renderer. Repo: `sanitizestudio/sttc`.

Site work edits `src/` and optional `content/`. Renderer work edits `framework/`. `templates/default/` is the only created-project template and ships in the same package. Build writes `dist/`; never edit it. `.snz/` is cache/state only.

Requires Bun >= 1.3.14. Use Bun only.

## Commands

```bash
bun run dev
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
bun run new route pricing
bun run new component Hero
bun run new cms
bun run skills sync
bun run framework:verify
```

## Mental model

```text
src/shell.html          persistent document shell
src/pages/**/*.html     authored routes
src/components/*.html   build-time components
src/site.json           site and discovery defaults
src/app.ts              project-owned TypeScript entry
src/images/             image masters
src/videos/             public video files
src/files/              public raw files
content/                 optional markdown records
dist/                    generated output
```

The starter ships exactly seven components: `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. They are replaceable HTML examples, not a design system. This repo's dogfood site may add extra components under `src/components/`; created projects get only the seven from `templates/default`. Component behavior stays in that component's lifecycle script. `SEO` remains a renderer directive, not a component file.

## Routes and SEO

A page may begin with a head wrapper:

```html
<head>
  <SEO title="About" description="What this organization does." />
</head>

<Section>
  <h1>About</h1>
</Section>
```

`SEO` is a renderer directive, not a component file. Defaults come from `src/site.json`; page-specific inputs are `title`, `description`, and optional `image`. The renderer emits canonical, Open Graph, Twitter, connected JSON-LD, sitemap, feeds, manifests, route Markdown/JSON, `llms.txt`, and `llms-full.txt`.

## Components

One component is one `src/components/PascalCase.html` file. A leading comment declares its contract:

```html
<!--
  @desc Introductory content block.
  @attr title! Visible heading.
-->
<section>
  <h1>{{title}}</h1>
  <div>{{slot}}</div>
</section>
```

Supported component features:

- `{{attr}}`, `{{slot}}`, and named slots;
- `{#if}` / `{:else}`;
- build-time `{#each}` with component or route JSON data;
- optional lifecycle `<script>` with `el` bound to the root and cleanup return; behavior required by a component belongs here, not in `src/app.ts`;
- optional colocated `<style>` compiled to a hashed stylesheet;
- optional `@schema Type field=attr` structured data.

Read `framework/docs/framework/05-components.md` before component engine work. Each build generates the project-local contract catalog at `.snz/components-catalog.md`.

## CSS boundary

The renderer does not impose framework CSS. The root dogfood and starter import a pinned, project-owned CRFT copy from `src/styles/`.

- Replace `src/styles.css` with project-wide CSS as needed.
- Put reusable component-specific CSS in that component's `<style>`.
- Route `<style>` is allowed for authored route-only CSS and compiles separately.
- Use ordinary platform CSS or the project's chosen external system. Do not invent framework tokens or utility conventions.
- The router may apply internal visually-hidden styles to its live region for accessibility; that is runtime infrastructure, not project presentation.

## Images and media

`Image` is compiler-assisted. Masters in `src/images/` become WebP output with responsive variants and intrinsic dimensions. Use logical basenames without extensions:

```html
<Image src="hero" alt="Product interface" max="1600" />
```

`Video` emits native video markup. Files under `src/videos/` copy to `/assets/videos/`; files under `src/files/` copy to `/assets/files/`. Anything in public media roots can ship.

## TypeScript and runtime

`src/app.ts` is canonical. `src/app.js` is an escape hatch; never keep both. The renderer bundles project code with Bun, then appends shell scripts, route scripts, and component lifecycle registrations.

`window.snz` owns navigation, prefetching, page hooks, lifecycle mounting, focus, live-region announcements, visibility/activity helpers, and analytics events. Preserve native navigation and accessibility behavior.

Lenis smooth scrolling is optional and self-hosted. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude its bootstrap, CSS, vendor code, and shell configuration from `dist/`. Reduced-motion users always keep native scrolling.

## Errors and verification

Build errors should include file, line, and hint. Fix source, not output.

After structural changes run:

```bash
bun run build
bun test framework/tests
bun run smoke:create
bun run framework:verify
```

Launch mode intentionally rejects placeholder URLs and incomplete production metadata. Never fabricate production values.
