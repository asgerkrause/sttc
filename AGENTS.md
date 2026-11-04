# AGENTS.md — STTC

STTC (`@byak/sttc`) is an HTML-first, Bun-native static renderer. Repo: `asgerkrause/sttc`.

Site work edits `src/` and optional `content/`. Renderer work edits `framework/`. `templates/default/` is the only created-project template and ships in the same package. Build writes `dist/`; never edit it. `.snz/` is cache/state only.

Requires Bun >= 1.4.0. Use Bun only.

## Commands

```bash
bun run dev
bun run preview
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
bun run new route pricing
bun run new component Hero
bun run new cms
bun run new post hello-world
bun run new collection projects --route work/{slug} --template project
bun run skills sync
bun run smoke:create
bun run framework:verify
bun run browser:install
bun run test:browser --seeds
```

`build` runs `check` at the end. `doctor` typechecks, then runs `check`; `--launch` adds the production gate. `framework:verify` runs `doctor`, the framework tests, and the create smoke. Builds print one concise result; pass `--profile` for phase timings.

For machine output, use `build --json` or `check --json`. The versioned envelope covers caught errors and warnings; require both exit status zero and a valid success result. `check` builds first unless `--skip-build` is set. Run typechecking separately from JSON checks. See [CLI output](./framework/docs/framework/cli-output.md).

## Mental model

```text
src/shell.html          document shell
src/pages/**/*.html     authored routes
src/components/*.html   build-time components
src/site.json           site and discovery defaults
src/app.ts              project-owned TypeScript entry
src/styles.css          project CSS entry
src/styles/             project-owned Craft v3 CSS and manifest
src/images/             image masters
src/videos/             public video files
src/files/              public raw files
src/templates/          optional content templates
content/                optional markdown records
dist/                   generated output
```

The starter ships exactly seven components: `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. They are replaceable HTML examples, not a design system. This repo's dogfood site carries only the components its pages use. Component behavior stays in that component's lifecycle script. `SEO` is a renderer directive, not a component file.

Docs live in `framework/docs/framework/`: [components](./framework/docs/framework/components.md), [runtime](./framework/docs/framework/runtime.md), [SEO, AEO, GEO](./framework/docs/framework/seo-aeo-geo.md), [content and CMS](./framework/docs/framework/content-and-cms.md), [images](./framework/docs/framework/images.md), and [deploy and launch](./framework/docs/framework/deploy-and-launch.md). Decisions live in `framework/docs/decisions/`.

## Routes and SEO

A page may begin with a head wrapper:

```html
<head>
  <SEO title="About" description="What this organization does." />
</head>

<Section id="about-section">
  <h1>About</h1>
</Section>
```

Defaults come from `src/site.json`; page-specific inputs are `title`, `description`, and optional `image`. `<SEO />` is accepted only inside that wrapper. The renderer emits canonical, Open Graph, Twitter, connected JSON-LD, sitemap, feeds, manifests, route Markdown/JSON, same-path markdown aliases, `llms.txt`, `llms-full.txt`, and `dist/404.html`.

## Components

One component is one `src/components/PascalCase.html` file. A leading comment declares its contract:

```html
<!--
  @desc Introductory content block.
  @attr id! Meaningful section id.
  @attr title! Visible heading.
-->
<section id="{{id}}">
  <h1>{{title}}</h1>
  <div>{{slot}}</div>
