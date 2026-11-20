import { act } from '@testing-library/react'

/**
 * `IntersectionObserver` giả cho test DOM — jsdom không có, nên trang giới thiệu trong jsdom là tĩnh (AGENTS mục 9). Test cần chuyển
 * động thì cài bản giả rồi tự báo giao cắt:
 *
 *   const io = installFakeIntersectionObserver()
 *   render(<LandingPage />)
 *   io.trigger(phần tử đang được theo dõi) // hoặc io.triggerAll()
 *   io.restore() // trong afterEach
 *
 * Khác bản thật: `observe()` không tự báo lần đầu và không có hàng đợi — mỗi lần `trigger` gọi callback ngay, trong `act()` như
 * `fireEvent`. `rootMargin` giữ nguyên chuỗi đã truyền (bản thật chuẩn hoá thành bốn giá trị), `thresholds` sắp tăng dần, mặc định `[0]`.
 */
export class FakeIntersectionObserver implements IntersectionObserver {
  readonly callback: IntersectionObserverCallback
  /** Tuỳ chọn đúng như nơi tạo đã truyền, để test đọc lại. */
  readonly options: IntersectionObserverInit
  readonly root: Element | Document | null
  readonly rootMargin: string
  readonly scrollMargin: string
  readonly thresholds: readonly number[]
  /** Phần tử đang được theo dõi, theo thứ tự `observe`. */
  readonly targets = new Set<Element>()

  constructor(callback: IntersectionObserverCallback, options: IntersectionObserverInit = {}) {
    this.callback = callback
    this.options = options
    this.root = options.root ?? null
    this.rootMargin = options.rootMargin ?? '0px 0px 0px 0px'
    this.scrollMargin = options.scrollMargin ?? '0px 0px 0px 0px'
    this.thresholds = [options.threshold ?? 0].flat().sort((a, b) => a - b)
  }

  observe(target: Element): void {
    this.targets.add(target)
  }

  unobserve(target: Element): void {
    this.targets.delete(target)
  }

  disconnect(): void {
    this.targets.clear()
  }

  takeRecords(): IntersectionObserverEntry[] {
    return []
  }
}

export type FakeIntersectionObserverControl = {
  /** Mọi observer tạo ra từ lúc cài, theo thứ tự tạo, kể cả observer đã `disconnect`. */
  readonly instances: readonly FakeIntersectionObserver[]
  /**
   * Báo một lần giao cắt của `el` cho mọi observer còn theo dõi nó; trả số observer đã nhận. Mặc định lộ hẳn (`isIntersecting: true`,
   * tỉ lệ 1); chỉ đưa `intersectionRatio` thì `isIntersecting` suy từ tỉ lệ đó (> 0).
   */
  trigger(el: Element, entry?: Partial<IntersectionObserverEntry>): number
  /** Báo cho mọi phần tử đang được theo dõi: mỗi observer một lần gọi, kèm mọi phần tử của nó. Mặc định là lộ hẳn. */
  triggerAll(isIntersecting?: boolean): void
  /** Bỏ bản giả, trả lại đúng thứ có trước đó — kể cả khi trước đó không có `IntersectionObserver`. */
  restore(): void
}

const ZERO_RECT: DOMRectReadOnly = { x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON: () => ({}) }

function entryOf(target: Element, partial: Partial<IntersectionObserverEntry> = {}): IntersectionObserverEntry {
  const isIntersecting = partial.isIntersecting ?? (partial.intersectionRatio === undefined || partial.intersectionRatio > 0)
  const rect = target.getBoundingClientRect()
  return {
    target,
    isIntersecting,
    intersectionRatio: partial.intersectionRatio ?? (isIntersecting ? 1 : 0),
    boundingClientRect: partial.boundingClientRect ?? rect,
    intersectionRect: partial.intersectionRect ?? (isIntersecting ? rect : ZERO_RECT),
    rootBounds: partial.rootBounds ?? null,
    time: partial.time ?? performance.now(),
  }
}

/** Cài `IntersectionObserver` giả lên `globalThis` (trong jsdom của Vitest, `window` chính là `globalThis`). */
export function installFakeIntersectionObserver(): FakeIntersectionObserverControl {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver')
  const instances: FakeIntersectionObserver[] = []
  class Installed extends FakeIntersectionObserver {
    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options)
      instances.push(this)
    }
  }
  Object.defineProperty(globalThis, 'IntersectionObserver', { value: Installed, writable: true, configurable: true })
  const watching = () => instances.filter((observer) => observer.targets.size > 0)

  return {
    instances,
    trigger(el, entry) {
      const observers = watching().filter((observer) => observer.targets.has(el))
      act(() => {
        for (const observer of observers) observer.callback([entryOf(el, entry)], observer)
      })
      return observers.length
    },
    triggerAll(isIntersecting = true) {
      act(() => {
        for (const observer of watching()) {
          observer.callback([...observer.targets].map((target) => entryOf(target, { isIntersecting })), observer)
        }
      })
    },
    restore() {
      if (previous) Object.defineProperty(globalThis, 'IntersectionObserver', previous)
      else Reflect.deleteProperty(globalThis, 'IntersectionObserver')
    },
  }
}
