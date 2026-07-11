# Authoring components

This is the contract for adding or editing components. Read it before touching `src/components/`.

## One file per component

A component is **one HTML file** in `src/components/`, named `PascalCase.html`.

No JSON sidecars. No README in `src/components/`. The file *is* the component.

## Inline schema

Each component file may start with a single `<!-- ... -->` HTML comment that declares its contract. The build parses it; the comment is stripped from the rendered output.

```html
<!--
  @desc Flexible styled container for grouped content.
  @attr variant=[default|outlined|ghost|accent|invert] :class Visual variant.
  @attr href Optional link-card destination. Renders the root as an anchor when present.
-->
{#if href}
<a class="card" href="{{href}}">{{slot}}</a>
{:else}
<article class="card">{{slot}}</article>
{/if}

<style>
  .card:has(.media) { /* component-specific composition edge */ }
</style>
```

**Directives** (one per line, leading whitespace ignored):

| Syntax | Meaning |
|---|---|
| `@desc <text>` | One-line description. Surfaces in the auto-generated catalog. |
| `@attr name <text>` | Declare an optional attribute. |
| `@attr name! <text>` | Required. Build throws if missing or empty. |
| `@attr name=[a\|b\|c] <text>` | Enum. Build throws on unknown value. |
| `@attr name :class <text>` | Value is auto-appended as a class on the template root. |
| `@schema TypeName field=attr,...` | Optional: emit JSON-LD per instance (for structured-data components). |

Combinations work: `@attr variant=[primary|outlined|ghost] :class Visual style.`

Unknown `@tags` are silently ignored — the format can grow without breaking old files.

## Templates

Reference attributes with `{{name}}`. Default slot children go to `{{slot}}`. Named slots use `{{slot:name}}` and are filled by `<slot name="...">...</slot>` inside the invocation.

```html
<!-- Banner.html -->
<aside class="banner">
  <strong>{{slot:title}}</strong>
  <p>{{slot}}</p>
</aside>
```

Usage:

```html
<Banner>
  <slot name="title">Heads up</slot>
  Body of the banner.
</Banner>
```

## Conditional template blocks

Use Svelte-style `{#if ...}{/if}` blocks to omit optional markup at build time. Add `{:else}` for fallback markup.

```html
<a class="button" href="{{href}}" aria-label="{{label}}">
  {#if slot:vis}
  <span class="button-visual" aria-hidden="true">{{slot:vis}}</span>
  {:else}
  <span class="button-visual" aria-hidden="true">→</span>
  {/if}
  <span>{{label}}</span>
</a>
```

Supported conditions:

- `{#if attrName}` — true when the component attr is present and non-empty.
- `{#if slot}` — true when the default slot has content.
- `{#if slot:name}` — true when a named slot has content.

Use `{:else}` for accessibility-sensitive fallbacks:

```html
{#if label}
<span class="icon" role="img" aria-label="{{label}}">{{slot}}</span>
{:else}
<span class="icon" aria-hidden="true">{{slot}}</span>
{/if}
```

Keep v1 simple: no expressions, nesting, or `{:else if ...}`. Components support `{#each}` when they define build-time JSON data with `<script type="application/json" data-snz>` or `src="..."` from `src/data/`.

```html
<script type="application/json" data-snz>
{ "items": [{ "summary": "Question", "body": "Answer" }] }
</script>

{#each items as item}
<Accordion summary="{{item.summary}}" body="{{item.body}}" />
{/each}
```

Loops keep source order unless a sort clause is declared. Sort keys are item-relative dotted paths. Use one or more `path direction` pairs; missing values sort last.

```html
{#each items sort name asc as item}
<p>{{item.name}}</p>
{/each}

{#each cases sort featured desc, date desc as item, i}
<Card title="{{item.title}}"><p>{{i}}</p></Card>
{/each}
```

Placeholders are data paths, not JavaScript expressions. For common text transforms, use the built-in filters:

```html
<p>In need of {{service.name | lower}}?</p>
<a href="#{{service.name | slug}}">{{service.name}}</a>
```

## Variants (combo classes + nested CSS, no BEM)

`@attr variant=[...] :class` is the recommended pattern for component-specific variants:

