# Content (PagesCMS)

Editors add files here via [Pages CMS](https://pagescms.org/). Paths match `.pages.yml`.

## Collections

| Folder | CMS label | Live URL (v2) |
| ------ | --------- | ------------- |
| `content/posts/` | Insights | `/insights/{slug}/` |
| `content/pages/` | Extra pages | `/{slug}/` |

**v1.2:** build does **not** compile `content/` yet — use `src/routes/` for live pages.

**v2:** `build/content.ts` + `src/templates/post.html` — see `future-desires/todo.md`.

## Site settings

`src/site.json` is editable in PagesCMS under **Site settings**. Rebuild after changes.
