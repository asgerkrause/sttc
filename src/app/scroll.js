// The build emits this bootstrap and its assets only for `"scroll": "lenis"`.
// Reduced-motion users keep native scrolling without loading Lenis.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

if (!reduceMotion) {
  const lenisCss = document.createElement('link')
  lenisCss.rel = 'stylesheet'
  lenisCss.href = '/assets/css/lenis.css'
  document.head.appendChild(lenisCss)

  const lenisJs = document.createElement('script')
  lenisJs.src = '/assets/js/vendor/lenis.min.js'
  lenisJs.defer = true
  lenisJs.onload = () => {
    const lenis = new window.Lenis({
      autoRaf: true,
      lerp: 0.25,
      syncTouch: true,
      // Navigation is native. Lenis still resets wheel inertia on an internal link click so the
      // coast does not run on while the next document loads.
      stopInertiaOnNavigate: true,
      anchors: { offset: -100 },
      touchMultiplier: 0.75,
    })
    window.lenis = lenis
  }
  document.head.appendChild(lenisJs)
}
