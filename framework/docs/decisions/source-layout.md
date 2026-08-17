# Source layout

**Status:** active

## Decision

Project source is organized by author intent:

```text
src/pages/        authored routes
src/components/   atomic components
src/images/       image masters
src/videos/       public video files
src/files/        public raw files
src/app.ts        project TypeScript
src/styles.css    minimal replaceable project CSS
```

Renderer runtime remains package-owned under `framework/runtime/`. Build output remains under `dist/`.

Legacy source paths may be migrated, but new projects receive only the minimal canonical surface. Optional directories are absent until used.
