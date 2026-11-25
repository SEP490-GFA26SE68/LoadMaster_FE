import { useCallback, useEffect, useRef } from 'react'

export type ElementSize = { readonly width: number; readonly height: number }

/**
 * Kích thước (border box, như `offsetWidth` / `offsetHeight`) của nhãn DOM neo trên khung 3D, đo bằng ResizeObserver và giữ sẵn, để
 * `useFrame` không đọc layout mỗi khung hình — đọc `offsetHeight` / `getBoundingClientRect` ngay sau khi drei vừa ghi `transform` của
 * nhãn bắt trình duyệt tính lại layout giữa khung hình. Đổi kích thước thì gọi `onResize` (thường là `invalidate`) để vẽ lại theo số mới.
 * Không có ResizeObserver (jsdom) thì `sizeOf` đọc thẳng như trước.
 */
export function useObservedSizes(onResize: () => void) {
  const sizes = useRef(new Map<Element, ElementSize>())
  const tracked = useRef(new Set<HTMLElement>())
  const observer = useRef<ResizeObserver | null>(null)
  const supported = typeof ResizeObserver !== 'undefined'

  useEffect(() => {
    if (!supported) return
    const known = sizes.current
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.borderBoxSize?.[0]
        const target = entry.target as HTMLElement
        known.set(target, box ? { width: box.inlineSize, height: box.blockSize } : { width: target.offsetWidth, height: target.offsetHeight })
      }
      onResize()
    })
    observer.current = resizeObserver
    for (const element of tracked.current) resizeObserver.observe(element)
    return () => { resizeObserver.disconnect(); observer.current = null; known.clear() }
  }, [supported, onResize])

  /** Theo dõi một phần tử (gọi từ callback ref; `null` bỏ phần tử cũ ở vị trí đó qua `previous`). */
  const track = useCallback((element: HTMLElement | null, previous?: HTMLElement | null) => {
    if (previous && previous !== element) {
      tracked.current.delete(previous)
      observer.current?.unobserve(previous)
      sizes.current.delete(previous)
    }
    if (!element || tracked.current.has(element)) return
    tracked.current.add(element)
    observer.current?.observe(element)
  }, [])

  /** Kích thước đã đo; `null` khi chưa đo xong (ResizeObserver chưa báo). */
  const sizeOf = useCallback((element: HTMLElement): ElementSize | null => {
    if (!supported) return { width: element.offsetWidth, height: element.offsetHeight }
    return sizes.current.get(element) ?? null
  }, [supported])

  return { track, sizeOf }
}
