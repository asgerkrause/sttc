# Deploy and launch

Build output is static files in `dist/`. Never edit `dist/`; rebuild from source.

## Build contract

Use Bun:

```bash
bun install
bun run build
```

Deploy settings:

| Setting | Value |
| --- | --- |
| Build command | `bun run build` |
| Output directory | `dist` |
| Dev command | `bun run dev` |
| Install command | `bun install` |
| Runtime | Bun `>= 1.4.0` |

`bun run build` runs `check` at the end and fails on a renderer contract violation. `bun run doctor` typechecks and runs the same checks out of band.

## Package resolution

`@snz/sttc` is unpublished. A site created from this repository's checkout depends on `"@snz/sttc": "file:<path to the checkout>"`, so `bun install` links the renderer from disk and the site follows that checkout. A site created from a packed tarball (`bun pm pack`, then `STTC_CREATE_MODE=packaged`) depends on `^<version>` and installs nothing until the package is published; publishing requires explicit human approval and is not part of any build or verify script. Until then, deploy from a repository that carries the renderer checkout, or vendor the package into the site.

## Dev and preview

`bun run dev` builds on change, serves `dist/` on `http://127.0.0.1:3000`, and reloads the tab over server-sent events. A failed build swaps the tab to a build-error page that reloads back to the site when the next build passes. `bun run preview` serves `dist/` on `http://127.0.0.1:4173` with no HMR, gzip, or cache; it is the Lighthouse target. Both servers bind `127.0.0.1` unless `HOST` is set, refuse paths that resolve above `dist/` (`/..%2Fpackage.json` is 404), and serve the site's 404 page with status 404 for unknown paths. `PORT` overrides the port.

## Vercel

Project includes Vercel config:

```json
{
  "framework": null,
  "installCommand": "bun install",
  "buildCommand": "bun run build",
  "devCommand": "bun run dev",
  "outputDirectory": "dist",
  "bunVersion": "1.x",
  "cleanUrls": true,
  "trailingSlash": true
}
```

Header defaults:

- `/assets/*` gets `public, max-age=0, must-revalidate`;
- hashed assets under `/assets/css/` and `/assets/js/` (`*.[hash].css|js|woff|woff2`) get `public, max-age=31536000, immutable`; the hashed rule sits after the general rule because Vercel applies later matching rules over earlier ones for the same header key;
- discovery files such as `llms.txt`, `robots.txt`, and `sitemap.xml` get `public, max-age=3600`.

Immutable applies only to hashed paths, so a replaced image or video is picked up on the next revalidation. `bun run check` warns when an immutable rule matches unhashed media.

Static sites remain static by default. No Vercel Functions or Middleware are enabled by framework defaults. A hard load of `/does-not-exist/` serves `dist/404.html` with status 404.

## Analytics

The runtime injects no analytics script. `snz.track()` dispatches `snz:track`; subscribe in `src/app.ts` and forward to the provider the project chose. See [Runtime](./runtime.md#snztrack-and-analytics) for the PostHog and Vercel recipes.

## Environment variables

Only `PUBLIC_*` variables are inlined into browser code.

Do not expose secrets through `PUBLIC_*`. Keep private provider keys in hosting integration settings or server-side systems outside the static site.

## Launch checks

`bun run build`, `bun run check`, and `bun run doctor` are the normal verification. `bun run doctor -- --launch` is the production gate.

Launch mode fails on:

- `site.url` that is not a public HTTPS origin, or that names `localhost`, a private address, or `example.com`;
- a missing `image`, a missing or unreadable `src/images/og.png`, or an OG master smaller than 600×315 (the starter ships a 1×1 placeholder);
- `site.name`, `site.description`, or the home page `<SEO title>` still equal to the starter's values;
- a duplicate page title, a missing route H1, a missing image `alt`, a link with no accessible name, a private or local URL in output, or a draft leaking into production.

Launch mode warns on:

- more than two render-blocking head stylesheets, a head `<script src>` without `type="module"`, `defer`, or `async`, and `@import` left in emitted CSS. These are project choices, so they never fail a build;
- a duplicate meta description, vague link text, and a public post without an author.

Every `check` warns when `vercel.json` drifts from the values above.

TTF or OTF fonts under `src/styles/` fail every build; commit WOFF or WOFF2 and point `@font-face` at those files.

Measure Lighthouse against `bun run preview` or the deployed origin, not `bun run dev`. A passing command is evidence, not visual or editorial approval. Review content accuracy, keyboard flow, assistive technology, responsive presentation, consent, external services, and deployment ownership separately. Fix source files, not generated output.

## Static handoff

If handing off files instead of deploying from git, provide:

- source repo
- Bun version requirement
- build command: `bun run build`
- output directory: `dist`
- required `PUBLIC_*` env vars, if any
- hosting notes for forms, analytics, and third-party scripts

## S3/R2-compatible hosting

Dedicated S3 deploy adapter is deferred. Current path: build locally or in CI, then upload `dist/` with hosting-specific tooling.

Cache policy should match framework intent:

- long immutable cache for hashed assets only
- short cache or normal revalidation for HTML, media, and discovery files

Never print or commit deploy credentials.
