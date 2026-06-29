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
  @attr variant=[default|outlined|ghost] :class Visual variant.
  @attr theme=[tone|accent|invert] Optional data-theme value.
-->
<article class="crd">{{slot}}</article>

<style>
  .crd:has(.img-w) { /* component-specific composition edge */ }
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
<a class="btn" href="{{href}}" aria-label="{{label}}">
  {#if slot:vis}
  <span class="btn-vis-w" aria-hidden="true">{{slot:vis}}</span>
  {:else}
  <span class="btn-vis-w" aria-hidden="true">→</span>
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
  @attr variant=[default|outlined|ghost] :class
  @attr theme=[tone|accent|invert]
-->
<article class="crd" data-theme="{{theme}}">
  ...
</article>

<style>
  .crd {
    /* base */
    &.outlined { border-color: var(--b); background: transparent; }
    &.ghost { background: transparent; }
    &[data-theme] { background: var(--s); color: var(--i); }
  }
</style>
```

`<Card theme="accent">` produces `<article class="crd" data-theme="accent">`.

## Styles

Colocate component-specific `<style>` in the component file. The build extracts it into `dist/assets/css/components.{hash}.css` (loaded after the global stylesheet so component rules win at equal specificity).

Global CSS is split by owner: `src/styles.css` imports `src/styles/system.css`, `reset.css`, `type.css`, `grid.css`, `wrappers.css`, and `motion.css`. Global CSS owns tokens, reset/base type, `.c`, `.w`, `.crd`, `.btns`, `.lnks`, `[g]`, `[c]`, `[r]`, `[o]`, theme tokens, and page overrides. Component selectors such as `.faq`, `.code`, `.img-w`, or private component roots belong in their component file.

Class language is short and rare. Prefer semantic HTML, ARIA, and data attributes first. Use durable primitives (`.c`, `.w`, `.crd`, `.btn`, `.btns`, `.lnk`, `.lnks`), type/tone utilities (`.eb`, `.f-*`, `.fw-*`, `.c-*`, `.h*`), or short private hooks (`.brg`, `.logo-mk`, `.code-lb`) only when useful.

Use design tokens from the global system. Layout: `--mw`, `--px`, `--py`, `--ss`, `--gp`, `--pd`, `--br`, `--bw`. Type: `--fw-l`, `--fw-r`, `--fw-b`, plus `--md-*`, `--lg-*`, `--sm-*`, `--h0-*`…`--h6-*`. Color: `--s`, `--i`, `--t`, `--b`, `--g`, `--a`, `--ai`, `--c`, `--ci`. Don't hardcode spacing, font weights, or colors.

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
| `Accordion`, `FAQ` | Native `<details>` disclosure + demo composite. |
| `Section` | Semantic section + `.c` container. No root class. |
| `Markdown` | Inline build-time markdown (use slot for source). Supports headings, lists, tables, code, safe links/images, and PascalCase components. |
| `Grid` | Attribute grid wrapper. `cols` maps to `[g]`; `span`/`rows`/`order` map to `[c]`/`[r]`/`[o]` for nested grid children. |
| `Stack` | Deprecated compatibility wrapper. Prefer `<div class="w">…</div>`. |
| `Code` | `<pre><code>` block with optional language label. |
| `Badge`, `Icon` | Small label and tiny built-in SVG icon primitives. |
| `Socials`, `Social` | Social/link group wrapper and item. |
| `Form`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Fieldset`, `Submit`, `FormStatus` | Native form primitives. Static-first; endpoint and provider handling stay explicit. |
| `Statement`, `Split` | Editorial statement and two-column content/media layout. |
| `Counter` | Animated number for lightweight stats. |
| `Tabs`, `Tab`, `TabPanel` | Accessible tab set with component-owned ARIA state. |
| `Slider` | Native scroll-snap gallery with previous/next controls. |
| `Gallery` | Single-item media gallery with counter and previous/next controls. |
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

Values split large-medium for `g`, `c`, and `r`: `g="4-2"`, `c="6-3"`, `r="2-1"`. One value applies to both large and medium. Small screens stack by default.

`o` splits large-medium-small with values `f` (first), `a` (auto), `l` (last), and empty slots: `o="f-a"`, `o="-f"`.

`<Grid cols="4-2">` renders a `[g]` container. `span`, `rows`, and `order` are only for cases where the grid itself is nested as a grid child.

## Anti-patterns (build refuses)

- Component file name doesn't match the PascalCase tag.
- Required attribute missing in an invocation.
- Lowercase component invocation (`<card />`).
- Unknown attribute on a strict schema.
- `<style>` block inside a route file (use components or page rules in `styles.css`).
- A leftover `*.schema.json` in `src/components/` — migrate to inline comment, then delete.
