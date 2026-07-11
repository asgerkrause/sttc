# Content and CMS

SANITIZE Boilerplate keeps content static at runtime. Markdown and CMS files compile during `bun run build`; output lands in `dist/`.

## Content sources

| Source | Output | Use |
| --- | --- | --- |
| `src/pages/**/*.html` | authored routes | fixed marketing pages |
| `content/posts/*.md` | `/insights/{slug}/` | insights/blog content |
| `content/collections.json` + custom folders | configured routes | optional project/team/service/location entries |
| `src/site.json` | site metadata | SEO defaults, feeds, discovery artifacts |

Static routes and content routes share one public slug registry. Duplicate public routes fail build.

## Enable CMS surface

Run:

```bash
bun run new cms
```

This creates the PagesCMS surface: `.pages.yml`, `content/`, `src/images/`, and `src/templates/`.

PagesCMS is editor UI only. Build truth remains source files and optional `content/collections.json`.

## Built-in collections

Posts:

```txt
content/posts/intro.md -> /insights/intro/
```

Minimum markdown file:

```md
---
title: About
description: Why this page exists.
---

Markdown body.
```

Posts may include `date`, `description`, `tags`, `image`, and `draft`.

Drafts:

- `draft: true` excluded from production builds
- draft content included in dev builds for review
- launch checks fail if draft content leaks into production output

## Templates

Built-in content renders through:

- `src/templates/post.html`

Templates can use front-matter placeholders, `{{body}}`, conditionals, and array loops:

```html
<Section>
  <article class="stack">
    <h1>{{title}}</h1>
    {#if image}
    <Image src="{{image}}" alt="{{title}}" />
    {:else}
    <p>No image yet.</p>
    {/if}
    {{body}}
  </article>
</Section>
```

```html
<Grid>
  {#each services as service, i}
  <Card title="{{service.title}}">
    <p>{{service.body}}</p>
  </Card>
  {/each}
</Grid>
```

`{#each}` reads YAML front-matter arrays. Use `as item` plus optional index alias (`as item, i`). Source order is preserved unless a sort clause is declared. Sort keys are item-relative dotted paths and can use multiple tie-breakers.

```html
{#each services sort title asc as service, i}
<Card title="{{service.title}}">
  <p>{{service.body | lower}}</p>
</Card>
{/each}

{#each cases sort featured desc, date desc as item}
<Card title="{{item.title}}" />
{/each}
```

Placeholders support `lower` and `slug` filters. No JavaScript expressions, nesting, or `{:else if ...}` yet.

Use PascalCase components in templates when layout matters. Avoid per-entry route files for posts; authored pages stay in `src/pages`.

## Markdown support

Markdown renders at build time through the framework renderer.

Supported surface:

- headings with stable anchors
- paragraphs
- ordered and unordered lists
- blockquotes
- horizontal rules
- fenced code blocks with language classes
- tables
- links and images
- inline code, strong, emphasis
- controlled inline HTML
- PascalCase component tags passed through to component composition

Safety rules:

- unsafe tags fail, including `<script>`, `<style>`, `<iframe>`, embeds, and form controls
- unsafe URL protocols fail, including `javascript:`
- ordinary HTML is escaped by default

For rich layout, prefer templates or components over raw markdown HTML.

## Images from CMS

PagesCMS uploads use `src/images/`. Build normalizes image output to `/assets/images/*.webp` where supported by image pipeline.

Keep logical basenames unique across image roots.

## Custom collections

Optional config path:

```txt
content/collections.json
```

Example:

```json
{
  "collections": [
    {
      "name": "projects",
      "path": "content/projects",
      "template": "project.html",
      "route": "work/{slug}",
      "required": ["title"]
    }
  ]
}
```

Rules:

- `name` is lowercase id; `posts` and `pages` are reserved
- `path` is repo-relative content folder
- `template` points to a file in `src/templates/`
- `route` must include exactly one `{slug}` token
- filename basename is canonical slug
- custom collections do not create indexes, feeds, tag pages, or archives by default

`fields` may mirror `.pages.yml` for editor clarity, but compiler v1 validates only required keys.

## Checks

Use:

```bash
bun run check
bun run doctor -- --launch
```

Launch mode adds checks for public `site.url`, OG image, private URLs, duplicate titles, descriptions, image alt text, discovery artifacts, and draft leakage.

## Next

[Images](./07-images.md) · [Docs home](./README.md) · [SEO, AEO, and GEO](./09-seo-aeo-geo.md)
