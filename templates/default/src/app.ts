// Site-specific client code. Router owns nav and html[data-page].

document.addEventListener('snz:page', (event) => {
  const root = event.detail.main ?? document.querySelector('[data-route-root]')
  if (!root) return
})
