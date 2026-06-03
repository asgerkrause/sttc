/** Drop `.img-tmp` when `.img-main` finishes loading (lazy `<Image />`). */

function dropTmp(main) {
  main.closest('.img-w')?.querySelector('.img-tmp')?.remove()
}

function bindLazyImage(main) {
  if (!main.matches('.img-w .img-main') || main.dataset.previewBound === '1') return
  main.dataset.previewBound = '1'

  if (main.complete && main.naturalWidth > 0) {
    dropTmp(main)
    return
  }

  main.addEventListener('load', () => dropTmp(main), { once: true })
  main.addEventListener('error', () => dropTmp(main), { once: true })
}

export function initImagePreview(root = document) {
  for (const main of root.querySelectorAll?.('.img-w:has(.img-tmp) .img-main') ?? []) {
    bindLazyImage(main)
  }
}
