# Agent workflow

Use this workflow when an AI coding assistant edits a SANITIZE Boilerplate site.

## Start card

**Goal:** understand source shape before editing.

**Read first:**

- `AGENTS.md`
- `framework/docs/agent-guide.md`
- `framework/docs/components.md` for component work
- `framework/docs/agent-recipes.md` for task cards

**Rules:**

- Use Bun only.
- Edit source, never `dist/`.
- Prefer existing components and primitives before new files.
- Keep changes narrow and easy to verify.

## Source map

| Need | Path |
| --- | --- |
| App shell | `src/shell.html` |
| Routes | `src/pages/**/*.html` |
| Components | `src/components/PascalCase.html` |
| Site config | `src/site.json` |
| Global CSS | `src/styles.css`, `src/styles/*.css` |
| Site JS | `src/app.ts` or `src/app.js` |
| Images | `src/images/` |
| CMS content | `content/**/*.md` |
| Build output | `dist/` — generated, do not edit |

## Work loop

1. Identify task type: route, component, CSS, image, content, config, or build error.
2. Read smallest relevant source files.
3. Reuse built-ins first: `Section`, `Grid`, `Card`, `Button`, `Link`, `Image`, `Markdown`, `Accordion`, `FAQ`, `SEO`.
4. Add new component only when markup repeats or needs owned CSS/script.
5. Put component CSS in component `<style>`.
6. Put page-only overrides in global CSS with `html[data-page="slug"]`.
7. Run smallest check that proves the change.
8. Report files changed and command result.

## Route workflow

**Use for:** new or edited public page.

**Likely files:**

- `src/pages/{slug}.html`
- `src/site.json` when defaults need update
- `src/images/*` when page adds images

**Steps:**

```bash
bun run new route pricing
```

Then write route body:

```html
<head>
  <SEO title="Pricing" description="Clear plans." />
</head>

<Section>
  <h1>Pricing</h1>
  <p>Choose the right fit.</p>
</Section>
```

**Check:**

```bash
bun run check
```

## Component workflow

**Use for:** reusable section, repeated markup, component-owned CSS, component lifecycle script.

**Likely files:**

- `src/components/PascalCase.html`
- route/component that uses it

**Steps:**

```bash
bun run new component Feature
```

Keep contract inline:

```html
<!--
  @desc Feature item.
  @attr variant=[default|accent] :class Visual variant.
-->
<article class="crd">
  {{slot}}
</article>

<style>
  .crd.accent {
    background: var(--a);
    color: var(--ai);
  }
</style>
```

**Check:**

```bash
bun run build
```

Run `bun run doctor` when CSS ownership changed.

## CSS workflow

**Global CSS owns:**

- tokens, reset, base type
- `.c`, `.w`, `.crd`, `.btns`, `.lnks`
- `[g]`, `[c]`, `[r]`, `[o]`
- theme tokens and page overrides

**Component CSS owns:**

- private roots
- component variants
- component composition edges
- lifecycle-related states

**Check:**

```bash
bun run css:audit
```

Use `bun run doctor` when preparing broader CSS changes.

## Content workflow

**Use CMS when editors need markdown pages/posts.**

```bash
bun run new cms
```

Paths:

- `content/posts/intro.md` → `/insights/intro/`

Frontmatter needs `title`.

**Check:**

```bash
bun run check
```

## Verification ladder

| Change | Minimum proof |
| --- | --- |
| Docs-only | no command required unless links/generated docs changed |
| Route/content/image/config | `bun run check` |
| Component/build behavior | `bun run build` |
| CSS ownership | `bun run css:audit` or `bun run doctor` |
| Launch handoff | `bun run doctor -- --launch` |

## Done report

Return:

- files changed
- command run
- result or exact error
- any follow-up needed

## Next

[Launch checks](./14-launch-checks.md) · [Docs home](./README.md) · [Recipes](./16-recipes.md)
