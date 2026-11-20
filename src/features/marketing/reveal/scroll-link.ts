import { useCallback, type RefCallback } from 'react'

/**
 * Chuyển động theo cuộn của trang giới thiệu. Trình duyệt có view timeline (`animation-timeline: view()`) thì CSS tự làm hết; không có thì
 * `useScrollProgress` ghi tiến độ cuộn của phần tử vào biến CSS `--scroll-p` (0 khi mép trên vừa vào đáy khung nhìn, 1 khi mép dưới vừa ra
 * khỏi đỉnh — như `cover` của view timeline). Ghi thẳng vào style của phần tử trong `requestAnimationFrame`, không qua state React; chỉ nghe
 * cuộn khi phần tử đang trong khung nhìn (IntersectionObserver).
 */

/** Trình duyệt có view timeline không. Không có `CSS.supports` (jsdom): không. */
export function supportsViewTimeline(): boolean {
  return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('animation-timeline: view()')
}

/** Tiến độ `cover` (0 → 1) của một hộp so với khung nhìn cao `viewport`. */
export function coverProgress(top: number, height: number, viewport: number): number {
  const span = viewport + height
  if (span <= 0) return 0
  return Math.min(1, Math.max(0, (viewport - top) / span))
}

/**
 * Ref callback ghi `--scroll-p` lên phần tử khi trình duyệt thiếu view timeline. `enabled` sai (chuyển động tắt) hoặc trình duyệt có view
 * timeline: ref không làm gì. Không có IntersectionObserver: cũng không làm gì (trang tĩnh).
 */
export function useScrollProgress<T extends HTMLElement>(enabled: boolean): RefCallback<T> {
  return useCallback(
    (el: T | null) => {
      if (!el || !enabled || supportsViewTimeline() || typeof IntersectionObserver !== 'function') return undefined
      let frame = 0
      let listening = false
      const write = () => {
        frame = 0
        const box = el.getBoundingClientRect()
        el.style.setProperty('--scroll-p', coverProgress(box.top, box.height, window.innerHeight).toFixed(4))
      }
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(write)
      }
      const listen = (on: boolean) => {
        if (on === listening) return
        listening = on
        if (on) {
          window.addEventListener('scroll', schedule, { passive: true })
          window.addEventListener('resize', schedule)
          schedule()
        } else {
          window.removeEventListener('scroll', schedule)
          window.removeEventListener('resize', schedule)
        }
      }
      const observer = new IntersectionObserver((entries) => {
        const entry = entries.at(-1)
        if (entry) listen(entry.isIntersecting)
      })
      observer.observe(el)
      return () => {
        observer.disconnect()
        listen(false)
        if (frame) cancelAnimationFrame(frame)
      }
    },
    [enabled],
  )
}
