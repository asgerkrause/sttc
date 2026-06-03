# Content (PagesCMS)

Editors add files here via [Pages CMS](https://pagescms.org/). Paths match `.pages.yml`.

## Collections

| Folder | CMS label | Live URL |
| ------ | --------- | -------- |
| `content/posts/` | Insights | `/insights/{slug}/` |
| `content/pages/` | Extra pages | `/{slug}/` |

Markdown renders to static HTML at build time. Supported: headings with anchors, lists, tables, blockquotes, code fences, safe links/images, and PascalCase components. Unsafe HTML and unsafe URL protocols fail the build.

## Site settings

`src/site.json` is editable in PagesCMS under **Site settings**. Rebuild after changes.
