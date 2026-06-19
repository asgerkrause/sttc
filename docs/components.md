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
<article class="card">{{slot}}</article>

<style>
  .card { /* ... */ }
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

## Variants (combo classes + nested CSS, no BEM)

`@attr variant=[...] :class` is the recommended pattern for component-specific variants:

```html
<!--
  @attr variant=[default|outlined|ghost] :class
  @attr theme=[tone|accent|invert]
-->
<article class="card" data-theme="{{theme}}">
  ...
</article>

<style>
  .card {
    /* base */
    &.outlined { border-color: var(--b); background: transparent; }
    &.ghost { background: transparent; }
    &[data-theme] { background: var(--s); color: var(--i); }
  }
</style>
```

`<Card theme="accent">` produces `<article class="card" data-theme="accent">`.

## Styles

Colocate component-specific `<style>` in the component file. The build extracts it into `dist/assets/css/components.{hash}.css` (loaded after the global stylesheet so component rules win at equal specificity).

Global CSS is split by owner: `src/styles.css` imports `src/styles/system.css`, `reset.css`, `type.css`, `grid.css`, `wrappers.css`, and `motion.css`. Global CSS owns tokens, reset/base type, `.c`, `.w`, `.btns`, `.lnks`, `[g]`, `[c]`, `[r]`, `[o]`, theme tokens, and page overrides. Component selectors such as `.card`, `.faq`, `.code`, `.img-w`, or private component roots belong in their component file.

Use design tokens from the global system. Layout: `--mw`, `--bx`, `--by`, `--ss`, `--gp`, `--pd`, `--br`, `--bw`. Type: `--fw-l`, `--fw-r`, `--fw-b`, plus `--md-*`, `--lg-*`, `--sm-*`, `--h0-*`…`--h6-*`. Color: `--s`, `--i`, `--t`, `--b`, `--g`, `--a`, `--ai`, `--c`, `--ci`. Don't hardcode spacing, font weights, or colors.

## Lifecycle scripts

Optional `<script>` block runs once per instance. `el` is bound to the root element. Return a function for cleanup.

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

## Built-in components (16)

| Component | Purpose |
|---|---|
| `Header`, `Footer` | Shell chrome. |
| `Logo` | Text-first site logo. Defaults to site.json name; slot can hold an SVG or img mark. |
| `SEO` | Per-route head injection (title, meta, OG, JSON-LD). |
| `Image` | Lazy webp with responsive srcset, blurhash placeholder. |
| `Embed` | Responsive iframe wrapper for video/maps/rich media. |
| `Button`, `Link` | Action / inline link primitives. |
| `Card` | Flexible styled container. Put headings, copy, media, and actions in the slot. |
| `Accordion`, `FAQ` | Native `<details>` disclosure + demo composite. |
| `Section` | Semantic section + `.c` container. No root class. |
| `Markdown` | Inline build-time markdown (use slot for source). Supports headings, lists, tables, code, safe links/images, and PascalCase components. |
| `Grid` | Attribute grid wrapper. `cols` maps to `[g]`; `span`/`rows`/`order` map to `[c]`/`[r]`/`[o]` for nested grid children. |
| `Stack` | Deprecated compatibility wrapper. Prefer `<div class="w">…</div>`. |
| `Code` | `<pre><code>` block with optional language label. |

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
