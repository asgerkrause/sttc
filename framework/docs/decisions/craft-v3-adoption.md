# Craft v3 adoption

**Status:** accepted  
**Date:** 2026-10-25

Supersedes the CSS packaging, hooks, token names, and font paths in [Starter component scaffold](./starter-surface.md). Its seven-component scaffold and creator boundary remain current.

## Decision and scope

The dogfood site and `templates/default/` explicitly adopt the full Craft v3 system. This migration updates their project-owned CSS, markup, and authoring guidance together. Future created sites receive the migrated starter. Existing consumer projects keep their owned source; STTC does not upgrade them automatically.

Craft remains optional presentation source. The renderer stays CSS-agnostic and gains no Craft dependency, hook translation, or compatibility aliases. A project can replace or delete the copied CSS. The starter still contains exactly `Header`, `Footer`, `Section`, `Logo`, `Image`, `Video`, and `Grid`.

## Source provenance

The previous copy used pin `7358c7e`. The canonical v3 source for this migration is `skills/craft` in the AK repository, exposed as the installed `/craft` skill. Its `SKILL.md`, `CRAFT.md`, routed owner documents, and live CSS define the adopted contract.

The skill derives from upstream baseline `04e13db`, which lacks the v3 marker, plus later skill-local semantic v3 changes. That upstream baseline alone does not identify the adopted v3 contract.

Both copied manifests record AK revision `1831f1b92b45e5d683e9b886cbe157c4188cb2d4` with `dirty: true`. The revision and dirty flag do not reconstruct the exact source snapshot. File hashes identify the copied payload, but reproducing the source also requires its local changes. This is recorded provenance with a limitation, not an immutable source pin. Compare actual source files and project-owned customizations before updating either copy.

## Physical package and ownership

Craft is the system name. The physical package retains `crft.css` and `crft-manifest.json` names:

| Project file | Responsibility |
| --- | --- |
| `src/styles.css` | Project CSS entry that imports `src/styles/global.css` |
| `src/styles/global.css` | Project-owned cascade prelude, imports, and project rules |
| `src/styles/tokens.css` | Brand foundations, semantic tokens, recipes, colors, and motion preferences |
| `src/styles/crft.css` | Reset, native defaults, type, layout, grid, motion, and utilities |
| `src/styles/crft-manifest.json` | Adoption provenance, hashes, and contract snapshot |

The manifest uses semantic `contractVersion: 3` and physical `packagingVersion: 1`. `global.css` imports flat `tokens.css` and `crft.css`. Legacy `layers/` files are removed rather than mixed with the flat package. The eight logical layers remain `reset`, `base`, `tokens`, `type`, `layout`, `grid`, `motion`, and `utility`. The build continues to flatten project imports and hash emitted assets.

## Authoring changes

- Containers use `.c`, `.c.sm`, and `.c.lg`. `Section` keeps its `c` input for `sm` and `lg`, emitting container classes inside `section`. The legacy centered-container modifier has no canonical v3 replacement and is removed from authoring guidance.
- `.s` owns vertical flow only. Header rows, wrapping, alignment, and other horizontal relationships belong in bounded component CSS.
- Type roles use `.display`, `.h1`, `.h2`, `.h3`, `.lead`, `.body`, `.small`, `.label`, and `.caption`. Native `h4`–`h6` retain their heading semantics and use `h3` styling. Weight uses `font-weight`; supported custom font axes remain available without a competing `wght` axis.
- Grids use `g` tracks, `c` column spans, `r` row spans, and `o` visual order. `Grid` preserves `cols`, `x`, `y`, and `order` inputs and emits those hooks respectively. Numbered grids remain inside `section > .c`; reading and keyboard order remain authored order.
- `data-theme` accepts `invert`, `tone`, or `accent`; it and `data-accent` change color only. Document CSS `color-scheme` selects light, dark, or OS preference. Theme selectors do not rebind type, spacing, or radius.
- Every direct `main > section` has a meaningful, nonempty, unique ID, including the 404 page. Sections have no classes. Other IDs need a fragment, relationship, behavior, integration, or stable identity purpose.

Component demos retain a native section wrapper, add a distinct section ID, and avoid duplicate appends. New-route scaffolds and generated index fallbacks retain their existing `<Section>` call without new attributes: a project-owned replacement may not declare `id`. Their section identity remains project-owned rather than introducing a renderer-level component contract in this CSS migration. When authoring a Craft route, supply an ID supported by its component contract and distinct from the generated heading IDs.

Public tokens now describe semantic jobs, including `--canvas`, `--text`, `--border`, `--content-max`, `--bleed-x`, `--gap`, and `--h1-size`. Old abbreviated token names receive no aliases. Type, spacing, and radius foundations and derived recipes resolve at `:root` only. Local final-role sizes and metadata may override on semantic owners. Local spacing values do not recompute inherited scale members. The copied live CSS owns token values; this decision does not duplicate that catalog.

## Fonts and behavior

The dogfood retains its SNZ faces and project-specific brand choices. The starter ships no font assets and uses `system-ui` until its project adds approved faces. Projects own their `@font-face` rules and WOFF/WOFF2 files. The build continues to hash those files and rewrite their URLs.

Components keep semantic HTML, accessible controls, and useful static output. Motion remains optional and respects reduced motion and unsupported-feature fallbacks. Navigation stays native MPA, with project-owned cross-document transition CSS and shell speculation rules. This adoption adds no client router or renderer styling.

## Consequences and verification

Full adoption keeps markup, token names, and CSS behavior on one current contract. It requires explicit migration of project customizations and offers no compatibility layer for old hooks. Preserving component input meanings limits unnecessary authoring changes while allowing emitted markup to follow v3.

Documentation review checks active guidance for obsolete hooks, token names, and package paths. The coordinating implementation runs `bun run framework:verify` and evaluates rendered behavior. This decision records accepted scope and contracts; it does not claim test passes, visual fidelity, or completed accessibility checks.
