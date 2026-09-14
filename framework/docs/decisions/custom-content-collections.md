# Custom content collections

**Status:** implemented v1, including collection scaffolding
**Date:** 2026-06-18

## Context

Current content compile is intentionally small:

- `content/posts/*.md` → `/insights/{slug}/` through `src/templates/post.html` by default; `collections.json` may override its route, template, path, and required fields
- optional custom collections compile through configured templates/routes
- posts also feed `/insights/`, `/tags/`, RSS, JSON Feed, and `BlogPosting` schema

Need custom collections for common client shapes (`projects`, `team`, `services`, `locations`) without turning the boilerplate into an enterprise CMS or generic page builder. Static `src/pages` and built-in posts must stay simple.

## Decision

Add custom collections as an optional build config layer. Keep `.pages.yml` editor-facing; do not make PagesCMS config the compiler source of truth.

Recommended config file:

```json
{
  "collections": [
    {
      "name": "projects",
      "label": "Projects",
      "path": "content/projects",
      "template": "project.html",
      "route": "work/{slug}",
      "required": ["title"],
      "fields": [
        { "name": "title", "type": "string", "required": true },
        { "name": "description", "type": "text" },
        { "name": "date", "type": "date" },
        { "name": "image", "type": "image" },
        { "name": "body", "type": "rich-text", "required": true }
      ]
    }
  ]
}
```

Suggested path: `content/collections.json`.

`posts` has defaults and requires no config:

| Collection | Path | Template | Route | Extra behavior |
| --- | --- | --- | --- | --- |
| `posts` | `content/posts` | `post.html` | `insights/{slug}` | insights index, tag routes, feeds, `BlogPosting` |
| custom | config `path` | config `template` | config `route` | none by default |

Generic `content/pages` is not compiled. Authored pages belong in `src/pages/`; `pages` stays reserved so CMS config cannot recreate a page-builder lane by accident.

## Smallest model

Collection definition:

| Key | Required | Rule |
| --- | --- | --- |
| `name` | yes | lowercase id: `[a-z][a-z0-9-]*`; `pages` reserved; `posts` overrides the default posts collection |
| `label` | no | CMS/editor label only |
| `path` | yes | repo-relative folder, normally `content/{name}` |
| `template` | yes | file in `src/templates/`; no path traversal |
| `route` | yes | public slug pattern with exactly one `{slug}` token; no leading/trailing slash required |
| `required` | no | front-matter keys required by compiler; default `['title']` |
| `fields` | no | docs/scaffold/PagesCMS mirror; compiler only validates required keys in v1 |

Route slug source:

- filename basename is canonical slug segment: `content/projects/acme.md` → `{slug}=acme`
- front-matter `slug` is non-goal for v1; avoid hidden URL drift
- filenames should be URL-safe lowercase slugs; future compiler should fail loudly on unsafe basenames instead of silently rewriting

Template variables:

- `{{body}}` = rendered markdown body, inserted as trusted build HTML
- `{{title}}`, `{{description}}`, etc. = front-matter fields, escaped by default
- dotted paths work for typed front matter, e.g. `{{service.title}}` inside loops
- `{#if field}{:else}{/if}` conditionally renders non-empty fields
- `{#each services as service, i}{/each}` loops YAML front-matter arrays
- `{{slug}}` = full route slug, e.g. `work/acme`
- `{{basename}}` = filename slug, e.g. `acme`
- `{{collection}}` = collection name
- unknown placeholders stay unchanged, matching current behavior

Template contract:

- custom templates live beside built-ins: `src/templates/project.html`
- template must include `{{body}}`
- template should include `{{title}}`
- no per-entry route files under `src/pages`

## PagesCMS relation

`content/collections.json` is build truth. `.pages.yml` mirrors it for editor UI.

For each custom collection, add a PagesCMS collection item:

```yaml
- name: projects
  label: Projects
  type: collection
  path: content/projects
  format: yaml-frontmatter
  filename: "{primary}.md"
  view:
    primary: title
  fields:
    - name: title
      type: string
      required: true
    - name: description
      type: text
    - name: image
      type: image
    - name: body
      type: rich-text
      required: true
```

Rules:

- `.pages.yml` may include custom fields for editing, but build does not infer route/template from it.
- `fields` in `content/collections.json` should match `.pages.yml` fields to prevent author confusion.
- relation/reference fields are editor data only in v1; compiler passes their front-matter value through as string/JSON placeholder data and does not join records.
- media keeps current behavior: image refs from `/src/images/*` or `/assets/images/*` normalize to `/assets/images/*.webp`.

