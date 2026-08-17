# Image pipeline

**Status:** active

## Decision

Bun processes JPEG, PNG, and WebP masters from `src/images/` and configured CMS media inputs into canonical WebP files and responsive variants. Logical names are unique basenames.

The retained `Image` component is compiler-assisted. It receives intrinsic dimensions, native loading/decoding, optional responsive `srcset` and `sizes`, and eager fetch priority. It emits plain image markup with no wrapper, placeholder overlay, or visual CSS.

`src/images/og.png` emits WebP and PNG social output. Build validates public image references and rejects missing or duplicate logical sources.

## Why

Image correctness and optimization are renderer concerns; crop, layout, effects, and presentation remain project concerns.
