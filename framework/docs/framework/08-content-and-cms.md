# Content and CMS

CMS is optional. Start with:

```bash
bun run new cms
bun run new post hello-world
```

This creates PagesCMS configuration, `content/posts/`, an image input, and `src/templates/post.html`. Authored pages remain in `src/pages/`.

Posts require title, date, and description. Drafts are excluded from production and included in development. Tags generate `/tags/` and `/tags/{tag}/`; posts generate `/insights/{slug}/`, RSS, and JSON Feed.

Custom records use:

```bash
bun run new collection projects --route work/{slug} --template project
```

Collection definitions declare source path, template, route pattern, label, and required fields. Templates use HTML, renderer directives, components, placeholders, conditionals, and build-time loops.

All route owners share one slug registry. Duplicate authored, content, or generated URLs fail loudly. Media references are normalized through configured public image roots and unsafe paths are rejected.
