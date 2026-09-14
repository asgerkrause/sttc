export {}

declare global {
  type SnzPageDetail = {
    slug: string
    pathname: string
    main: HTMLElement | null
  }

  type SnzPageHandler = (detail: SnzPageDetail) => void
  type SnzComponentCleanup = () => void
  type SnzComponentMount = (el: Element) => void | SnzComponentCleanup

  type SnzVisibilityDetail = {
    visible: boolean
    active: boolean
    entry?: IntersectionObserverEntry
    ratio: number
  }

  type SnzVisibilityHandler = (detail: SnzVisibilityDetail) => void
  type SnzVisibilityOptions = {
    threshold?: number
    margin?: string
    enter?: SnzVisibilityHandler
    exit?: SnzVisibilityHandler
    change?: SnzVisibilityHandler
  }

  interface SnzRuntime {
    page(): string | undefined
    onPage(slug: string, fn: SnzPageHandler): () => void
    track(event: string, data?: Record<string, unknown>): void
    onVisible(el: Element, handlers?: SnzVisibilityOptions): () => void
    isVisible(el: Element, options?: Pick<SnzVisibilityOptions, 'threshold'>): boolean
    onActive(el: Element, handlers?: SnzVisibilityOptions): () => void
    isActive(el: Element, options?: Pick<SnzVisibilityOptions, 'threshold'>): boolean
    _registerComponent(name: string, fn: SnzComponentMount): () => void
  }

  interface Window {
    snz: SnzRuntime
  }

  interface DocumentEventMap {
    'snz:page': CustomEvent<SnzPageDetail>
    'snz:track': CustomEvent<{ event: string; data: Record<string, unknown> }>
  }
}
