---
name: snz-collection
description: Use when deciding whether SANITIZE content belongs in authored pages, posts, or a custom PagesCMS-backed collection.
---
<!-- @snz-skill snz-collection 93f2b5fad3dde56321d44f7fa892f9acdbde13eec5b6697b7e752bded7606e92 -->

# SANITIZE Collection

## Principle

Choose the content model before scaffolding. Authored pages own layouts; posts own editorial publishing; custom collections own repeated records with one fixed template.

## Workflow

1. Read `AGENTS.md` and `node_modules/@byak/sttc/framework/docs/decisions/custom-content-collections.md` when available.
2. Classify the request:
   - authored page → `src/pages/`;
   - dated editorial content → built-in posts;
   - repeated client-editable records → custom collection.
3. For a custom collection, define a lowercase name, label, one route containing exactly one `{slug}`, one template filename, and required fields.
4. Run `bun run new collection <name> --route '<path>/{slug}' --template <name>`.
5. Treat `content/collections.json` as compiler authority. Keep `.pages.yml` as a matching editor configuration, never compiler truth.
6. Build the fixed shell in `src/templates/<name>.html`; records live in `content/<collection>/*.md`. Filenames own slugs.
7. Inspect authored and generated routes for collisions, then run `bun run check`.

## Boundaries

Custom collections do not provide automatic indexes, feeds, joins, pagination, runtime CMS rendering, or frontmatter slug overrides. Do not imply those features exist. An authored index may be created separately only when its content and maintenance model are explicit.

Do not use a collection as a generic page builder. If every record needs a different structure, use authored pages.

## Evidence to return

- Why the chosen content model fits.
- Collection name, route, template, required fields, and canonical slug rule.
- Route-collision result and exact verification output.
