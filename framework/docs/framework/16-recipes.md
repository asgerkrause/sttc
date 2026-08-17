# Recipes

## Route

```bash
bun run new route about
```

## Component

```bash
bun run new component Hero
```

Use schema attrs and slots. Optional script and style blocks remain in the same file.

## Global project CSS

Edit or replace `src/styles.css`; no shell edit is needed. Delete it when the project wants zero global CSS.

## Image

```html
<Image src="hero" alt="Product interface" max="1600" />
```

## Video

```html
<Video src="/assets/videos/demo.mp4" title="Product demonstration" controls />
```

## CMS

```bash
bun run new cms
bun run new post hello-world
```

## Collection

```bash
bun run new collection projects --route work/{slug} --template project
```

## Route behavior

Put a script at the top of the route; the build wraps it in a route lifecycle hook.

## Component behavior

Use an optional component script with `el`, cleanup, and activity guards.

## Verify

```bash
bun run build
bun run check
bun run doctor -- --launch
```
