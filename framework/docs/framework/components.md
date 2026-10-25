# Components

A component is one `src/components/PascalName.html` file compiled at build time. Components are editable project source. STTC does not hydrate components or provide a component library.

Invoke a component with a PascalCase tag. Attributes use double quotes or are bare flags; a single-quoted or otherwise malformed attribute list fails the build and names the tag, the component file, and the page:

```html
<Hero id="intro" title="A faster starting point">Project-owned content.</Hero>
```

## Contract comment

Declare the component contract in its leading comment:

```html
<!--
  @desc Introductory content block.
  @attr title! Visible heading.
  @attr id! Meaningful section id.
  @schema WebPageElement name=title
-->
<section id="{{id}}">
  <h1>{{title}}</h1>
  <div>{{slot}}</div>
</section>
```

Supported directives:

| Syntax | Meaning |
|---|---|
| `@desc text` | Component purpose. |
| `@attr name text` | Optional string attribute. |
| `@attr name! text` | Required non-empty attribute. `Image alt=""` is the accessibility exception. |
| `@attr name=[a\|b] text` | Enumerated value. |
| `@attr name :class text` | Append validated tokens to the root class. |
| `@schema Type field=attr` | Emit instance JSON-LD. |

An unknown `@tag` or a malformed `@attr` line fails the build with the component file and line. When a schema exists, unknown attributes fail except for renderer-owned global attributes such as `track`.

Every component can read `{{siteName}}` and `{{currentYear}}`. Set `SOURCE_DATE_EPOCH` to Unix seconds when reproducible timestamps and year output are required.

## Placeholders and escaping

Attribute values are HTML attribute text: `title="Tom &amp; Jerry"` decodes once when the tag is parsed, and every `{{placeholder}}` escapes once when it renders. The output is `Tom &amp; Jerry` whether or not the component carries a data block. Slots and `Image` markup are inserted raw. Page titles follow the same rule: `<SEO title="Terms &amp; Conditions" />` yields `<title>Terms &amp; Conditions</title>` and `Terms & Conditions` in JSON-LD and `llms.txt`.

## Slots and conditions

`{{slot}}` receives default children. Named slots use `{{slot:name}}` and `<slot name="name">`.

```html
<aside>
  <header>{{slot:title}}</header>
  <div>{{slot}}</div>
</aside>
```

Conditions test an attribute, a slot, or a dotted data path for a non-empty value:

```html
{#if href}
<a href="{{href}}">{{slot}}</a>
{:else if slot:title}
<strong>{{slot:title}}</strong>
{:else}
<span>{{slot}}</span>
{/if}
```

Blocks nest: `{#if}` inside `{#each}` and `{#each}` inside `{#if}` both render per item. Expressions are unsupported.

## Build-time JSON

A component can declare inline JSON or load `src/data/*.json`:

```html
<script type="application/json" data-snz>
{ "items": [{ "name": "One" }, { "name": "Two" }] }
</script>

<ul>
{#each items as item, i}
  <li data-index="{{i}}">{{item.name}}</li>
{/each}
</ul>
```

Loops support item-relative dotted paths, stable sorting, and the `lower` and `slug` filters. STTC never executes build-time project JavaScript or TypeScript.

## Lifecycle script

An executable component `<script>` runs once for each rendered instance. `el` is the component root. Return cleanup for registered work:

```html
<button type="button">Count: <span>0</span></button>

<script>
const value = el.querySelector('span')
let count = 0
const click = () => { value.textContent = String(++count) }
el.addEventListener('click', click)
return () => el.removeEventListener('click', click)
</script>
```

The page runtime mounts lifecycle components once per document, on `DOMContentLoaded`. A scripted root is marked `data-snz-component="Name"`. Mounted state stays in memory, not in the DOM. Use `snz.onActive` or `snz.onVisible` for timers, animation frames, autoplay media, and scroll work. A syntax error in a component or shell `<script>` fails the build with that file named. See [Runtime](./runtime.md).

## Component CSS

A component can own normal CSS:

```html
<article class="notice">{{slot}}</article>

<style>
.notice {
  border: 1px solid currentColor;
  padding: 1rem;
}
</style>
```

STTC strips component styles from markup. It emits each used component's CSS once in one content-hashed shared stylesheet. It registers each used lifecycle script once in the shared app bundle. Components unused by the shell or any built route contribute neither asset. Selectors remain global and project-owned.

An authored route may also carry a `<style>` block; it compiles into a route-owned hashed asset linked with `data-snz-route-css`. Content templates under `src/templates/` may not. Created projects import editable Craft v3 CSS from `src/styles/`; this is optional project source. The renderer remains CSS-agnostic.

## Starter presentation contracts

The starter contains exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`. Their markup and CSS remain project-owned.

`Section` renders `section > .c`. Its `c` input accepts `sm` and `lg` to select container classes. Give every direct `main > section` a meaningful, nonempty, unique ID, including the 404 route. Keep classes off `section`. Numbered responsive grids belong inside the `section > .c` container boundary.

`Grid` keeps its public inputs: `cols` emits `g` tracks, `x` emits a `c` column span, `y` emits an `r` row span, and `order` emits `o`. A span applies when the component is a direct grid child. Visual order does not change reading or keyboard order.

Craft `.s` handles vertical flow only. Header rows, wrapping, and alignment use bounded component CSS. Type roles use classes such as `.lead` and `.small`; native `h4`–`h6` keep their semantics with `h3` styling. The flat CSS package and migration scope are documented in [Craft v3 adoption](../decisions/craft-v3-adoption.md).

## Image and SEO boundaries

`Image` is compiler-assisted. Its template must render `{{imgMain}}` exactly once as element content. Image source names omit paths and extensions. Encode controls must be statically visible on a direct Image invocation; STTC fails instead of silently ignoring forwarded `max` or `quality` values. See [Images](./images.md).

The renderer owns `<SEO />`. `src/components/SEO.html` is invalid, and `<SEO />` is valid only inside a route's leading `<head>` wrapper. See [SEO, AEO, and GEO](./seo-aeo-geo.md).

## Generated catalog

Each build writes the current project's component contracts to:

```text
.snz/components-catalog.md
```

The catalog is generated state and must not be edited by hand.

## Errors

Builds fail for unknown or incorrectly cased components, malformed attribute lists, invalid attributes, missing required values, malformed blocks, unresolved placeholders, invalid contract comments, component cycles, and invalid Image bridges. Errors name the component file and the page that invoked it; nested failures include their source stack.