</section>
```

Supported component features:

- `{{attr}}`, `{{slot}}`, and named slots;
- `{#if}` / `{:else if}` / `{:else}`, nested inside `{#each}` and each other;
- build-time `{#each}` with component or route JSON data;
- optional lifecycle `<script>` with `el` bound to the root and cleanup return; behavior required by a component belongs here, not in `src/app.ts`;
- optional colocated `<style>` compiled to a hashed stylesheet;
- optional `@schema Type field=attr` structured data.

Attribute values decode once at parse and every placeholder escapes once on render; slots stay raw. An unknown `@tag`, a malformed `@attr`, or a single-quoted attribute fails the build with the component file and the page named. Read `framework/docs/framework/components.md` before component engine work. Each build generates the project-local contract catalog at `.snz/components-catalog.md`.

## CSS boundary

The renderer is CSS-agnostic. The dogfood and starter explicitly adopt a project-owned Craft v3 copy under `src/styles/`. Craft is the system name; the physical files retain `crft.css` and `crft-manifest.json`. The project-owned `global.css` imports flat `tokens.css` and `crft.css`; `src/styles.css` imports that entry. The eight logical layers remain `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. See [Craft v3 adoption](./framework/docs/decisions/craft-v3-adoption.md) for provenance and migration scope.

Use `.c` for containers, with optional `sm` or `lg` classes. Use `.s` for vertical stacks only. Type roles use `.display`, `.h1`, `.h2`, `.h3`, `.lead`, `.body`, `.small`, `.label`, and `.caption`; native `h4`–`h6` retain their semantics with `h3` styling. Grids use `g` tracks, `c` column spans, `r` row spans, and `o` visual order. `l` clamps lines. `Section` keeps its `c` input for `sm` and `lg`, selecting container classes. `Grid` keeps `cols`, `x`, `y`, and `order` inputs and emits `g`, `c`, `r`, and `o` respectively.

`data-theme` accepts `invert`, `tone`, or `accent` and changes color only; `data-accent` routes semantic accents. Set the document's `color-scheme` on `:root`, rather than using a scheme attribute. Type, spacing, and radius recipes resolve at `:root` only. Use semantic owners for local final-role overrides. Horizontal flow, wrapping, and alignment belong in bounded project or component CSS. Never put classes on `section`; direct `main > section` elements need meaningful, nonempty, unique IDs. `.btn`, `.crd`, and `.lnk` stay project conventions.

The dogfood retains SNZ font faces. The starter ships no font files and uses `system-ui` until the project adds its own faces. The build copies and hashes WOFF/WOFF2 files from `src/styles/` and rewrites `@font-face` URLs. It does not convert TTF or OTF.

- Replace `src/styles.css` with project-wide CSS as needed.
- Put reusable component-specific CSS in that component's `<style>`.
- Route `<style>` is allowed in authored routes and compiles to a route-owned hashed asset. Content templates may not carry one.
- Use ordinary platform CSS or the project's chosen external system. Do not invent framework tokens or utility conventions.
- Cross-document view transitions belong to the motion layer in project-owned `crft.css`. `data-scrub` remains opt-in, with a static fallback and reduced-motion support. The runtime adds no CSS.
- Existing consumer projects keep their owned CSS. STTC does not upgrade them automatically or supply Craft compatibility aliases.

## Images and media

`Image` is compiler-assisted. Masters in `src/images/` become WebP output with responsive variants and intrinsic dimensions. Use logical basenames without extensions:

```html
<Image src="hero" alt="Product interface" max="1600" />
```

`Video` emits native video markup. Files under `src/videos/` copy to `/assets/videos/`; files under `src/files/` copy to `/assets/files/`. Anything in public media roots can ship.

## TypeScript and runtime

`src/app.ts` is canonical. `src/app.js` is an escape hatch; never keep both. The renderer bundles project code with Bun, then appends shell scripts, component lifecycle registrations, and route scripts. A syntax error names the shell or component file, not a temp path.

Navigation is MPA: the build emits a full document per route, `src/shell.html` carries a `<script type="speculationrules">` prefetch block, and the browser owns scroll restoration and anchors. `window.snz` owns `page`, `onPage`, `registerComponent`, `track`, `onVisible`, `onActive`, `isVisible`, `isActive`, and native disclosure handling. It dispatches `snz:page` once per document and `snz:track` for every `snz.track()` call. There is no programmatic navigation call, prefetch call, navigation hook, announcer, or focus management.

`snz.track()` knows no analytics provider. Providers subscribe to `snz:track` in `src/app.ts`; `framework/docs/framework/runtime.md` carries the PostHog and Vercel recipes. `src/site.json` has no analytics flags.

Lenis smooth scrolling is optional and self-hosted. Set `"scroll": "lenis"` in `src/site.json` to include it. Set `"scroll": "native"` to exclude its bootstrap, CSS, vendor code, and shell configuration from `dist/`. Reduced-motion users always keep native scrolling.

## Dev and preview

`framework/dev.ts` and `framework/preview.ts` serve `dist/` only: paths that resolve above it return 404, unknown paths return the site's 404 page with status 404, and both bind `127.0.0.1` unless `HOST` is set. Dev reloads the tab over server-sent events and swaps in a build-error page when a build fails.

A change to `framework/dev.ts` or `framework/preview.ts` is verified against a directory route (`/docs/`), not only `/`.

## Errors and verification

Build errors include file, line, and hint. Fix source, not output.

`check` fails only on renderer contracts: missing discovery output, broken internal links, unresolved placeholders, TTF/OTF fonts, unhashed `/router.js`, HMR leakage. Stylesheet count, non-deferred head scripts, and `@import` in emitted CSS are project choices and warn only under `--launch`. `--launch` rejects the starter's 1×1 OG placeholder, the starter's `site.json` name and description, the starter's home title, and placeholder URLs. Never fabricate production values.

Immutable `Cache-Control` in `vercel.json` applies only to hashed `css|js|woff` paths. `check` warns when an immutable rule's `source` lacks a hash group; that is a source-pattern heuristic, not proof that a custom rule matches hashed assets only, so the project verifies custom rules itself.

After structural changes run `bun run framework:verify`; for a narrower loop use `bun run build` or `bun test framework/tests`.

Integration and release verification also run `bun run test:browser --seeds` after `bun run browser:install`. This Bun-driven Chromium gate is separate from ordinary tests and ships no consumer dependency. See [browser testing](./framework/docs/framework/browser-testing.md). The create smoke includes a frozen historical customized consumer; preserve its provenance and owned source files when extending [upgrade coverage](./framework/docs/framework/consumer-upgrades.md).

`@byak/sttc` is a public npm package. `sttc create` from this checkout writes `"@byak/sttc": "file:<checkout>"` into the created site; a packaged create writes `^<version>`. Publishing requires explicit human approval.
