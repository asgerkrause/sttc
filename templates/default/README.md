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
- flat `src/styles.css`, `src/app.js`, `src/site.json`
- no CMS files by default (CMS support is opt-in later)
- no demo marketing routes (add your own with `bun run new route about`)

## Commands

```bash
bun install
bun run dev
bun run build
bun run check
```

Edit `src/`. Do not edit `dist/`.
