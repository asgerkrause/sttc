export {}

declare global {
  type SnzPageDetail = {
    slug: string
    path: string
    main: HTMLElement | null
  }

  type SnzPageHandler = (detail: SnzPageDetail) => void
  type SnzBeforeNavigateHandler = (to: string) => boolean | void
  type SnzAfterNavigateHandler = (detail: SnzPageDetail) => void
  type SnzComponentCleanup = () => void
  type SnzComponentMount = (el: HTMLElement) => void | SnzComponentCleanup

  interface SnzRuntime {
    navigate(path: string): Promise<boolean>
    page(): string
    onPage(slug: string, fn: SnzPageHandler): () => void
    prefetch(path: string): Promise<void> | void
    beforeNavigate(fn: SnzBeforeNavigateHandler): () => void
    afterNavigate(fn: SnzAfterNavigateHandler): () => void
    track(event: string, data?: Record<string, unknown>): void
    _registerComponent(name: string, fn: SnzComponentMount): () => void
  }

  interface Window {
    snz?: SnzRuntime
    va?: (event: string, data?: Record<string, unknown>) => void
  }

  interface DocumentEventMap {
    'snz:page': CustomEvent<SnzPageDetail>
    'snz:track': CustomEvent<{ event: string; data: Record<string, unknown> }>
  }
}
