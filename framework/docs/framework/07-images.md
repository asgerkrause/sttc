# Images

Put raster masters in source image roots. Build encodes optimized WebP files with `Bun.Image`.

```txt
src/images/hero.png          author-owned image or PagesCMS upload
```

Use logical basename in markup:

```html
<Image src="hero" alt="Product interface" max="1200" loading="eager" />
```

Build emits files under:

```txt
dist/assets/images/
```

Do not edit `dist/`.

## Other media

Use public source roots by media class:

```txt
src/videos/intro.mp4       -> dist/assets/videos/intro.mp4
src/files/menu.pdf         -> dist/assets/files/menu.pdf
```

Anything in `src/images/`, `src/videos/`, or `src/files/` is publishable. Build validates authored `/assets/images/*`, `/assets/videos/*`, and `/assets/files/*` references exist. Videos/files are passthrough today; video compression/transcoding can be added later without changing author paths.

## Image component

`<Image>` renders responsive image markup inside `.media` wrapper.

```html
<Image
  src="office"
  alt="Team planning launch calendar"
  max="1600"
  quality="82"
  sizes="(min-width: 60rem) 50vw, 100vw"
/>
```

Attrs:

| Attr | Meaning |
| --- | --- |
| `src!` | Unique logical basename without extension. |
| `alt!` | Alt text. Use `alt=""` for decorative images. |
| `max` | Max long edge in px. Default `1200`. |
| `quality` | WebP quality 1-100. Default `82`. |
| `loading` | `lazy` or `eager`. Default `lazy`. |
| `sizes` | Browser sizes hint. Default `100vw` when responsive. |
| `responsive` | `true` or `false`. Default `true`. |
| `width` / `height` | Override intrinsic dimensions. |

## Responsive variants

Build scans `<Image>` usage, reads `max` and `quality`, and emits needed variants. Standard widths include 320, 640, 1024, and requested max when useful.

Keep each logical basename unique across image roots. If both roots contain `hero.png`, rename one master.

## Lazy preview

Lazy images render a temporary `.img-tmp` preview above main image.

```html
<Image src="case-study" alt="Dashboard overview" />
```

Site code removes `.img-tmp` after main image loads or errors.

```js
import { initImagePreview } from './app/image-preview.js'

document.addEventListener('DOMContentLoaded', () => initImagePreview())
document.addEventListener('snz:page', (event) => {
  const root = event.detail.main ?? document.querySelector('[data-route-root]')
  initImagePreview(root ?? document)
})
```

Use eager for above-fold or LCP images:

```html
<Image src="hero" alt="Product interface" max="1600" loading="eager" />
```

Eager images skip preview.

## Styling images

Wrapper class is `.media`. Main image has no private `.img-main` class.

```css
.feature-media .media {
  aspect-ratio: 4 / 3;
}

.feature-media .media img {
  object-fit: cover;
}

.feature-media .img-tmp {
  filter: blur(12px);
}
```

If selector belongs to one component, put it in that component `<style>`.

## Alt text

Use useful alt text for meaningful images:

```html
<Image src="founder" alt="Maya Chen presenting roadmap sketches" />
```

Use empty alt for decorative images:

```html
<Image src="texture" alt="" />
```

Do not duplicate nearby captions in alt text. Describe image purpose in context.

## SVG and icons

`<Image>` is for raster masters processed by build. For SVG marks/icons, use inline SVG, normal `<img>`, or component slot when appropriate.

Logo example:

```html
<Logo size="2lh">
  <img src="/assets/images/logo.svg" alt="">
</Logo>
```

Nested logo image should fit wrapper height.

## Open Graph image

Place OG source at:

```txt
src/images/og.png
```

Build emits:

```txt
/assets/og.webp
/assets/og.png
```

Set default in `src/site.json` or override per route with `<SEO ogImage="..." />`.

## CMS images

PagesCMS uploads can live in `src/images`. Use same `<Image src="basename" ... />` contract from templates or route output.

```html
<Image src="{{image}}" alt="{{imageAlt}}" max="1200" />
```

Keep CMS field values aligned to logical basename expected by build.

## Next

[CSS system](./06-css-system.md) · [Docs home](./README.md) · [Content and CMS](./08-content-and-cms.md)
