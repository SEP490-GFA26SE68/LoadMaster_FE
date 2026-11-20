import { useEffect, type RefObject } from 'react'
import { launcherLift, type Box } from './launcher-lift'

export const AVOID_SELECTOR = '[data-assistant-avoid]'
const LIFT_VAR = '--assistant-lift'

/**
 * Chỗ của nút ở vị trí gốc, tính từ `right` / `bottom` đã tính của nó và cỡ khung nhìn — không đọc khung đang vẽ, vì nút nâng bằng
 * `transform` có chuyển động: đọc giữa chừng sẽ ra chỗ sai.
 */
function baseZone(button: HTMLElement): Box {
  const style = getComputedStyle(button)
  const viewport = document.documentElement
  const bottom = viewport.clientHeight - Number.parseFloat(style.bottom)
  const right = viewport.clientWidth - Number.parseFloat(style.right)
  return { top: bottom - button.offsetHeight, bottom, left: right - button.offsetWidth, right }
}

/**
 * Nâng nút "Hỏi Lumo" khi phần tử mang `data-assistant-avoid` (xem `launcher-lift.ts`) chạm vào chỗ của nó.
 * Đo lại khi cuộn, đổi cỡ khung nhìn và khi một chuyển động CSS xong (chữ hiện ra một lần), gộp theo khung hình; ghi khoảng nâng vào biến
 * `--assistant-lift` của <html> để khung chat (desktop) đứng theo. Gỡ thì trả biến về như cũ.
 */
export function useLauncherLift(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const root = document.documentElement
    let lift = 0
    let frame = 0

    const measure = () => {
      frame = 0
      const button = ref.current
      if (!button) return
      const avoid = [...document.querySelectorAll<HTMLElement>(AVOID_SELECTOR)].map((element) => element.getBoundingClientRect())
      const next = launcherLift(baseZone(button), avoid)
      if (next === lift) return
      lift = next
      root.style.setProperty(LIFT_VAR, `${lift}px`)
    }
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    document.addEventListener('transitionend', schedule)
    document.addEventListener('animationend', schedule)
    return () => {
      if (frame !== 0) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('transitionend', schedule)
      document.removeEventListener('animationend', schedule)
      root.style.removeProperty(LIFT_VAR)
    }
  }, [ref])
}
