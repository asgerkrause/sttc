# Markdown rendering

**Status:** active

## Decision

Markdown is a build-time content format for posts and custom collections. It supports headings, paragraphs, lists, links, images, code, tables, emphasis, blockquotes, safe controlled HTML, and PascalCase component passthrough.

Unsafe HTML, script/style tags, unsafe URL protocols, malformed front matter, and unsupported media references fail with source context.

Markdown does not add a runtime parser or page-builder abstraction. Authored marketing pages remain HTML in `src/pages/`; content records render through source-owned templates.

## Consequences

- Content is static, indexable, and available to feeds and discovery output.
- Components may appear in markdown when their output remains structurally valid.
- Complex paired components should be placed deliberately because markdown paragraph rules can affect surrounding markup.
- The renderer keeps one sanitization and error path for all content records.
