# Pages and routing

Files under `src/pages/` map by path:

```text
index.html       /
about.html       /about/
blog/index.html  /blog/
work/case.html   /work/case/
404.html         /404/
```

A route is body markup with an optional leading head wrapper:

```html
<head>
  <SEO title="About" description="What this organization does." />
</head>

<Section id="intro">
  <h1>About</h1>
  <p>Content.</p>
</Section>
```

`SEO` is a renderer directive. The build supplies default title, description, path, canonical, social metadata, and JSON-LD from the route slug and `site.json`.

Public discovery is the default. Declare the exception with a boolean flag:

```html
<head>
  <SEO title="Client preview" description="Shared by direct URL." unlisted />
</head>
```

An unlisted route is still built, directly reachable, link-checked, and represented in its direct route metadata. It emits `noindex,nofollow` and is omitted from sitemap, feeds, generated indexes, `llms*`, and the public site manifest. **Unlisted is not protected**: anyone with the URL can access it.

A top route `<script>` is bundled and guarded with `snz.onPage(slug, ...)`. An authored route `<style>` becomes a hashed route asset. Build-time route JSON data may drive `{#each}` loops.

Use ordinary internal anchors. Build fails broken internal links unless explicitly bypassed for development. Authored, content, and generated routes share one ownership registry; collisions fail loudly.
