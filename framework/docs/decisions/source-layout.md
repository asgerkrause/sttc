# Source layout

**Status:** superseded

Superseded by starter-surface.md.

## Decision

Project source is organized by author intent:

```text
src/pages/        authored routes
src/components/   atomic components
src/images/       image masters
src/videos/       public video files
src/files/        public raw files
src/app.ts        project TypeScript
src/styles.css    project CSS entry
src/styles/       pinned CRFT copy
src/templates/    optional content templates
content/          optional markdown records
```

Renderer runtime remains package-owned under `framework/runtime/`. Build output remains under `dist/`.

This is the only layout the renderer reads. Optional directories are absent until used.
