# Agent workflow

1. Read `AGENTS.md` and inspect repository truth.
2. Classify the owner: route, component, media, content, configuration, project code, or renderer.
3. Reuse the seven starter components when their contracts fit; otherwise create one source-owned component.
4. Preserve presentation ownership. The editable CRFT starter copy is project source, not framework CSS.
5. Keep attrs semantic, slots rich, scripts minimal, and active work guarded.
6. Preserve SEO/AEO/GEO, discovery, native accessibility, and strict errors.
7. Never edit `dist/` or `.snz/` source.
8. Run the narrowest proving command after the final change.

Useful gates:

| Change | Evidence |
|---|---|
| Route or component | `bun run build` |
| Content/config | `bun run check` |
| Renderer | `bun test framework/tests` plus focused build |
| Starter/template | `bun run smoke:create` |
| Launch-sensitive | `bun run doctor -- --launch` |

Ask only when the answer changes authority, cost, architecture, public contract, or an irreversible effect. Report changed files, checks, limitations, and remaining uncertainty.
