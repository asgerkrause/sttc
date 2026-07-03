# CSS system

CSS is split by ownership. Global CSS owns system primitives. Components own component selectors.

```txt
src/styles.css              import shell / layer order
src/styles/system.css       tokens, fluid engine, colors, motion vars
src/styles/reset.css        reset and base elements
src/styles/type.css         type defaults and utilities
src/styles/grid.css         [g], [c], [r], [o]
src/styles/wrappers.css     .c, .w, .crd, .btns, .lnks
src/styles/motion.css       scroll/view-transition hooks
src/components/*.html       component <style>
```

Legacy `src/styles/styles.css` can exist in old projects. New work uses split files.

## Tokens

Use tokens instead of hardcoded spacing, radii, weights, and colors.

Layout:

```css
--l-mw; --l-mw-min; --l-mw-max;
--l-gc; --l-st;
```

Space, radius, border:

```css
--s-px; --s-py; --s-ss; --s-gp; --s-pd; --s-br; --s-bw;
--s-gp-xl; --s-gp-lg; --s-gp-sm; --s-gp-xs;
--s-pd-xl; --s-pd-lg; --s-pd-sm; --s-pd-xs;
--s-br-xl; --s-br-lg; --s-br-sm; --s-br-xs; --s-br-pill;
```

Type:

```css
--t-fw-l; --t-fw-r; --t-fw-b;
--t-ff-ss; --t-ff-se; --t-ff-mo;
--t-h0; --t-h1; --t-h2; --t-h3; --t-h4; --t-h5; --t-h6;
--t-lg-fs; --t-md-fs; --t-sm-fs;
--t-h1-fs-min; --t-h1-fs-max; --t-h1-lh-min; --t-h1-lh-max;
```

Color:

```css
--c-bg;   /* background */
--c-fg;   /* foreground */
--c-ink;  /* text ink */
--c-sur;  /* raised/tone surface */
--c-bor;  /* border */
--c-mut;  /* muted */
--c-acc; --c-acc-ink;  /* accent + accent ink */
--c-sec; --c-sec-ink;  /* secondary + ink */
```

Motion and interaction:

```css
--m-td-sf; --m-td-f; --m-td; --m-td-s; --m-td-ss;
--m-tf-io; --m-tf-i; --m-tf-o; --m-tf-g; --m-tf-s;
--i-hov-t; --i-hov-f;
```

Old short tokens are removed. CSS must use grouped tokens.

## Layout primitives

Use primitives directly before creating new layout CSS.

### Container

```html
<div class="c">
  <h1>Page title</h1>
</div>
```

`Section` includes `.c`:

```html
<Section>
  <h1>Title</h1>
</Section>
```

### Stack/wrap rhythm

```html
<div class="w">
  <h2>Heading</h2>
  <p>Body.</p>
  <Button href="/contact/" label="Contact" />
</div>
```

Prefer `.w` over `Stack`.

### Cards and action groups

```html
<article class="crd">
  <h3>Card title</h3>
  <p>Card body.</p>
</article>

<div class="btns">
  <Button href="/start/" label="Start" />
  <Button href="/contact/" label="Contact" variant="ghost" />
</div>

<div class="lnks">
  <Link href="/work/" label="See work" />
</div>
```

## Grid attrs

Use attrs, not utility class names.

| Attr | Purpose |
| --- | --- |
| `[g]` | grid container / column count |
| `[c]` | child column span |
| `[r]` | child row span |
| `[o]` | visual order |

Values split by breakpoint:

```html
<div g="4-2">
  <article c="2-1">Wide item</article>
  <article>Item</article>
  <article>Item</article>
</div>
```

`g`, `c`, and `r` accept large-medium values. Small screens stack by default.

`o` accepts large-medium-small values: `f` first, `a` auto, `l` last.

```html
<div g="2">
  <aside o="l-a-f">Moved visually</aside>
  <main>Main</main>
</div>
```

`<Grid>` maps to same attrs:

```html
<Grid cols="4-2">
  <Card>One</Card>
  <Card>Two</Card>
</Grid>
```

Use `span`, `rows`, and `order` on `<Grid>` only when grid itself is child of another grid.

## Themes

Sections and components can use theme tokens through `data-theme`.

```html
<Section theme="tone">
  <h2>Tone section</h2>
</Section>
```

Component attrs can pass theme:

```html
<Card theme="tone">...</Card>
```

Keep color usage token-based inside CSS:

```css
.notice {
  background: var(--c-bg);
  color: var(--c-ink);
  border: var(--s-bw) solid var(--c-bor);
}
```

## Class language

Classes should be rare, semantic, and short.

Use durable primitives:

```txt
.c .w .crd .btn .btns .lnk .lnks
```

Use type/tone utilities when useful:

```txt
.eb .f-* .t-* .fw-* .c-* .h*
```

Use private hooks only when they clarify ownership:

```txt
.brg .logo-mk .code-lb
```

Prefer semantic HTML, ARIA, data attributes, and component selectors before adding classes.

## Ownership rules

Put this in global CSS:

- tokens and themes;
- base element defaults;
- global layout primitives;
- typography utilities;
- page overrides with `html[data-page="slug"]`.

Put this in component `<style>`:

- component roots;
- component variants;
- component layout details;
- private hooks used only by one component.

Forbidden pattern:

```css
/* src/styles.css */
.faq { ... }
.hero-card { ... }
```

Preferred:

```html
<!-- src/components/FAQ.html -->
<style>
  .faq { ... }
</style>
```

## Page overrides

Use page data attr for one-off page rules:

```css
html[data-page="about"] .team-note {
  color: var(--c-mut);
}
```

Do not put `<style>` in route files.

## Audit

```bash
bun run css:audit
bun run doctor
```

`css:audit` reports component-owned selectors left in global CSS. `doctor` runs CSS audit plus strict check.

## Next

[Components](./05-components.md) · [Docs home](./README.md) · [Images](./07-images.md)
