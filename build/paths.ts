import { join } from 'path'

export const root = join(import.meta.dir, '..')
export const src = join(root, 'src')
export const dist = join(root, 'dist')
export const componentsDir = join(src, 'components')
