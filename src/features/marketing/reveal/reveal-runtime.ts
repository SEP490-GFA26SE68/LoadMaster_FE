import { createContext, type CSSProperties } from 'react'

/**
 * Lõi của hệ hiện chữ: **một** IntersectionObserver cho cả trang, không state React. Phần tử đăng ký (gọi là "cổng") nhận
 * `data-reveal-gate`; khi lộ đủ thì nhận `data-shown` rồi thôi theo dõi — CSS (`reveal.css`) cho mọi mảnh bên trong chạy, không chạy lại.
 */

/** Người nghe một cổng: `instant` khi cổng được mở bằng lưới an toàn (focus, in trang) — nhảy thẳng tới trạng thái cuối. */
export type RevealListener = { readonly current: ((instant: boolean) => void) | undefined }

/**
 * Ngưỡng lộ: 15 % phần tử, đáy khung nhìn bớt 10 %. Thêm ngưỡng 0 để biết lúc một phần tử quá cao (không thể lộ 15 %) vừa vào khung, và
 * ngưỡng 7 % cho cổng tự đặt ngưỡng thấp hơn (`data-reveal-at`, `Reveal at`) — vd. ô cao gấp đôi ô bên cạnh, để hai ô cùng hàng mở cùng lúc.
 */
const THRESHOLD = 0.15
const OBSERVER_INIT: IntersectionObserverInit = { threshold: [0, 0.07, THRESHOLD], rootMargin: '0px 0px -10% 0px' }
/** Phần tử cao hơn năm lần khung nhìn không bao giờ lộ được 15 %: coi là lộ ngay khi vào khung. */
const TALL_RATIO = 0.2

const GATE = 'data-reveal-gate'
const SHOWN = 'data-shown'
const INSTANT = 'data-instant'

export type RevealRegistry = ReturnType<typeof createRevealRegistry>

/**
 * Lộ đủ: 15 % phần tử (hay ngưỡng riêng của cổng, `data-reveal-at`), hoặc phần tử quá cao đã vào khung; không có `rootBounds` (khung
 * lồng khác gốc) thì chỉ cần giao cắt.
 */
function enough(entry: IntersectionObserverEntry): boolean {
  if (!entry.isIntersecting) return false
  const need = entry.target instanceof HTMLElement && entry.target.dataset.revealAt ? Number(entry.target.dataset.revealAt) : THRESHOLD
  if (entry.intersectionRatio >= need - 1e-3) return true
  const root = entry.rootBounds
  const height = entry.boundingClientRect.height
  return !root || (height > 0 && root.height / height < TALL_RATIO)
}

/** Một sổ cho mỗi `RevealProvider`. Tạo trong state (không side effect); observer chỉ tồn tại giữa `connect` và `disconnect` (effect). */
export function createRevealRegistry() {
  const pending = new Map<Element, RevealListener | undefined>()
  let observer: IntersectionObserver | null = null
  let root: Element | null = null

  function show(el: Element, instant: boolean): void {
    el.setAttribute(SHOWN, '')
    if (instant) el.setAttribute(INSTANT, '')
    observer?.unobserve(el)
    const listener = pending.get(el)
    pending.delete(el)
    listener?.current?.(instant)
  }

  return {
    /** Theo dõi một cổng; trả hàm thôi theo dõi (cleanup của ref callback). Cổng đã mở thì báo ngay, không theo dõi lại. */
    observe(el: Element, listener?: RevealListener): () => void {
      el.setAttribute(GATE, '')
      if (el.hasAttribute(SHOWN)) {
        listener?.current?.(el.hasAttribute(INSTANT))
        return () => {}
      }
      pending.set(el, listener)
      observer?.observe(el)
      return () => {
        if (pending.get(el) !== listener) return
        pending.delete(el)
        observer?.unobserve(el)
      }
    },
    /** Mở cổng ngay lúc gắn, không chờ observer (`LumoSays trigger="mount"`). */
    open(el: Element, listener?: RevealListener): void {
      el.setAttribute(GATE, '')
      el.setAttribute(SHOWN, '')
      listener?.current?.(el.hasAttribute(INSTANT))
    },
    connect(): void {
      observer ??= new IntersectionObserver((entries) => {
        for (const entry of entries) if (pending.has(entry.target) && enough(entry)) show(entry.target, false)
      }, OBSERVER_INIT)
      for (const el of pending.keys()) observer.observe(el)
    },
    disconnect(): void {
      observer?.disconnect()
      observer = null
    },
    /** Ref callback của gốc `[data-reveal-root]`. */
    attachRoot(el: Element | null): void {
      root = el
    },
    /** Lưới an toàn khi focus: mọi cổng và khối hiện ra bao quanh `target` (tới gốc) nhảy tới trạng thái cuối. */
    revealAround(target: EventTarget | null): void {
      for (let el = target instanceof Element ? target : null; el && el !== root; el = el.parentElement) {
        if (el.hasAttribute(GATE) && !el.hasAttribute(SHOWN)) show(el, true)
        else if (el.hasAttribute(GATE) || el.hasAttribute('data-reveal')) el.setAttribute(INSTANT, '')
      }
    },
    /** Lưới an toàn khi in: mọi cổng mở, mọi khối nhảy tới trạng thái cuối. */
    revealAll(): void {
      for (const el of [...pending.keys()]) show(el, true)
      root?.querySelectorAll(`[${GATE}], [data-reveal]`).forEach((el) => el.setAttribute(INSTANT, ''))
    },
  }
}

/** Trạng thái chung của trang: chuyển động có bật không và sổ cổng. Ngoài `RevealProvider` (vd. `/bang-gia`): tắt. */
export type RevealRuntime = { motion: boolean; registry: RevealRegistry | null }
export const RevealRuntimeContext = createContext<RevealRuntime>({ motion: false, registry: null })

/**
 * Mốc bắt đầu của khối đang bao quanh, tính từ lúc cổng của nó mở: `steps` lần `--stagger-item` cộng `ms` mili giây. `null` khi không
 * có cổng nào bao quanh — phần tử tự làm cổng của mình.
 */
export type RevealScope = { steps: number; ms: number }
export const RevealScopeContext = createContext<RevealScope | null>(null)

/** Mốc thành giá trị của `--reveal-delay` — biến kế thừa, nên mảnh bên trong cộng thêm so le của mình lên đó. */
export function delayValue({ steps, ms }: RevealScope): string {
  return `calc(${steps} * var(--stagger-item) + ${Math.round(ms)}ms)`
}

/** Style kèm biến CSS; biến `undefined` bị bỏ. */
export function withVars(vars: Readonly<Record<`--${string}`, string | number | undefined>>, style?: CSSProperties): CSSProperties {
  const out: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(vars)) if (value !== undefined) out[key] = value
  return { ...style, ...out }
}
