# Scripts and interactivity

Prefer native HTML. Add JavaScript only for behavior the platform cannot provide.

## Project code

`src/app.ts` is the canonical entry and may import local TypeScript or JavaScript. `src/app.js` is an escape hatch; both cannot coexist. Only `PUBLIC_*` environment values are inlined.

## Route scripts

A script at the top of an authored route is extracted and wrapped with `snz.onPage(slug, ...)`, so it runs when that route becomes active.

## Component scripts

An executable component `<script>` runs per instance with `el` bound to the component root. Return cleanup. The router mounts instances after initial load and navigation.

Active work must use `snz.onActive` or `snz.onVisible`. Autoplay media is activity-managed by default; `data-active="manual"` opts out deliberately.

## Native disclosure

Buttons with `aria-controls` and `aria-expanded` receive native disclosure handling from the router. Escape closes open controls. `data-snz-ignore` opts out.

## Tracking

The global `track` component attr emits `data-snz-track`. `snz.track(event, data)` integrates with an available adapter or dispatches `snz:track` for project code.