```html
<!--
  @attr variant=[default|outlined|ghost|accent|invert] :class
  @attr href Optional link-card destination.
-->
<article class="card">
  ...
</article>

<style>
  .card {
    /* base */
    &.outlined { border-color: var(--c-bor); background: transparent; }
    &.ghost { background: transparent; }
    &.accent { background: var(--c-acc); color: var(--c-acc-ink); }
    &.invert { background: var(--c-ink); color: var(--c-bg); }
  }
</style>
```

`<Card href="/work/" variant="accent">` produces a linked accent card.

## Styles

Colocate component-specific `<style>` in the component file. The build extracts it into `dist/assets/css/components.{hash}.css` (loaded after the global stylesheet so component rules win at equal specificity).

Global CSS is split by owner: `src/styles.css` imports `src/styles/system.css`, `reset.css`, `type.css`, `grid.css`, `wrappers.css`, `utilities.css`, and `motion.css`. Global CSS owns tokens, reset/base type, `.container`, `.stack`, `.card`, `.buttons`, `.links`, layout attrs `[g]`, `[c]`, `[r]`, `[o]`, responsive type/rhythm/spacing attrs `[t]`, `[gp]`, `[mg*]`, `[pd*]`, theme tokens, and page overrides. Component selectors such as `.faq`, `.code`, `.media`, or private component roots belong in their component file.

Class language is short and rare. Prefer semantic HTML, ARIA, and data attributes first. Use durable primitives (`.container`, `.stack`, `.card`, `.button`, `.buttons`, `.link`, `.links`), type/tone utilities (`.eyebrow`, `.t-lg`, `.t-md`, `.t-sm`, `.fw-*`, `.c-*`, `.h*`), or short private hooks (`.brg`, `.logo-mk`, `.code-lb`) only when useful.

Use design tokens from the global system. Layout: `--l-mw`, `--l-gc`. Space/radius/border: `--s-px`, `--s-py`, `--s-ss`, `--s-gp`, `--s-pd`, `--s-br`, `--s-bw`. Type: `--t-fw-l/r/b`, `--t-md-*`, `--t-lg-*`, `--t-sm-*`, `--t-h0-*`…`--t-h6-*`. Color: `--c-bg`, `--c-fg`, `--c-ink`, `--c-sur`, `--c-mut`, `--c-bor`, `--c-acc`, `--c-sec`, `--c-acc-sur/ink/bor`, `--c-sec-sur/ink/bor`. Motion: `--m-td*`, `--m-tf*`; interaction: `--i-hov-*`. Old short tokens are removed. Component CSS must use grouped names. Don't hardcode spacing, font weights, or colors.

## Lifecycle scripts

Optional `<script>` block runs once per instance. `el` is bound to the root element. Return a function for cleanup. Scripts that run active work must use `snz.onActive` or `snz.onVisible`; build checks warn on loops, timers, media playback, or scroll animation without that guard.

```html
<!--
  @desc Click counter.
  @attr label! Button label.
-->
<button class="counter" type="button">
  <span class="counter-label">{{label}}</span>
  <span class="counter-value">0</span>
</button>

<script>
  const value = el.querySelector('.counter-value')
  let n = 0
  const onClick = () => { n++; value.textContent = String(n) }
  el.addEventListener('click', onClick)
  return () => el.removeEventListener('click', onClick)
</script>

<style>
  .counter { /* ... */ }
</style>
```

For animation loops or autoplay-like work, bind execution to activity so offscreen components stop doing work:

```html
<script>
  let frame
  function start() {
    if (frame) return
    frame = requestAnimationFrame(tick)
  }
  function stop() {
    cancelAnimationFrame(frame)
    frame = undefined
  }
  const off = window.snz?.onActive?.(el, { enter: start, exit: stop })
  return () => { off?.(); stop() }
</script>
```

The build auto-injects `data-snz-component="{Name}"` on the template root. Runtime walks `[data-snz-component]:not([data-snz-mounted])` after each navigation and runs the wrapper.

## Slot-first preset naming

Core components stay small and generic. New content presets should read like content, not framework taxonomy:

- plural = collection/layout wrapper (`Features`, `Testimonials`, `Stats`, `Partners`)
- singular = item (`Feature`, `Testimonial`, `Stat`, `Partner`)
- standalone nouns for one-off sections (`Hero`, `CTA`, `Contact`)
- `Logo` stays the site mark used by shell chrome; use `Partners` / `Partner` for logo-wall patterns

Prefer slots for preset content so existing primitives compose inside them:

