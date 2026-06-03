// Optional smooth-scroll bootstrapper.
// Disabled when:
//   - <html data-scroll="native"> (author opt-out via site.json)
//   - prefers-reduced-motion: reduce
// Otherwise loads vendored Lenis and exposes window.lenis for the router.

const mode = document.documentElement.dataset.scroll ?? 'lenis'
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (mode === 'lenis' && !reduceMotion) {
  const lenisCss = document.createElement('link')
  lenisCss.rel = 'stylesheet'
  lenisCss.href = '/assets/css/lenis.css'
  document.head.appendChild(lenisCss)

  const lenisJs = document.createElement('script')
  lenisJs.src = '/assets/js/vendor/lenis.min.js'
  lenisJs.defer = true
  lenisJs.onload = () => {
    window.lenis = new window.Lenis({
      autoRaf: true,
      lerp: 0.25,
      syncTouch: true,
      anchors: { offset: -100 },
      touchMultiplier: 0.75,
    })
  }
  document.head.appendChild(lenisJs)
}
