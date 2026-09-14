# Content and CMS

CMS is optional. Start with:

```bash
bun run new cms
bun run new post hello-world
bun run new collection projects --route work/{slug} --template project
```

`new cms` creates PagesCMS configuration, `content/posts/`, an image input, and `src/templates/post.html`. Authored pages remain in `src/pages/`.

## Posts

`posts` is an ordinary collection with defaults: records in `content/posts/`, template `src/templates/post.html`, route `insights/{slug}`. Posts require title, date, and description. Drafts are excluded from production and included in development. Tags generate `/tags/` and `/tags/{tag}/`; posts generate the index at the route prefix (`/insights/` by default), RSS, JSON Feed, and `BlogPosting` schema. Feeds are written only when at least one public post exists.

To change the posts route, declare `posts` in `content/collections.json`; `route`, `template`, `path`, and `required` override the defaults, and the index moves to the new prefix:

```json
{
  "collections": [
    { "name": "posts", "route": "blog/{slug}" }
  ]
}
```

The generated index and tag pages use renderer markup unless the project supplies `src/templates/posts-index.html` or `src/templates/tags.html`. `posts-index.html` receives `title`, `path`, `items` (a rendered link list), and `posts` (front matter plus `slug`, `path`, and `tags`) for `{#each}`; `tags.html` receives `tag` in place of `title`. Tag links in a post render as plain anchors through `{{tagsHtml}}`. The `/tags/` index has no template override.

Sitemap `lastmod` comes from front matter `dateModified`, else `date`; the build never reads file modification time.

## Custom collections

`bun run new collection` scaffolds a custom record type. Collection definitions declare source path, template, route pattern, label, and required fields. Templates use HTML, renderer directives, components, placeholders, conditionals, and build-time loops. A content template may not carry a `<style>` block; put content styles in a component `<style>` or `src/styles.css`. See [`framework/docs/decisions/custom-content-collections.md`](../decisions/custom-content-collections.md) for the full model.

## Markdown

Markdown renders at build time through `framework/build/markdown.ts`. Unsafe HTML, unsafe URL protocols, malformed front matter, and unsupported media references fail with source context. The route Markdown mirrors that discovery emits keep links inside list items and table cells.

## Ownership

All route owners share one slug registry. Duplicate authored, content, or generated URLs fail loudly. Media references are normalized through configured public image roots and unsafe paths are rejected.
