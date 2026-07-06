# Troubleshooting

Fast fixes for SANITIZE Boilerplate failures.

## First response

1. Re-run failing Bun command.
2. Read exact file, line, and hint.
3. Fix source file, not `dist/`.
4. Re-run same command.
5. If fixing CSS ownership, run `bun run css:audit` or `bun run doctor`.

## Command map

| Symptom | Command |
| --- | --- |
| Build or validation fail | `bun run check` |
| Component/build behavior changed | `bun run build` |
| CSS ownership warning | `bun run css:audit` |
| Broad CSS or preflight | `bun run doctor` |
| Launch readiness | `bun run doctor -- --launch` |
| Dev error page shown | fix source, save, dev server rebuilds |

## Build says unknown component

**Likely cause:** PascalCase tag typo or missing component file.

**Check:**

- tag is PascalCase: `<Feature>` not `<feature>`
- file exists: `src/components/Feature.html`
- filename matches tag exactly
- component is built-in or authored

**Fix:** correct tag or create component.

## Required attribute missing

**Likely cause:** component schema has `@attr name!` and invocation omits it.

**Check:** component comment at top of `src/components/PascalCase.html`.

**Fix:** add required attr or make schema optional only when empty value is valid.

```html
<Button href="/contact/" label="Contact" />
```

## Unknown attribute on component

**Likely cause:** strict schema does not declare attr used by invocation.

**Fix options:**

- remove unused attr
- declare attr in component comment
- use slot content instead of prop if content is rich

Prefer slots for content. Use attrs for stable config: variant, theme, href, image source, labels, IDs.

## Enum variant fails

**Likely cause:** attr value not listed in schema enum.

```html
<!-- @attr variant=[default|accent] :class Visual variant. -->
```

`variant="loud"` fails.

**Fix:** use allowed value or add new enum value and matching CSS.

## Route style block fails

**Likely cause:** route files cannot contain `<style>`.

**Fix options:**

- move reusable styles into component `<style>`
- move page-only override into global CSS:

```css
html[data-page="pricing"] .pricing-note {
  max-width: 60ch;
}
```

## Broken internal link

**Likely cause:** link points to route that does not exist or lacks trailing slash shape.

**Check:**

- `src/pages/about.html` → `/about/`
- `src/pages/blog/index.html` → `/blog/`
- `src/pages/work/case.html` → `/work/case/`
- content routes can also own slugs

**Fix:** create target route or correct `href`.

## Duplicate slug

**Likely cause:** authored route, CMS content, or generated route owns same public path.

**Common collisions:**

- `src/pages/about.html` and a generated content route with the same slug
- generated `/insights/` and authored `/insights/`
- custom collection route overlaps authored page

**Fix:** rename one source or change custom collection route pattern.

## Markdown fails

**Likely cause:** unsafe HTML, unsafe URL protocol, or invalid embedded component.

**Fix:**

- remove unsafe HTML
- use safe `http`, `https`, `mailto`, or site-relative links
- keep PascalCase component tags valid
- move layout-heavy content to template/component

## Image missing or wrong

**Likely cause:** basename mismatch, duplicate basename, or wrong root.

**Check:**

- master lives in `src/images/` or PagesCMS media image root
- `<Image src="hero" />` references basename, no extension
- basename is unique across image roots
- `Bun.Image` support requires Bun version from project requirements

**Fix:** rename duplicate or correct `src`.

## Image styling not applying

**Likely cause:** styling old/private selector.

**Use:**

- `.img-w img` for actual image
- `.img-tmp` for lazy preview

**Do not use:** `.img-main`.

## CSS audit flags component selectors

**Likely cause:** private component selectors in global CSS.

**Fix:** move selector into owning component `<style>`.

Global CSS should own tokens, reset/base type, `.c`, `.w`, `.crd`, `.btns`, `.lnks`, `[g]`, `[c]`, `[r]`, `[o]`, theme tokens, and page overrides.

## Layout breaks on small screens

**Likely cause:** grid attrs or custom utility classes fighting framework defaults.

**Use:**

```html
<div g="4-2">
  <article c="2-1">Feature</article>
  <article>Item</article>
</div>
```

Small screens stack by default. Use split values for large/medium: `g="4-2"`, `c="6-3"`, `r="2-1"`. Use auto-fit values when item count is unknown: `g="a"`, `g="a-sm"`, `g="a-lg"`.

## Route script does not run

**Likely cause:** inline script is not at top of route.

**Rule:** route inline `<script>` allowed only at top. Build wraps it in `snz.onPage('{slug}', ...)`.

**Fix:** move script to top of route or into `src/app.ts` with `snz.onPage()`.

## App entry conflict

**Likely cause:** both `src/app.ts` and `src/app.js` exist.

**Fix:** keep one root app entry. Prefer `src/app.ts`. Legacy `src/app/app.js` works only when no root app entry exists.

## CMS page missing

**Likely cause:** CMS not scaffolded, missing frontmatter, draft excluded, or route collision.

**Check:**

- `bun run new cms` has created needed files
- markdown has `title`
- posts with `draft: true` are excluded from production builds
- no authored route owns same slug

## Launch check fails

**Likely cause:** starter placeholders or incomplete site metadata.

**Check:**

- public `src/site.json.url`
- site description
- OG image
- route titles/descriptions
- one useful H1 per page
- image alt text
- link text not vague or icon-only
- no private URLs
- discovery artifacts emitted

**Fix:** update source metadata/content, then rerun:

```bash
bun run doctor -- --launch
```

## Never fix by editing `dist/`

`dist/` is generated output. Any direct edit disappears on next build and hides real source bugs.

Fix source in `src/`, optional `content/`, `framework/`, or docs, then rebuild.

## Next

[Recipes](./16-recipes.md) · [Docs home](./README.md) · [Framework philosophy](./18-framework-philosophy.md)
