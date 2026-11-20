import { useCallback, type RefCallback } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { journeyState } from './journey-model'

/** Mốc của khung nhìn mà chặng "đang xem" phải qua: hơi dưới giữa màn, nơi mắt đọc khi cuộn. */
const ANCHOR_RATIO = 0.55

/**
 * Ref callback cho phần "Một chuyến hàng": mỗi lần cuộn (gộp theo `requestAnimationFrame`, chỉ khi phần đang trong khung nhìn) ghi tiến độ
 * `--p` và chặng đang xem `data-chapter` lên phần tử, và `data-reached` lên các chặng đã tới (`[data-chapter-index]`) — thẳng vào DOM,
 * không qua state React. Giảm chuyển động: tiến độ đứng ở giữa từng chặng (hình đổi theo chặng). Không có IntersectionObserver (jsdom,
 * trình duyệt cũ): không ghi gì — CSS giữ trạng thái mặc định (thùng đầy), không chặng nào bị ẩn.
 */
export function useJourneyProgress<T extends HTMLElement>(): RefCallback<T> {
  const reducedMotion = usePrefersReducedMotion()
  return useCallback(
    (el: T | null) => {
      if (!el || typeof IntersectionObserver !== 'function') return undefined
      const chapters = [...el.querySelectorAll<HTMLElement>('[data-chapter-index]')]
      let frame = 0
      let listening = false
      let last = ''
      const write = () => {
        frame = 0
        const anchor = window.innerHeight * ANCHOR_RATIO
        const boxes = chapters.map((chapter) => {
          const rect = chapter.getBoundingClientRect()
          return { top: rect.top, height: rect.height }
        })
        const { p, chapter } = journeyState(boxes, anchor, reducedMotion)
        const key = `${p}:${chapter}`
        if (key === last) return
        last = key
        el.style.setProperty('--p', String(p))
        el.dataset.chapter = String(chapter)
        chapters.forEach((node, index) => {
          if (index <= chapter) node.dataset.reached = ''
          else delete node.dataset.reached
        })
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
    [reducedMotion],
  )
}
