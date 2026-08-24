# Framework docs

Practical reference for `@snz/sttc`, an HTML-first static renderer that runs on Bun.

## Start here

1. [Overview](./00-overview.md)
2. [Quickstart](./01-quickstart.md)
3. [Project structure](./02-project-structure.md)
4. [Pages and routing](./03-pages-and-routing.md)
5. [Shell](./04-shell.md)
6. [Components](./05-components.md)
7. [Images](./07-images.md)
8. [Content and CMS](./08-content-and-cms.md)
9. [SEO, AEO, GEO](./09-seo-aeo-geo.md)
10. [Client router](./10-client-router.md)
11. [Scripts and interactivity](./11-scripts-and-interactivity.md)
12. [Forms and embeds](./12-forms-and-embeds.md)
13. [Deployment](./13-deployment.md)
14. [Launch checks](./14-launch-checks.md)
15. [Agent workflow](./15-agent-workflow.md)
16. [Recipes](./16-recipes.md)
17. [Troubleshooting](./17-troubleshooting.md)
18. [Framework philosophy](./18-framework-philosophy.md)

The renderer owns deterministic compilation, routing, media processing, metadata, discovery, and validation. Projects own presentation. Created projects receive an editable CRFT stylesheet copy as project source; STTC adds no runtime CSS.

```bash
bun run dev
bun run preview
bun run build
bun run check
bun run doctor -- --launch
```

Builds write the project component catalog to `.snz/components-catalog.md`.
