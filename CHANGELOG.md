# Changelog

## 0.3.1

- Emit `<meta name="generator" content="STTC">` on every route, so technology detectors can identify STTC-built sites. Projects see the tag after they update the package and rebuild.
- Fix `sttc dev` missing edits made right after it printed its URL. The URL now prints only after watcher setup, so tools that wait for it no longer race it. A watcher that fails to start now logs an error instead of failing silently.

## 0.3.0

- Add versioned JSON results for `build --json` and `check --json`, including warnings, caught failures, and optional build timings.
- Strengthen consistency checks across generated discovery metadata and route representations. Inconsistent output accepted by earlier versions may now fail validation.
- Add Chromium behavior tests with seeded regressions and packed-package upgrade checks for a customized historical consumer.
- Add an agent-evaluation protocol and bounded link-repair grader. No comparative AI productivity claim is established.
- Test Bun 1.4.0 and 1.4.4 in CI. The minimum remains Bun 1.4.0.

Existing projects retain their owned source and CSS. The browser tooling is development-only and adds no consumer runtime dependency.

## 0.2.0

Initial supported public release on npm. A `0.0.0-stage` staging package was published earlier; it was not a supported consumer release.

- HTML-first static renderer: authored routes, build-time components with `@attr` contracts, markdown content collections, and compiler-assisted images.
- Discovery output: canonical and Open Graph tags, connected JSON-LD, sitemap, feeds, route Markdown and JSON, `llms.txt`, and `llms-full.txt`.
- `sttc create` starter with a project-owned Craft v3 CSS copy, seven example components, and optional self-hosted Lenis scrolling.
- `sttc check` renderer contracts and the `--launch` production gate.
- MIT license.

Requires Bun >= 1.4.0.
