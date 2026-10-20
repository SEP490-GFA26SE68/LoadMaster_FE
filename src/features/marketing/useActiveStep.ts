import { useEffect, useState, useSyncExternalStore, type RefObject } from 'react'

/** Khung dính của Cách hoạt động chỉ có từ 1.024 px (bậc `lg`). */
const WIDE = '(min-width: 1024px)'
/** Một mục là "đang đọc" khi nó cắt dải 10 % ở giữa khung nhìn. */
const READING_BAND = '-45% 0px -45% 0px'

function subscribeWide(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const list = matchMedia(WIDE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function readStage(): boolean {
  return typeof IntersectionObserver === 'function' && typeof matchMedia === 'function' && matchMedia(WIDE).matches
}

function readNever(): boolean {
  return false
}

/** Có khung dính không: từ 1.024 px và chỉ khi có IntersectionObserver (jsdom: không); đổi theo bề rộng khung nhìn. */
export function useStepsStage(): boolean {
  return useSyncExternalStore(subscribeWide, readStage, readNever)
}

/**
 * Mục đang đọc trong `track`: mọi phần tử `[data-step]` bên trong (bốn mục của danh sách và câu kết, số 0 → 4), mục nào cắt dải giữa
 * khung nhìn thì thành mục đang đọc; không mục nào cắt dải (giữa hai mục, đã cuộn qua) thì giữ mục cuối cùng. Một IntersectionObserver,
 * chỉ chạy khi `enabled` (có khung dính); trả 0 khi không chạy.
 */
export function useActiveStep(track: RefObject<HTMLElement | null>, enabled: boolean): number {
  const [active, setActive] = useState(0)
  useEffect(() => {
    const root = track.current
    if (!enabled || !root || typeof IntersectionObserver !== 'function') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const step = Number(entry.target.getAttribute('data-step'))
          if (entry.isIntersecting && Number.isInteger(step)) setActive(step)
        }
      },
      { rootMargin: READING_BAND },
    )
    for (const el of root.querySelectorAll('[data-step]')) observer.observe(el)
    return () => observer.disconnect()
  }, [track, enabled])
  return enabled ? active : 0
}
