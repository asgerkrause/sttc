# Changelog

## 0.2.0

First public release candidate. Publishing is pending the license confirmation and a human `npm publish`.

### Changed

- Craft v3 CSS is the dogfood and starter system (`src/styles/`, `.c`, `.s`, `.g`, type roles). Consumer action required: existing projects keep their owned CSS; STTC does not upgrade them or ship compatibility aliases. Migrate class names by hand or keep your own CSS.
- Renderer output is stricter. Unresolved placeholders, malformed `@attr`, unknown `@tag`, and single-quoted attributes now fail the build with file and page names. Consumer action required: fix any such source.
- Navigation is MPA with a page runtime (`window.snz`). The client router is gone. Consumer action required: remove calls to removed router APIs.
- Dev and preview servers are hardened: they serve `dist/` only and return 404 for paths outside it.
- Packaged `sttc create` writes `"@snz/sttc": "^0.2.0"`.

### Removed

- Legacy layouts and route fragments. Consumer action required: move any use to authored routes and components.
- Repo-only scraped docs (`.firecrawl/`).

### Added

- Route and content ownership, discovery output (sitemap, feeds, `llms.txt`), and the launch gate (`sttc check --launch`).
- Optional self-hosted Lenis scrolling via `"scroll": "lenis"`.
- MIT license and public npm `publishConfig`.

### Requirements

- Bun >= 1.4.0.
