# Content (PagesCMS)

Editors add files here via [Pages CMS](https://pagescms.org/). Paths match `.pages.yml`.

## Collections

| Folder | CMS label | Live URL |
| ------ | --------- | -------- |
| `content/posts/` | Insights | `/insights/{slug}/` |

Markdown renders to static HTML at build time. Supported: headings with anchors, lists, tables, blockquotes, code fences, safe links/images, and PascalCase components. Unsafe HTML and unsafe URL protocols fail the build. Authored pages live in `src/pages/`, not PagesCMS.

Optional custom collections can be declared in `content/collections.json` when a site needs extra record types, for example `content/projects/*.md` → `/work/{slug}/` through `src/templates/project.html`. Built-in `posts` stay implicit; `pages` remains reserved to avoid generic CMS page-builder drift. Custom collections do not create indexes, feeds, or tag pages by default.

## Site settings

`src/site.json` is editable in PagesCMS under **Site settings**. Rebuild after changes.
