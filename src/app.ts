// Site-specific client code. Router owns nav and html[data-page].

import { initImagePreview } from './app/image-preview.js'

document.addEventListener('DOMContentLoaded', () => initImagePreview())
document.addEventListener('snz:page', (event) => {
  const root = event.detail.main ?? document.querySelector('[data-route-root]')
  initImagePreview(root ?? document)
})
