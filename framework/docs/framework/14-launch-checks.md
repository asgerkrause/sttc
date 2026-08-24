# Launch checks

Normal verification:

```bash
bun run build
bun run check
bun run doctor
```

Production gate:

```bash
bun run doctor -- --launch
```

Launch mode checks:

- public HTTPS `site.url`;
- real OG image configuration and output;
- one useful title and description per route;
- route H1 presence;
- image alt attributes;
- meaningful links and accessible names;
- private or local URLs;
- internal routes and public assets;
- discovery artifacts and JSON-LD;
- Vercel configuration intent when present;
- production emit: flattened CSS, hashed router, no HMR, no TTF or OTF source fonts.

Measure Lighthouse against `bun run preview` or production. A passing command is evidence, not visual or editorial approval. Review content accuracy, keyboard flow, assistive technology, responsive presentation, consent, external services, and deployment ownership separately.

Fix source only. Placeholder starter configuration should fail the production gate until the project supplies real values.
