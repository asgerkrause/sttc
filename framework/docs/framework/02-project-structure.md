# Project structure

| Path | Owner |
|---|---|
| `src/shell.html` | Persistent document shell. |
| `src/pages/**/*.html` | Authored routes. |
| `src/components/*.html` | Atomic build-time components. |
| `src/site.json` | Site and discovery defaults. |
| `src/app.ts` | Project TypeScript. |
| `src/images/` | Image masters. |
| `src/videos/` | Public video files. |
| `src/files/` | Public downloads and raw files. |
| `src/styles.css` | Minimal replaceable font and root-scale stylesheet. |
| `src/templates/` | Optional content templates. |
| `content/` | Optional markdown records. |
| `.snz/` | Generated cache/state only. |
| `dist/` | Generated output only. |

The starter ships two routes, seven replaceable components, and an editable CRFT stylesheet copy. CMS, data, video, and file surfaces appear only when used.

`src/pages` is canonical. Legacy `src/routes` remains migration input. `src/app.ts` and `src/app.js` may not coexist.

Build emits public route directories, router fragments, hashed assets when present, image output, feeds, sitemap, manifests, route JSON, llms files, and AI discovery metadata.
