# Media source roots

**Status:** active  
**Date:** 2026-06-29

## Context

`src/images/` is intentionally specific because images have framework-owned behavior: optimization, responsive variants, lazy previews, OG handling, CMS media input, and existence checks. Renaming it to `src/assets/` would blur source ownership with the public `/assets/*` output contract.

Sites also need videos, PDFs, audio, and downloads. These need predictable authoring paths without forcing every media type through the image pipeline.

## Chosen

Use specific public source roots:

```txt
src/images/  -> dist/assets/images/  # optimized images
src/videos/  -> dist/assets/videos/  # raw passthrough now, future video pipeline
src/files/   -> dist/assets/files/   # raw PDFs, audio, zips, downloads
```

Anything in these roots is publishable. The build does not tree-shake to only referenced files.

Build validates authored references to `/assets/images/*`, `/assets/videos/*`, and `/assets/files/*` after output is written.

## Why

- Specific folders match pipeline ownership.
- `/assets/*` stays output-only.
- Videos can later gain compression/transcoding without changing author paths.
- Raw downloads stay out of image/video logic.
- "Folder means public" is simpler and safer than brittle usage scanning across HTML, CSS, JS, Markdown, CMS data, and dynamic references.

## Consequences

- Do not store private drafts in `src/images/`, `src/videos/`, or `src/files/`.
- First implementation is passthrough for videos/files only; no transcoder or `<Video>` component yet.
- Usage-only publishing can be considered later as opt-in with an explicit manifest/escape hatch, not default behavior.
