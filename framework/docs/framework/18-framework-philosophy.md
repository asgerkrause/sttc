# Framework philosophy

`@snz/bp` keeps authoring close to web platform defaults. The framework should remove repetitive build work, not hide HTML, CSS, or browser behavior.

## HTML first

Routes are HTML files. Components are HTML files. Markdown is optional content input. Output is static HTML and assets.

Use semantic HTML before helpers. Add attributes, classes, and scripts only when they earn their place.

## Build-time components

Components are compiled before output. They provide reusable markup, slots, attributes, colocated CSS, optional lifecycle scripts, and optional schema metadata.

This keeps runtime small. Most component work ends before browser loads page.

## Small runtime

Client runtime handles navigation, route cache, scroll reset, disclosures, prefetch, and component lifecycle mounting. It does not implement virtual DOM or hydration.

Use `window.snz` for page hooks and navigation. Use normal browser APIs for everything else.

## Bun native

Build, dev, scripts, image processing, and bundling use Bun. Project commands use `bun run ...`. Avoid npm-only assumptions.

## Strict source checks

Build should fail early when source is wrong:

- missing required component attributes;
- unknown component tags;
- unknown attributes on strict components;
- route `<style>` blocks;
- broken internal links;
- duplicate public slugs;
- missing discovery artifacts;
- legacy component schema sidecars.

Errors should point to source file, line, and fix hint when possible.

## CSS ownership

Global CSS owns system concerns: tokens, reset, type, grid, wrappers, motion, and page-level overrides. Component CSS owns component selectors and component composition edges.

This boundary keeps global CSS small and makes components portable.

## Generated output is disposable

`dist/` is build output. It can be deleted and rebuilt. Fix source files instead of patching generated files.

## Useful defaults, few assumptions

The framework includes routing, SEO artifacts, images, feeds, llms files, and content support because every site needs some version of them. It avoids runtime app frameworks, hydration conventions, and dependency-heavy stacks because most static sites do not need them.

## Next

[Troubleshooting](./17-troubleshooting.md) · [Docs home](./README.md) · [Glossary](./glossary.md)
