# Consumer upgrade smoke

`bun run smoke:create` tests both newly created projects and one customized historical consumer. The consumer is copied from `framework/tests/fixtures/consumer-upgrade/`, never recreated from today's template. Upgrade changes the renderer dependency; it does not run `create` over an existing site or replace project-owned CSS.

## Historical contract and provenance

Baseline: **`4f7bb86053ad0cd96f4111940b36b30b6b7345bf`**, package **`@snz/sttc` `0.2.0`**, commit “Point package homepage at the repository (#39)”. No release tags were present in the inspected repository. This is a source-history baseline, not a claim that this version was published to npm. The candidate uses the later `@byak/sttc` name.

The baseline already supports the current HTML shell, component attributes/slots/colocated styles, `src/app.ts`, native scrolling, Markdown posts with `{{body}}`, and project-owned CSS. Its starter adopted Craft semantic contract 3 / packaging contract 1. The renderer's CSS-agnostic contract permits consumers to replace that copy. This fixture intentionally has no `src/styles/crft-manifest.json`, Craft stylesheet, or starter font/media files. Requiring those files would break this supported customization.

Historical inputs came from `git show <baseline>:templates/default/<path>`, not from the working template. These four files are archived byte-for-byte:

- `src/components/Section.html`
- `src/pages/404.html`
- `tsconfig.json`
- `vercel.json`

Deliberate synthetic modifications:

- `src/shell.html`: retain the historical document/script/speculation-rule structure; replace Header/Footer with journal navigation and footer; omit the optional Lenis script.
- `src/site.json`: synthetic `.example` identity, native scrolling, no OG image.
- `src/pages/index.html`: journal copy, custom component, content link. Add `src/pages/archive.html`.
- `src/components/Note.html`: custom attribute/slot component with colocated CSS.
- `src/styles.css`: replace the starter Craft imports/copy with a small consumer stylesheet and recognizable custom property/container width.
- `src/app.ts`: add a consumer browser marker.
- `src/templates/post.html` and `content/posts/first-observation.md`: add a custom post template and synthetic published record.
- `package.json`: reduce historical project metadata to fixture identity, dependencies, and pinned historical TypeScript/Bun types; normalize the renderer dependency to `@byak/sttc: 0.2.0` before the candidate install. No baseline registry install is needed.

The archive contains **14 files, 4,418 bytes**. No client data, credentials, images, or other binary assets are needed. On Bun 1.4.4, the customized fixture was independently built with the baseline commit's archived `framework/` and `package.json`: five routes, exit 0. This confirms the customization uses historical contracts rather than features invented by the candidate. Keep the fixture frozen; changing it requires an explicit compatibility decision and updated provenance.

## Upgrade and failure checks

The existing smoke packs the checkout once. The consumer test copies the archive to the smoke's system temporary directory, enumerates owned file paths and SHA-256 hashes, then installs that same tarball with `bun add`. It invokes the installed candidate's `build`, `check`, and `doctor` directly. It verifies custom component text, shell text, an authored route, rendered Markdown content, emitted consumer/component CSS, and the app marker.

All 13 non-package input files must retain both their paths and hashes after installation and commands. Generated `dist/`, `.snz/`, and `node_modules/`, plus dependency metadata `package.json` and Bun lockfiles, are excluded. Candidate installation intentionally updates dependency metadata and lock state. Stable repository toolchain installation should use `bun install --frozen-lockfile`; this smoke never installs in the repository root or rewrites its lockfile. Dependency resolution can still access the registry; offline operation is not promised.

Seven negative checks run inside the disposable copy:

1. Overwrite consumer CSS: require a changed-file hash failure.
2. Delete the archive route: require a path-set failure.
3. Temporarily alter the installed candidate to read absent `src/styles/crft-manifest.json`: require nonzero exit and the specific missing-file diagnostic.
4. Remove generated output and replace the temporary candidate with a successful no-op: require the independent output assertion to fail despite exit 0.
5. Remove the project stylesheet reference while retaining its file: require CSS validation to fail.
6. Remove the component stylesheet reference while retaining its file: require CSS validation to fail.
7. Remove the app script reference while retaining its file: require app validation to fail.

CSS and app markers are read only from assets referenced by the consumer home document. Unreferenced emitted files cannot satisfy the output check.

Inputs and candidate code are restored with `finally`; a final real build and preservation/output check must pass. The outer smoke removes its entire temporary directory on success or failure. Mutations never touch the checkout's renderer or fixture. Repository `bun run typecheck` checks the harness separately.

This proves one synthetic consumer upgrade across this historical source contract and package rename. It does not prove every historical version, arbitrary consumer dependencies, browser appearance, deployment headers, media conversion, an offline install, or compatibility with all future releases. There is no auto-migrator and no new compatibility promise beyond the exercised contracts.
