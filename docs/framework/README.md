# Framework docs

Practical reference for `@snz/bp`, an HTML-first static site builder that runs on Bun.

SANITIZE Boilerplate turns ordinary source files into static sites with build-time components, optimized images, content routes, SEO/AEO discovery files, strict checks, and a lean client router. No runtime framework. No hydration model. No `dist/` edits.

## Start here

1. [Overview](./00-overview.md) — framework mental model.
2. [Quickstart](./01-quickstart.md) — run, edit, build, check.
3. [Project structure](./02-project-structure.md) — files and ownership.
4. [Pages and routing](./03-pages-and-routing.md) — route authoring.
5. [Components](./05-components.md) — build-time component contract.

## Full guide

| Doc | Use when |
| --- | --- |
| [Overview](./00-overview.md) | You need framework shape in 10 minutes. |
| [Quickstart](./01-quickstart.md) | You need first run/edit/build loop. |
| [Project structure](./02-project-structure.md) | You need to know what to edit. |
| [Pages and routing](./03-pages-and-routing.md) | You are adding or changing routes. |
| [Shell](./04-shell.md) | You are changing persistent layout. |
| [Components](./05-components.md) | You are authoring component files. |
| [CSS system](./06-css-system.md) | You are styling layouts or components. |
| [Images](./07-images.md) | You are adding optimized images. |
| [Content and CMS](./08-content-and-cms.md) | You are using markdown or PagesCMS. |
| [SEO, AEO, GEO](./09-seo-aeo-geo.md) | You are preparing discovery output. |
| [Client router](./10-client-router.md) | You need navigation/runtime API details. |
| [Scripts and interactivity](./11-scripts-and-interactivity.md) | You are adding browser behavior. |
| [Forms and embeds](./12-forms-and-embeds.md) | You need third-party forms/widgets. |
| [Deployment](./13-deployment.md) | You are shipping `dist/`. |
| [Launch checks](./14-launch-checks.md) | You are validating readiness. |
| [Agent workflow](./15-agent-workflow.md) | An AI agent is editing the site. |
| [Recipes](./16-recipes.md) | You want task-card examples. |
| [Troubleshooting](./17-troubleshooting.md) | Build/check/dev failed. |
| [Framework philosophy](./18-framework-philosophy.md) | You are deciding what belongs in framework. |
| [Glossary](./glossary.md) | You need shared terms. |

## Commands

```bash
bun run dev
bun run build
bun run check
bun run doctor
bun run doctor -- --launch
bun run new
```

Use Bun only. Edit source files. Build writes `dist/`; never edit it by hand.

## Existing technical references

- [`../agent-guide.md`](../agent-guide.md) — compact task guide.
- [`../components.md`](../components.md) — component authoring contract.
- [`../components-catalog.md`](../components-catalog.md) — generated built-in component catalog.
