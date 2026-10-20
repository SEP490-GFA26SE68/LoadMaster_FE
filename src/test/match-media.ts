import { act } from '@testing-library/react'

/**
 * `matchMedia` điều khiển được cho test DOM — jsdom không có. `installMatchMedia({ '(prefers-reduced-motion: reduce)': true })` trả lời
 * theo bảng; truy vấn không có trong bảng là không khớp. `set(query, matches)` đổi một truy vấn và, khi kết quả đổi, báo mọi danh sách
 * của truy vấn đó như trình duyệt — người nghe `addEventListener('change')`, `addListener` kiểu cũ và `onchange` —, trong `act()` như
 * `fireEvent`. `restore()` trả lại đúng `matchMedia` có trước đó, kể cả bản `window.matchMedia ??= …` một số file test đặt ở đầu file.
 * Truy vấn so theo chuỗi đã chuẩn hoá khoảng trắng: `(min-width:1280px)` khớp `(min-width: 1280px)`.
 */
export type MatchMediaControl = {
  /** Đổi kết quả của một truy vấn; báo người nghe khi kết quả khác trước. */
  set(query: string, matches: boolean): void
  /** Số người nghe `change` đang gắn vào các danh sách của truy vấn — để kiểm effect đã gỡ khi unmount. */
  listeners(query: string): number
  restore(): void
}

type ChangeHandler = ((this: MediaQueryList, event: MediaQueryListEvent) => unknown) | null

/** Chuẩn hoá gần như trình duyệt tuần tự hoá truy vấn, đủ cho các truy vấn viết tay trong code. */
function normalize(query: string): string {
  return query.trim().replace(/\s+/g, ' ').replace(/\(\s*/g, '(').replace(/\s*\)/g, ')').replace(/\s*:\s*/g, ': ')
}

class FakeMediaQueryList implements MediaQueryList {
  readonly media: string
  onchange: ChangeHandler = null
  /** Người nghe `change`, chung cho `addEventListener` và `addListener` như trình duyệt: cùng một hàm chỉ gắn một lần. */
  readonly handlers = new Set<unknown>()
  private readonly read: (media: string) => boolean

  constructor(media: string, read: (media: string) => boolean) {
    this.media = media
    this.read = read
  }

  get matches(): boolean {
    return this.read(this.media)
  }

  addListener(callback: unknown): void {
    if (callback) this.handlers.add(callback)
  }

  removeListener(callback: unknown): void {
    this.handlers.delete(callback)
  }

  addEventListener(...[type, listener]: unknown[]): void {
    if (type === 'change' && listener) this.handlers.add(listener)
  }

  removeEventListener(...[type, listener]: unknown[]): void {
    if (type === 'change') this.handlers.delete(listener)
  }

  dispatchEvent(event: Event): boolean {
    if (event.type !== 'change') return true
    for (const handler of [...this.handlers]) {
      if (typeof handler === 'function') Reflect.apply(handler, this, [event])
      else if (typeof handler === 'object' && handler !== null && 'handleEvent' in handler && typeof handler.handleEvent === 'function') {
        Reflect.apply(handler.handleEvent, handler, [event])
      }
    }
    return !event.defaultPrevented
  }

  /** Báo kết quả mới bằng sự kiện `change` như trình duyệt. */
  notify(): void {
    const event = Object.assign(new Event('change'), { matches: this.matches, media: this.media })
    this.dispatchEvent(event)
    this.onchange?.call(this, event)
  }
}

/** Cài `matchMedia` giả lên `globalThis` (trong jsdom của Vitest, `window` chính là `globalThis`). */
export function installMatchMedia(matches: Readonly<Record<string, boolean>> = {}): MatchMediaControl {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia')
  const state = new Map(Object.entries(matches).map(([query, value]) => [normalize(query), value]))
  const lists: FakeMediaQueryList[] = []
  const read = (media: string) => state.get(media) ?? false
  const matchMedia = (query: string): MediaQueryList => {
    const list = new FakeMediaQueryList(normalize(query), read)
    lists.push(list)
    return list
  }
  Object.defineProperty(globalThis, 'matchMedia', { value: matchMedia, writable: true, configurable: true })

  return {
    set(query, value) {
      const media = normalize(query)
      if (read(media) === value) return
      state.set(media, value)
      act(() => {
        for (const list of lists) if (list.media === media) list.notify()
      })
    },
    listeners(query) {
      const media = normalize(query)
      return lists.filter((list) => list.media === media).reduce((sum, list) => sum + list.handlers.size + (list.onchange ? 1 : 0), 0)
    },
    restore() {
      if (previous) Object.defineProperty(globalThis, 'matchMedia', previous)
      else Reflect.deleteProperty(globalThis, 'matchMedia')
    },
  }
}
