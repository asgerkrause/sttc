# Markdown rendering

**Status:** active  
**Date:** 2026-06-03

## Context

Content should be easy for editors and useful for marketing sites without adding a runtime framework. Markdown powers CMS posts/pages and inline authoring through `<Markdown>`.

## Chosen

Use a build-time, dependency-free renderer in `build/markdown.ts`.

Supported authoring surface:

- headings with stable `id` anchors
- paragraphs
- ordered and unordered lists
- blockquotes
- horizontal rules
- fenced code blocks with language classes
- tables
- links and images
- inline code, strong, emphasis
- controlled inline HTML
- PascalCase component tags passed through for the normal component composer

Safety rules:

- reject unsafe tags such as `<script>`, `<style>`, `<iframe>`, form controls, and embeds
- reject unsafe URL protocols such as `javascript:` and unsafe `data:` URLs
- escape ordinary HTML by default

## Why

- Build-time rendering keeps output static and fast.
- A focused renderer avoids dependency weight and keeps errors under our control.
- PascalCase component passthrough lets content opt into the design system without raw HTML.

## Consequences

- This is not full CommonMark. It is the framework authoring subset.
- New markdown features should land in `build/markdown.ts` with positive and negative checks.
- Raw interactive HTML belongs in components, not markdown.

## 2026-06-18 Bun.markdown evaluation

Recommendation: keep the custom renderer as the production path. Revisit a hybrid only if Bun's markdown API stabilizes and a wrapper can preserve the same safety and component contracts.

Evidence:

- Bun docs mark `Bun.markdown` as **unstable** and describe it as active-development API.
- `Bun.markdown.html()` supports useful GFM coverage: tables, strikethrough, task lists, heading IDs, autolinks, and parser options.
- Default `Bun.markdown.html()` does not meet current safety requirements: it renders `javascript:` links, unsafe `data:` images, `<script>`, and `<style>` without throwing.
- `tagFilter: true` escapes some disallowed HTML tags, but still leaves unsafe URL protocols intact and does not produce framework `BuildError` messages.
- `noHtmlBlocks`/`noHtmlSpans` can escape HTML, but also escapes PascalCase components, which breaks the authoring contract.
- PascalCase passthrough is inconsistent: self-closing block components survive, but paired components such as `<Card>Body</Card>` are wrapped in `<p>...</p>` unless a custom render layer compensates.
- `Bun.markdown.render()` callbacks can enforce links/images and reshape output, but callbacks do not provide source offsets. Matching current file/line/hint errors would require pre-scans or additional parser logic.
- Front-matter remains outside markdown rendering. Feeding front-matter directly to `Bun.markdown.html()` renders it as Markdown (`<hr>` plus heading), so existing `parseFrontMatter` still needs to stay.

Conclusion: `Bun.markdown` can complement later as a parser/tokenizer experiment behind tests, but replacing `build/markdown.ts` now would regress safety, error quality, or component passthrough.
