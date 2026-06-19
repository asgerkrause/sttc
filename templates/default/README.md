# SANITIZE Boilerplate site

Client site starter powered by `@snz/bp`.

Created with:

```bash
create-snz-bp my-client
# or inside empty directory
create-snz-bp .
```

Ships with:

- `src/pages/index.html` → `/`
- `src/pages/components.html` → `/components/`
- flat `src/styles.css`, `src/app.ts`, `src/site.json`
- TypeScript-first site code: use `src/app.ts`; `src/app.js` works only as an escape hatch and must not exist beside `src/app.ts`
- no CMS files by default (`bun run new cms` opts in)
- no demo marketing routes (add your own with `bun run new route about`)

## Commands

```bash
bun install
bun run dev
bun run build
bun run check
bun run new cms    # optional: add PagesCMS/content scaffolding
bun run add theme minimal      # neutral, clean default
bun run add theme editorial    # type-forward, content-heavy
bun run add theme brutalist    # bold/high-contrast
```

Edit `src/`. Do not edit `dist/`.

Open `site.code-workspace` in Cursor/VS Code for authoring mode; it hides generated output and package internals.
