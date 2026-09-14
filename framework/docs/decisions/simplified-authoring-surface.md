# Simplified authoring surface

Superseded by starter-surface.md.

## Decision

The default author surface is:

```text
src/
  shell.html
  pages/
  components/
  images/
  app.ts
  site.json
```

Optional surfaces appear only when used: `src/videos/`, `src/files/`, `src/templates/`, `src/data/`, `content/`, and `.pages.yml`. The starter includes one replaceable `src/styles.css` for fonts and root scale.

## Rules

- `src/pages/**/*.html` owns authored routes.
- `src/components/PascalName.html` owns atomic components.
- `src/app.ts` is canonical project code; `src/app.js` is an escape hatch, never a sibling.
- `src/styles.css` is plain project CSS; the starter version is minimal and removable.
- `content/` and templates are opt-in.
- `.snz/` is generated cache/state only.
- `dist/` is generated output only.

This keeps first-run source small while preserving renderer capabilities when the project asks for them.
