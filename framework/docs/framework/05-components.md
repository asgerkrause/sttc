# Components

A component is one `src/components/PascalName.html` file compiled at build time. Components are editable project source. STTC does not hydrate components or provide a component library.

## Contract comment

Declare the component contract in its leading comment:

```html
<!--
  @desc Introductory content block.
  @attr title! Visible heading.
  @attr id Optional section id.
  @attr variant=[default|featured] :class Optional root class.
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

When a schema exists, unknown attributes fail except for renderer-owned global attributes such as `track`.

Every component can read `{{siteName}}` and `{{currentYear}}`. Set `SOURCE_DATE_EPOCH` to Unix seconds when reproducible timestamps and year output are required.

## Slots and conditions

`{{slot}}` receives default children. Named slots use `{{slot:name}}` and `<slot name="name">`.

```html
<aside>
  <header>{{slot:title}}</header>
  <div>{{slot}}</div>
</aside>
```

Conditions can inspect attributes and slots:

```html
{#if href}
<a href="{{href}}">{{slot}}</a>
{:else}
<span>{{slot}}</span>
{/if}
```

Conditions stay flat. Nested blocks, expressions, and `else if` are unsupported.

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

The router mounts lifecycle components after navigation. A scripted root is marked `data-snz-component="Name"`. Mounted state stays in memory, not in the DOM. Use `snz.onActive` or `snz.onVisible` for timers, animation frames, autoplay media, and scroll work.

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

Authored route `<style>` blocks compile into route-owned hashed assets. Created projects import an editable CRFT copy from `src/styles/`; this is starter source, not framework CSS.

## Image and SEO boundaries

`Image` is compiler-assisted. Its template must render `{{imgMain}}` exactly once as element content. Image source names omit paths and extensions. Encode controls must be statically visible on a direct Image invocation; STTC fails instead of silently ignoring forwarded `max` or `quality` values.

`SEO` is a renderer directive. `src/components/SEO.html` is invalid.

## Generated catalog

Each build writes the current project's component contracts to:

```text
.snz/components-catalog.md
```

The catalog is generated state and must not be edited by hand.

## Errors

Builds fail for unknown or incorrectly cased components, invalid attributes, missing required values, malformed blocks, unresolved placeholders, legacy schema sidecars, component cycles, and invalid Image bridges. Nested failures include their source stack.
