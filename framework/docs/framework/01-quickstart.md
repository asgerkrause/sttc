# Quickstart

```bash
bun install
bun run dev
```

Edit `src/pages/index.html`, then run:

```bash
bun run build
bun run check
bun run preview
```

Measure Lighthouse against preview or production, not `bun run dev`.

## Add a route

```bash
bun run new route pricing
```

```html
<head>
  <SEO title="Pricing" description="Clear plans and terms." />
</head>

<Section>
  <h1>Pricing</h1>
</Section>
```

## Add a component

```bash
bun run new component Hero
```

One PascalCase file owns schema, markup, optional script, and optional style.

## Add presentation

The starter stylesheet only registers `SNZ Sans`, `SNZ Mono`, and a responsive root scale. Replace or delete it, or use optional component and route style blocks. Bring the project's own system.

## Add media

Place masters in `src/images/` and use `<Image src="hero" alt="..." />`. Put videos in `src/videos/` and downloads in `src/files/`.

## Add content

```bash
bun run new cms
```

## Before launch

```bash
bun run doctor -- --launch
```

Replace placeholder URL and metadata in `src/site.json`; never fabricate production values.
