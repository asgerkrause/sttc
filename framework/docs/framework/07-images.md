# Images

Place unique image masters in `src/images/` or a configured PagesCMS media input. Supported masters are JPEG, PNG, and WebP.

```html
<Image src="hero" alt="Product interface" max="1600" quality="82" />
```

The `Image` component is compiler-assisted. Build output includes:

- canonical `/assets/images/hero.webp`;
- responsive width variants;
- intrinsic width and height;
- native `srcset`, `sizes`, `loading`, and `decoding` attributes;
- `fetchpriority="high"` for eager images.

No wrapper, placeholder overlay, parallax, gradient, or image CSS ships. Projects control presentation.

Logical names are basenames without extension and must be unique across image source roots. `alt` is required; `alt=""` is valid for decorative images. `responsive="false"` omits srcset.

`src/images/og.png` emits `/assets/og.webp` and a PNG fallback. Set `image` in `site.json` or override it per route with `<SEO image="/assets/images/page.webp" />`. `ogImage` remains a compatibility alias.

Build validates authored public image references and fails missing or duplicate assets with source hints.
