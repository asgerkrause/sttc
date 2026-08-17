# PascalCase components and renderer-owned SEO

**Status:** active

## Decision

Authored reusable markup lives in `src/components/PascalName.html` and is invoked with PascalCase tags. Schemas live in the leading component comment rather than sidecars.

Route metadata uses a reserved `<SEO />` build directive inside an optional leading `<head>` wrapper. SEO rendering is implemented by the renderer and does not require `src/components/SEO.html`.

## Why

Components stay source-owned and replaceable while metadata, canonical URLs, social cards, JSON-LD, and discovery remain consistent across authored, content, and generated routes.

Legacy `<component>` and SEO comment directives fail with migration hints.
