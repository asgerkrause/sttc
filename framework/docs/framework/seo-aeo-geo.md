# SEO, AEO, and GEO

Every route receives deterministic metadata from `src/site.json`, its filename, and optional route overrides:

```html
<head>
  <SEO
    title="About"
    description="What this organization does."
    image="/assets/images/about.webp" />
</head>
```

The renderer handles `<SEO />` itself; it is accepted only in the route's leading `<head>` wrapper. `title`, `description`, and optional `image` are the normal page-specific inputs. Canonical URLs derive from route filenames. `ogImage` remains a compatibility alias for `image`.

Use `<SEO ... unlisted />` only for a directly reachable route that should be omitted from public discovery. It receives `noindex,nofollow`. Unlisted is not authentication or access control.

Declare canonical organization, brand, and product facts once in `site.json`. Product structured data appears only on its configured `path`. The visible route should use the same `site.product.*` values so published facts do not drift:

```json
{
  "brand": { "slogan": "Ship with confidence" },
  "product": {
    "name": "Acme Platform",
    "description": "Release management for product teams.",
    "path": "/platform/",
    "image": "/assets/images/platform.webp"
  }
}
```

```html
<h1>{{site.product.name}}</h1>
<p>{{site.product.description}}</p>
```

## Google vs other engines

Google Search, AI Overviews, and AI Mode need unique HTML, crawlable pages, titles, one H1, and images. Schema helps classic rich results. It is not required for Google generative features.

Google Search Central (2026-07-10) says it ignores `llms.txt` for Search, including AI Overviews. `llms.txt` does not help Google.

ChatGPT, Perplexity, Claude, and coding agents can use JSON-LD, markdown mirrors, `llms.txt`, and entity facts such as `sameAs`, authors, and `site.topics`.

## Search is not a default

Do not add `SearchAction` or a `?q=` search URL to every page. Google removed the sitelinks search box on 2024-11-21. A search action that points at a missing `/search/` route is a false fact.

On-site search is optional later, when the project has a real `/search/` route. Declared facts must be visible and accurate.

## Discovery files the build emits

The build writes these for public routes. A 404 route is also written to `dist/404.html` so static hosts serve it with status 404 on a hard load.

- canonical `link` tags
- Open Graph tags
- Twitter tags, including `twitter:site` when `site.twitter` is set
- a connected JSON-LD graph in the page
- `sitemap.xml`
- `robots.txt`
- `feed.xml` and `feed.json`
- `llms.txt` and `llms-full.txt`
- `site.jsonld`
- `site.manifest.json`
- route Markdown and JSON under `/routes/`, such as `/routes/about.md` and `/routes/about.json`
- same-path markdown aliases, such as `/about/index.md` next to `/about/`

`rel="alternate" type="text/markdown"` points at the same-path markdown. `rel="describedby"` points at the route JSON and at `/llms.txt`.

`feed.xml` and `feed.json` exist only when the site has at least one public post. Sitemap `lastmod` comes from content front matter (`dateModified`, else `date`), never from file modification time, so authored pages carry no `lastmod`.

Build checks compare composed HTML paths and route markers with canonical URLs, manifest membership, sitemap membership, and route JSON identity. Built `noindex` pages and 404 stay outside public inventories; links to unlisted pages remain valid. Metadata titles and descriptions compare decoded text with whitespace normalized. Shared content dates compare timestamps; absent optional article metadata is allowed.

HTML and JSON representation links must target their own route, even when a wrong target exists. Same-path Markdown must exactly match its `/routes/` copy. HTML and Markdown body text are intentionally not required to match. These checks also run with `check --skip-build` and are not disabled by `--allow-broken-links`. They verify local output consistency, not deployed headers, crawling, indexing, or citations.

## llms.txt

`llms.txt` is a short agent index, not a second sitemap. `llms-full.txt` stays exhaustive.

Optional `site.discovery.featured` is a slug list. Optional `site.discovery.notes` are paragraphs. Do not put `##` headings in notes.

```json
{
  "discovery": {
    "featured": ["index", "about", "platform"],
    "notes": "Acme Platform is release management for product teams. Start with src/pages and src/site.json."
  }
}
```

When `featured` is set, those slugs are the primary list. Other public routes go under `## Optional`. When `featured` is absent, every public route is listed. That is the current default.

Links in `llms.txt` point at the same-path markdown.

## Authors

Optional `site.author` or `site.authors` emit Schema.org `Person` nodes.

```json
{
  "authors": [
    {
      "name": "Jordan Lee",
      "url": "/about/",
      "sameAs": ["https://www.linkedin.com/in/jordan-lee"]
    }
  ]
}
```

Post front matter `author` maps onto those people when the name matches. The renderer does not invent an author if the name is missing or unmatched. Launch checks warn when a public post has no author.

Posts add `BlogPosting` schema. Components may add explicit structured data with `@schema Type field=attr`. Declared facts must be visible and accurate. Human content review remains required.

## Breadcrumbs

The renderer emits a `BreadcrumbList` from the URL slug. The homepage has no breadcrumbs. Other routes start with the site name, then each path segment, then the page title. Intermediate labels use another route's title when that slug exists. Otherwise the renderer title-cases the path segment. It does not invent labels.

## FAQ content

Only add FAQs where questions genuinely help: a dedicated FAQ page, pricing, product, or support. Do not add filler FAQs to every landing page.

FAQ pages should use native HTML with Schema.org microdata. The starter does not ship a FAQ component. Component names never imply structured data. Visible answers are the source of truth:

```html
<section id="faq" itemscope itemtype="https://schema.org/FAQPage">
  <details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
    <summary itemprop="name">Can I cancel?</summary>
    <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
      <p itemprop="text">Yes, at any time.</p>
    </div>
  </details>
</section>
```

For short fixed lists, author literal HTML. For repeated data, use inline build-time JSON or `src/data/faq/*.json` with `{#each}`. The renderer detects explicit Schema.org `itemtype` values. Component names never imply structured data.

FAQ markup improves semantic clarity but does not guarantee rich results, rankings, citations, or inclusion in an answer engine.

## Crawler policy

The default `robots.txt` is `User-agent: *` and `Allow: /`. That already allows GPTBot and other answer bots. You do not need extra groups for ordinary crawl access.

To allow answer bots and block training crawlers, name the agents:

```json
"robots": {
  "groups": [
    { "userAgents": ["OAI-SearchBot", "ChatGPT-User", "Claude-User", "PerplexityBot"], "allow": ["/"] },
    { "userAgents": ["GPTBot", "ClaudeBot"], "disallow": ["/"] }
  ]
}
```

Robots rules are advisory, not privacy. Choosing to block training is a project decision. The renderer does not default to blocking.

`llms.txt` is a discovery file, not crawler consent.

## Heading ids

The build assigns a stable `id` to each heading that does not already have one, so citations can use fragments such as `/about/#team`.
