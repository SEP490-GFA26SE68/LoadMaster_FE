import { useEffect, useState } from 'react'
import { anchorClock, clockElapsed, type ClockAnchor } from './run-clock'

/** Nhịp vẽ lại đồng hồ: đồng hồ hiện tới giây. */
const TICK_MS = 1000

/**
 * Thời gian đã chạy của job đang chạy, mili giây (`run-clock.ts`): neo theo `elapsedMs` của máy chủ mỗi lần đọc, tự chạy giữa hai lần
 * đọc. `running` sai (chờ tới lượt, đã xong, đóng hộp thoại) thì không đếm và không có hẹn giờ nào; trả `null` khi chưa đếm.
 */
export function useRunClock(running: boolean, serverElapsedMs: number | null): number | null {
  const [anchor, setAnchor] = useState<ClockAnchor | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return
    const at = Date.now()
    setAnchor((previous) => anchorClock(previous, serverElapsedMs, at))
    setNow(at)
  }, [running, serverElapsedMs])

  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(timer)
  }, [running])

  return running && anchor !== null ? clockElapsed(anchor, now) : null
}
