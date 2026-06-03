# Copy-paste prompt to spawn a new component

Hand the block below to Claude (or any capable LLM). Replace `<DESCRIPTION>` with what you want.

---

You are authoring a new component for the **SANITIZE Boilerplate** (`@snz/bp`) framework. Read `docs/components.md` first — it is the authoritative contract. Do not deviate.

**Component to create:** `<DESCRIPTION>`

Produce exactly one file: `src/components/<PascalName>.html`. It must contain:

1. A leading `<!-- ... -->` schema comment with at minimum `@desc` and any `@attr` declarations.
2. The HTML template using `{{attr}}` for attributes and `{{slot}}` / `{{slot:name}}` for children.
3. An optional `<style>` block (colocated, uses design tokens from `src/styles/styles.css`).
4. An optional `<script>` block if the component needs runtime behavior. `el` is bound to the instance root; return a function for cleanup.

Rules:

- Use design tokens (`--mw`, `--bx`, `--by`, `--ffs`, `--fs`, the color system). Never hardcode spacing or colors.
- Semantic HTML first. ARIA only when no native equivalent exists.
- Visible focus via `:focus-visible`. Never `outline: none` without a replacement.
- Honor `prefers-reduced-motion` if you animate.
- For variants, use `@attr variant=[a|b|c] :class` and combo classes + nested CSS (no BEM).

Verify with `bun run build` — the build refuses violations with a `BuildError` pointing at the file.
