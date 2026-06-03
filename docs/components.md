# Authoring components

This is the contract for adding or editing components. Read it before touching `src/components/`.

## One file per component

A component is **one HTML file** in `src/components/`, named `PascalCase.html`.

No JSON sidecars. No README in `src/components/`. The file *is* the component.

## Inline schema

Each component file may start with a single `<!-- ... -->` HTML comment that declares its contract. The build parses it; the comment is stripped from the rendered output.

```html
<!--
  @desc Article card with title, body, optional CTA, and a default slot.
  @attr title! Card heading.
  @attr body Body paragraph. Optional — also supports children via default slot.
  @attr variant=[default|elevated|ghost|subtle] :class Visual variant.
-->
<article class="card">
  <h2>{{title}}</h2>
  <div class="card-body">
    <p>{{body}}</p>
    {{slot}}
  </div>
</article>

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

Combinations work: `@attr variant=[primary|ghost|subtle] :class Visual style.`

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
  @attr variant=[default|elevated|ghost] :class
-->
<article class="card">
  ...
</article>

<style>
  .card {
    /* base */
    &.elevated { box-shadow: var(--shadow-md); }
    &.ghost { background: transparent; }
  }
</style>
```

`<Card variant="elevated">` produces `<article class="card elevated">`.

## Styles

Colocate component-specific `<style>` in the component file. The build extracts it into `dist/assets/css/components.{hash}.css` (loaded after the global stylesheet so component rules win at equal specificity).

`src/styles/styles.css` owns tokens, reset/base type, `.c`, `.w`, `[g]`, `[c]`, `[r]`, `[o]`, theme tokens, and page overrides. Component selectors such as `.card`, `.faq`, `.code`, `.img-w`, or private component roots belong in their component file.

Use design tokens from `src/styles/styles.css`. Don't hardcode spacing or colors.

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

## Built-in components (15)

| Component | Purpose |
|---|---|
| `Header`, `Footer` | Shell chrome. |
| `SEO` | Per-route head injection (title, meta, OG, JSON-LD). |
| `Image` | Lazy webp with responsive srcset, blurhash placeholder. |
| `Button`, `Link` | Action / inline link primitives. |
| `Card` | Article card with title/body/CTA/slot. |
| `Accordion`, `FAQ` | Native `<details>` disclosure + demo composite. |
| `Section` | Semantic section + `.c` container. No root class. |
| `Markdown` | Inline build-time markdown (use slot for source). Supports headings, lists, tables, code, safe links/images, and PascalCase components. |
| `Grid` | Attribute grid wrapper. `cols` maps to `[g]`; `span`/`rows`/`order` map to `[c]`/`[r]`/`[o]` for nested grid children. |
| `Stack` | Deprecated compatibility wrapper. Prefer `<div class="w">…</div>`. |
| `Code` | `<pre><code>` block with optional language label. |

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
