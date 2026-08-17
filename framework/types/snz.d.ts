export {}

declare global {
  type SnzPageDetail = {
    slug: string
    pathname: string
    main: HTMLElement | null
  }

  type SnzNavigateDetail = {
    slug: string
    pathname: string
  }

  type SnzPageHandler = (detail: SnzPageDetail) => void
  type SnzBeforeNavigateHandler = (detail: SnzNavigateDetail) => boolean | void | Promise<boolean | void>
  type SnzAfterNavigateHandler = (detail: SnzPageDetail) => void
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
    navigate(path: string, options?: { replace?: boolean }): Promise<void>
    page(): string | undefined
    onPage(slug: string, fn: SnzPageHandler): () => void
    prefetch(path: string): Promise<string | null>
    beforeNavigate(fn: SnzBeforeNavigateHandler): () => void
    afterNavigate(fn: SnzAfterNavigateHandler): () => void
    track(event: string, data?: Record<string, unknown>): void
    onVisible(el: Element, handlers?: SnzVisibilityOptions): () => void
    isVisible(el: Element, options?: Pick<SnzVisibilityOptions, 'threshold'>): boolean
    onActive(el: Element, handlers?: SnzVisibilityOptions): () => void
    isActive(el: Element, options?: Pick<SnzVisibilityOptions, 'threshold'>): boolean
    _reload(): Promise<void>
    _registerComponent(name: string, fn: SnzComponentMount): () => void
    _mountComponents(root?: ParentNode): void
    _unmountIn(root: ParentNode): void
  }

  interface Window {
    snz?: SnzRuntime
    va?: ((event: string, data?: Record<string, unknown>) => void) | {
      track(event: string, data?: Record<string, unknown>): void
    }
  }

  interface DocumentEventMap {
    'snz:page': CustomEvent<SnzPageDetail>
    'snz:track': CustomEvent<{ event: string; data: Record<string, unknown> }>
  }
}
