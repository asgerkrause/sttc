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
