import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { countFrame } from './count-up'

/** Thời lượng một lần đếm, bằng `--dur-slow` (500 ms). */
const COUNT_MS = 500

/**
 * Số sống đếm tới **đúng** giá trị mới mỗi khi máy chủ báo số khác (`countFrame`: không vượt, không tự tăng khi không có số mới). Lần đầu
 * và khi giảm chuyển động (hay trình duyệt không có `requestAnimationFrame`) thì đặt thẳng. `null` là chưa có số.
 */
export function useCountUp(target: number | null, step = 1): number | null {
  const reducedMotion = usePrefersReducedMotion()
  const [shown, setShown] = useState(target)
  const last = useRef(target)

  useEffect(() => {
    const from = last.current
    if (target === null || from === null || reducedMotion || typeof requestAnimationFrame !== 'function') {
      last.current = target
      setShown(target)
      return
    }
    const start = performance.now()
    let frame = 0
    const tick = (time: number) => {
      const value = countFrame(from, target, (time - start) / COUNT_MS, step)
      last.current = value
      setShown(value)
      if (value !== target) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, step, reducedMotion])

  return reducedMotion ? target : shown
}