Scaffolder command:

```bash
bun run new collection projects --route work/{slug} --template project
```

Command creates:

- `content/projects/`
- `src/templates/project.html`
- `content/collections.json` entry
- matching `.pages.yml` collection block

## Collision rules

All public routes share the existing route registry.

- built-in content and custom content fail on duplicate public slug.
- generated posts indexes (`insights`, `tags`, `tags/{tag}`) also fail on duplicate public slug.
- custom collection indexes are not generated in v1, so `src/pages/work/index.html` can coexist with custom entries under `work/{slug}`.
- route patterns that resolve to `index`, `404`, `insights`, `tags`, or any authored/static route must fail if they collide.
- same filename basename may exist in different collections only when route patterns produce different public slugs.

Error shape should stay loud:

```txt
Duplicate route slug "work/acme"
file: content/projects/acme.md
hint: content/projects/acme.md (content) conflicts with src/pages/work/acme.html (static) at /work/acme/
```

## Owner boundaries

`build/content.ts` owns:

- loading built-in + custom collection definitions
- validating collection config
- reading markdown files
- required front-matter checks
- draft filtering
- media ref normalization
- markdown rendering safety
- template loading and placeholder substitution
- returning `ContentRoute` records

`build/route-graph.ts` (`RouteGraph`) owns:

- slug normalization already produced by content compiler
- duplicate route detection
- source/kind conflict errors

`build/generated-routes.ts` owns:

- posts-only `/insights/`, `/tags/`, and `/tags/{tag}/`
- no custom collection indexes in v1

`build/feeds.ts` and `build/discovery.ts` own:

- posts-only feeds and `BlogPosting`
- custom content defaults to regular `WebPage` route JSON unless later config adds schema support

`.pages.yml` owns:

- editor sidebar and field widgets
- no compiler routing authority

## Non-goals

- no database-like joins
- no automatic custom indexes, filters, pagination, search, or archives
- no nested collection routing beyond literal path segments in `route`
- no front-matter `slug` override
- no dynamic runtime CMS
- no PagesCMS plugin or dependency
- no schema builder UI
- no custom collection feeds by default
- no per-entry route files in `src/pages`

## Migration path

1. Keep `posts` as a collection with defaults.
2. Remove implicit generic `content/pages`; authored pages stay in `src/pages`.
3. Add optional `content/collections.json`; if absent, only posts compile.
4. Keep fixture collection (`projects`) in tests only; no starter bloat by default.
5. `bun run new collection` updates both build config and `.pages.yml` together.

`content/pages` is not compiled; such markdown belongs in authored pages or a named custom collection.

## Implementation notes

Primary files:

- `build/content.ts` — introduce `ContentCollectionConfig`, `loadContentCollections()`, generic `compileFile(collectionConfig, filename)`
- `build/check.ts` — validate custom templates include `{{body}}`; validate route pattern and required fields
- `build/generated-routes.ts` — keep posts-only behavior by filtering `collection === 'posts'`; `src/templates/posts-index.html` and `tags.html` override the generated markup
- `build/feeds.ts` — keep posts-only input
- `build/discovery.ts` — avoid treating every custom content route as `BlogPosting`
- `build/scaffold.ts` — generates collection config, folder, template, and PagesCMS surface
- `.pages.yml` — only touched when adding actual starter/example custom collection
- `content/README.md` — documents opt-in config

Suggested type shape:

```ts
type ContentCollectionConfig = {
  name: string
  label?: string
  path: string
  template: string
  route: string
  required: string[]
  fields?: ContentFieldConfig[]
}
```

## Test plan

Add fixtures/tests before feature claim:

- default no-config compile emits posts only; `content/pages` is ignored/rejected at scaffold surface
- `projects` config compiles `content/projects/acme.md` through `src/templates/project.html` to `work/acme`
- route pattern missing `{slug}` fails with file/hint
- custom name `pages` fails as reserved
- missing template fails with existing `Missing template` style
- missing required front-matter fails with `content/{collection}/{file} missing "{field}"`
- custom route colliding with `src/pages` fails through `RouteGraph`
- draft custom content excluded in prod and included in dev with banner
- unsafe markdown still fails for custom collections
- media refs normalize in custom body and front-matter
- feeds and tag pages still include posts only

Verification once code lands:

```bash
bun test
bun run check
```

Docs-only planning change needs no build/check.
