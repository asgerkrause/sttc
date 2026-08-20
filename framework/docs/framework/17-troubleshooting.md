# Troubleshooting

Run the exact failing command and read the complete file, line, and hint.

| Symptom | First check |
|---|---|
| Unknown component | PascalCase filename/tag and component existence. |
| Missing attr | Leading component schema and invocation. |
| Broken route | `src/pages` path and internal href. |
| Missing image | Unique master basename and media input. |
| Missing public file | Matching source under images, videos, or files. |
| Unresolved placeholder | Template data path and optional conditional. |
| Duplicate slug | Authored/content/generated route ownership. |
| Missing metadata | Route `SEO` directive and `site.json`. |
| Missing stylesheet | Restore or replace `src/styles.css`; the build flattens it to a hashed `/assets/css/styles.[hash].css`. |
| Lighthouse under 100 on localhost | Use `bun run preview` after `bun run build`. Do not score `bun run dev`. |
| Component style absent | Confirm non-empty `<style>` and generated link. |
| App entry conflict | Keep `src/app.ts` or `src/app.js`, not both. |

Never patch `dist/`. If valid minimal source contradicts the documented contract, reproduce it in a focused renderer test before changing framework internals.

After a narrow fix passes, broaden to `bun run build`, framework tests, or launch checks according to the affected contract.
