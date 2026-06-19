/** Drop `.img-tmp` when the main image finishes loading (lazy `<Image />`). */

/** @param {HTMLImageElement} main */
function dropTmp(main) {
  main.closest('.img-w')?.querySelector('.img-tmp')?.remove()
}

/** @param {HTMLImageElement} main */
function bindLazyImage(main) {
  if (!main.matches('.img-w > img:not(.img-tmp)') || main.dataset.previewBound === '1') return
  main.dataset.previewBound = '1'

  if (main.complete && main.naturalWidth > 0) {
    dropTmp(main)
    return
  }

  main.addEventListener('load', () => dropTmp(main), { once: true })
  main.addEventListener('error', () => dropTmp(main), { once: true })
}

/** @param {ParentNode} [root] */
export function initImagePreview(root = document) {
  for (const main of root.querySelectorAll('.img-w:has(.img-tmp) > img:not(.img-tmp)')) {
    if (main instanceof HTMLImageElement) bindLazyImage(main)
  }
}