```html
<Section>
  <Features>
    <Feature>
      <Card>
        <h3>Fast</h3>
        <p>Static output, tiny runtime.</p>
      </Card>
    </Feature>
  </Features>
</Section>
```

Use attrs only for stable configuration: variant, theme, href, image source, accessible labels, IDs. Avoid prop-heavy presets that duplicate `Card`, `Grid`, `Button`, `Image`, or raw HTML.

## Built-in components

| Component | Purpose |
|---|---|
| `Header`, `Footer` | Shell chrome. |
| `Logo` | Text-first site logo. Defaults to site.json name; slot can hold an SVG or img mark. |
| `SEO` | Per-route head injection (title, meta, OG, JSON-LD). |
| `Image` | Responsive WebP image. Lazy by default with temporary `.img-tmp` preview; eager images skip preview. |
| `Embed` | Responsive iframe wrapper for video/maps/rich media. |
| `Button`, `Link` | Action / inline link primitives. |
| `Card` | Flexible styled container. Put headings, copy, media, and actions in the slot. |
| `Products`, `Product` | Product listing and card primitives. `Products source="polar"` fetches Polar products at build time with `POLAR_ACCESS_TOKEN`; `Product checkout="embed"` loads Polar's embed helper for inline checkout. |
| `Accordion`, `FAQ` | Native `<details>` disclosure + demo composite. |
| `Section` | Semantic section + `.container` container. No root class. |
| `Markdown` | Inline build-time markdown (use slot for source). Supports headings, lists, tables, code, safe links/images, and PascalCase components. |
| `Grid` | Attribute grid wrapper. `cols` maps to `[g]` fixed, subgrid, or auto-fit values; `span`/`rows`/`order` map to `[c]`/`[r]`/`[o]` for nested grid children. |
| `Stack` | Deprecated compatibility wrapper. Prefer `<div class="stack">…</div>`. |
| `Code` | `<pre><code>` block with optional language label. |
| `Badge`, `Icon` | Small label and tiny built-in SVG icon primitives. |
| `Socials`, `Social` | Social/link group wrapper and item. |
| `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus` | Native form primitives. Static-first; endpoint and provider handling stay explicit. |
| `Statement`, `Split` | Editorial statement and two-column content/media layout. |
| `Counter` | Animated number for lightweight stats. |
| `Tabs`, `Tab`, `TabPanel` | Accessible tab set with component-owned ARIA state. |
| `Slider` | Native scroll-snap gallery with previous/next controls. |
| `Gallery` | Single-item media gallery with counter and previous/next controls. |
| `Lottie` | Optional Lottie animation component. Add with `snz-bp add component lottie`; supports view, hover, click, manual, and scrub triggers. |
| `Marquee` | Continuous slot-first marquee with scroll-reactive direction/speed and reduced-motion fallback. |
| `Masonry` | Source-order masonry grid using row-span measurement. |

`<Logo />` is text-first. For an SVG or image mark, put the mark in the slot and keep sizing on the wrapper:

```html
<Logo size="2lh">
  <img src="/assets/images/logo.svg" alt="">
</Logo>
```

The logo wrapper owns `height`; nested `img`/`svg` uses `height: 100%; width: auto;`.

Anything else, you write yourself. That's the point.

## Grid primitive

Use attrs, not utility classes:

- `[g]` — grid container / column count
- `[c]` — child column span
- `[r]` — child row span
- `[o]` — visual order

Values split large-medium for `g`, `c`, and `r`: `g="4-2"`, `c="6-3"`, `r="2-1"`. One value applies to both large and medium. Small screens stack by default. Auto grids use `g="a"` (20rem min), `g="a-sm"` (10rem min), or `g="a-lg"` (30rem min).

`o` splits large-medium-small with values `f` (first), `a` (auto), `l` (last), and empty slots: `o="f-a"`, `o="-f"`.

`<Grid cols="4-2">` renders a fixed `[g]` container. `<Grid cols="a">` renders an auto-fit grid. `span`, `rows`, and `order` are only for cases where the grid itself is nested as a grid child.

## Anti-patterns (build refuses)

- Component file name doesn't match the PascalCase tag.
- Required attribute missing in an invocation.
- Lowercase component invocation (`<card />`).
- Unknown attribute on a strict schema.
- `<style>` block inside a route file (use components or page rules in `styles.css`).
- A leftover `*.schema.json` in `src/components/` — migrate to inline comment, then delete.
