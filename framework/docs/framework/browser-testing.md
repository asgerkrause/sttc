# Browser behavior gate

Run from the repository root:

```sh
bun install --frozen-lockfile
bun run browser:install
bun run test:browser
bun run test:browser --seeds
```

Linux CI adds `--with-deps` to `browser:install` to install Chromium system libraries. The installer runs as `bun node_modules/playwright-core/cli.js`, never through a Node shebang or `bunx`. Preview inherits the running Bun executable. The gate asserts `process.versions.bun` and prints its executable/version. `playwright-core` is pinned to `1.61.1`, development-only, with no transitive package dependencies; no starter or runtime dependency changes. Its matching headless Chromium binary lives in Playwright's cache. `PLAYWRIGHT_SKIP_BROWSER_GC=1` preserves unrelated cached browser versions.

Compatibility evidence: on macOS arm64, both Bun **1.4.0** (CI's pinned version) and **1.4.4** ran the full suite and seeded checks using Chromium **149.0.7827.55**. A separate Bun 1.4.0 spike first served a local page, launched Chromium, and awaited a heading assertion. The installer also completed under Bun 1.4.0. This is empirical compatibility, not a claim of official Bun support. Playwright documents version-matched binaries in its [browser installation guide](https://playwright.dev/docs/browsers). Linux execution remains a CI check.

The gate builds one synthetic project with home, docs, and a 404 page in a system temporary directory. It uses the real build API, runtime, starter Lenis bootstrap/vendor/CSS, and existing preview server. Preview binds loopback on an ephemeral port; the runner reads the announced port and awaits a successful HTTP response. Browser contexts permit only that origin. Each case has a fresh context, a fixed viewport, condition-based waits, and error/console capture. One Chromium worker runs sequentially with no retries. Contexts, browser, preview process, and fixture are cleaned up on success or failure.

Checks cover:

- Header and main lifecycle mounts exactly once, one page event, click tracking and direct `snz.track()` payloads.
- Keyboard disclosure opening, Escape closing and focus return, same-page anchor closing and scrolling.
- Direct `/docs/` loading its script and CSS, full-document native link navigation, and the site's missing-page content with HTTP 404.
- Content and links with JavaScript disabled.
- Reduced-motion native scrolling with JavaScript enabled; the normal-motion control must activate real Lenis.

`--seeds` temporarily damages only generated fixture assets, requires the corresponding behavioral assertion to fail, and restores each file in `finally`. Seeds cover duplicate mounts, a caught lifecycle exception, duplicate page events, disabled Escape, removed Escape focus, bypassed reduced-motion guard, and a directory-relative broken script URL. Seed matching requires exactly one target; changed bundler output fails visibly instead of silently skipping a seed.

Browser modules deliberately lack `.test`/`.spec` names and have no top-level browser side effects. Ordinary `bun test framework/tests` and existing `framework:verify` keep their checks without requiring browser installation. CI runs the additional dedicated gate with seeds. For release/integration acceptance, run **both** `bun run framework:verify` and `bun run test:browser --seeds`, plus the separate typecheck.

Local disk cost measured approximately 12 MB for `playwright-core` and 203 MB for the selected Chromium headless shell, excluding shared browser cache support files. Downloads and Linux system library sizes vary. This gate does not certify accessibility, Safari/Firefox, mobile hardware, deployment headers, or every browser lifecycle.
