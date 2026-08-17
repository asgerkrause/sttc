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

`SEO` is a renderer directive, not a component file. `title`, `description`, and optional `image` are the normal page-specific inputs. Canonical URLs derive from route filenames. `ogImage` remains a compatibility alias for `image`.

The build emits canonical, Open Graph, Twitter, connected JSON-LD, sitemap, robots, feeds, `llms.txt`, `llms-full.txt`, `site.jsonld`, a public site manifest, and HTML/Markdown/JSON representations for public routes.

Declare canonical organization, brand, and product facts once in `site.json`. Product structured data appears only on its configured `path`; the visible route should use the same `site.product.*` values so published facts do not drift:

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

Use `<SEO ... unlisted />` only for a directly reachable route that should be omitted from public discovery. It receives `noindex,nofollow`. Unlisted is not authentication or access control.

## FAQ content

Only add FAQs where questions genuinely help: a dedicated FAQ page, pricing, product, or support. Do not add filler FAQs to every landing page.

The starter `FAQ` is an intentionally plain native-HTML recipe. Its visible `<details>` content carries Schema.org microdata, so the human and machine-readable answers have one source of truth:

```html
<section itemscope itemtype="https://schema.org/FAQPage">
  <details itemprop="mainEntity" itemscope itemtype="https://schema.org/Question">
    <summary itemprop="name">Can I cancel?</summary>
    <div itemprop="acceptedAnswer" itemscope itemtype="https://schema.org/Answer">
      <p itemprop="text">Yes, at any time.</p>
    </div>
  </details>
</section>
```

For short fixed lists, author literal HTML. For repeated data, use inline build-time JSON or `src/data/faq/*.json` with `{#each}`. The renderer detects explicit Schema.org `itemtype` values; component names never imply structured data.

FAQ markup improves semantic clarity but does not guarantee rich results, rankings, citations, or inclusion in an answer engine.

## Crawler policy

`site.json` may define standard robots groups:

```json
{
  "robots": {
    "groups": [
      {
        "userAgents": ["*"],
        "allow": ["/"]
      }
    ]
  }
}
```

Robots rules are advisory crawl instructions, not privacy or authorization. `llms.txt` is an emerging discovery convention, not crawler consent.

Content posts add `BlogPosting` schema. Components may add explicit structured data with `@schema Type field=attr`, but declared facts must be visible and accurate. Human content review remains required.
