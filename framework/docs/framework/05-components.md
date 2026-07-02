# Components

Components are build-time HTML templates in `src/components`. One component equals one `PascalCase.html` file.

```txt
src/components/Card.html   <Card>...</Card>
src/components/Hero.html   <Hero>...</Hero>
```

No JSON sidecars. Component file is contract, template, styles, and optional behavior.

## Basic component

```html
<!-- src/components/Feature.html -->
<!--
  @desc Feature item with title and body.
  @attr title! Heading text.
  @attr variant=[default|accent] :class Visual style.
-->
<article class="crd">
  <h2>{{title}}</h2>
  <div>{{slot}}</div>
</article>

<style>
  .crd.accent {
    background: var(--c-acc-05);
  }
</style>
```

Use it in routes or other components:

```html
<Feature title="Fast" variant="accent">
  Static output, tiny runtime.
</Feature>
```

## Inline schema

Component may start with one HTML comment. Build parses known directives and strips comment from output.

| Directive | Meaning |
| --- | --- |
| `@desc Text.` | Catalog description. |
| `@attr name Text.` | Optional attribute. |
| `@attr name! Text.` | Required attribute. |
| `@attr name=[a\|b] Text.` | Enum attribute. |
| `@attr name :class Text.` | Append value as root class. |
| `@schema Type field=attr,...` | Emit JSON-LD per instance. |

Combinations work:

```html
<!--
  @attr variant=[default|ghost|accent] :class Visual style.
  @attr href Optional link URL.
-->
```

Build fails on missing required attrs, invalid enum values, unknown attrs on strict schemas, and PascalCase tag mismatches.

## Build-time JSON data

Components can include local build-only data for small static lists. The script is stripped from output and never runs in the browser.

```html
<!-- src/components/FeatureList.html -->
<script type="application/json" data-snz>
{
  "items": [
    { "label": "Fast" },
    { "label": "Static" }
  ]
}
</script>

<ul>
  {#each items as item}
  <li>{{item.label}}</li>
  {/each}
</ul>
```

Loops keep source order unless a sort clause is declared. Sort keys are item-relative dotted paths and can use multiple tie-breakers.

```html
{#each items sort name asc as item}
<li>{{item.name}}</li>
{/each}

{#each cases sort featured desc, date desc as item}
<Card title="{{item.title}}" />
{/each}
```

Placeholders do not run JavaScript. Use built-in filters for common text transforms:

```html
{{service.name | lower}}
{{service.name | slug}}
```

External component data uses the same `src/data/` rule:

```html
<script type="application/json" data-snz src="features.json"></script>
```

Attrs and slots still win over component data when names overlap.

## Attributes and slots

Use `{{name}}` for attrs and `{{slot}}` for children.

```html
<!-- src/components/Banner.html -->
<aside class="banner">
  <strong>{{slot:title}}</strong>
  <div>{{slot}}</div>
</aside>
```

```html
<Banner>
  <slot name="title">Heads up</slot>
  Default slot body.
</Banner>
```

Use attrs for stable configuration: variant, theme, href, IDs, labels, image names. Use slots for rich content.

## Variants

Prefer `:class` enum variants and combo classes. Avoid BEM.

```html
<!--
  @attr variant=[default|outlined|ghost] :class Visual style.
  @attr theme=[tone|invert] Theme token set.
-->
<article class="crd" data-theme="{{theme}}">
  {{slot}}
</article>

<style>
  .crd {
    &.outlined { border-color: var(--c-bor); background: transparent; }
    &.ghost { background: transparent; }
    &[data-theme] { background: var(--c-bg); color: var(--c-ink); }
  }
</style>
```

`<Card variant="ghost">` style should read as `.crd.ghost`, not `.card--ghost`.

## Styles

Put component-owned CSS inside component `<style>`.

```html
<style>
  .feature {
    display: grid;
    gap: var(--s-gp);
  }
</style>
```

Build extracts all component styles to `dist/assets/css/components.{hash}.css`. Shell loads it after global CSS.

Global CSS owns tokens, reset/base type, `.c`, `.w`, `.crd`, `.btns`, `.lnks`, `[g]`, `[c]`, `[r]`, `[o]`, themes, and page overrides. Component roots like `.faq`, `.code`, `.img-w`, `.hero`, `.feature` belong in component files.

## Lifecycle scripts

Optional component `<script>` runs once per instance. `el` is bound to component root. Return cleanup when adding listeners or observers.

```html
<button class="counter" type="button">
  <span class="counter-label">{{label}}</span>
  <span class="counter-value">0</span>
</button>

<script>
  const value = el.querySelector('.counter-value')
  let n = 0
  const onClick = () => {
    n += 1
    value.textContent = String(n)
  }
  el.addEventListener('click', onClick)
  return () => el.removeEventListener('click', onClick)
</script>
```

Build injects `data-snz-component="Name"` on root. Runtime mounts component scripts after initial render and each navigation, and runs cleanup before route replacement.

## Built-ins

Read generated [`../components-catalog.md`](../components-catalog.md) for current built-in list, contracts, attrs, slots, and examples. Common primitives include `Section`, `Grid`, `Card`, `Button`, `Link`, `Image`, `Markdown`, `Accordion`, `FAQ`, and `SEO`.

`Stack` exists for compatibility. Prefer `.w`.

## Slot-first presets

New content components should read like content:

- plural wrapper: `Features`, `Testimonials`, `Stats`, `Partners`
- singular item: `Feature`, `Testimonial`, `Stat`, `Partner`
- standalone section: `Hero`, `CTA`, `Contact`

Prefer slots so existing primitives compose:

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

## Check component work

```bash
bun run build
```

For CSS boundary cleanup:

```bash
bun run css:audit
bun run doctor
```

## Next

[Shell](./04-shell.md) · [Docs home](./README.md) · [CSS system](./06-css-system.md)
