import { useEffect, useRef, useState } from 'react'
import type { LumoPose } from '@/components/brand/Lumo'

/** Ảnh đang hiện, ảnh mới đang chờ giải mã (chồng lên, trong suốt) và lúc hai ảnh mờ chéo. */
export type LumoSwap = { current: LumoPose; next: LumoPose | null; fading: boolean }

/** Mờ chéo kéo dài `--dur-pose` (220 ms); quá mốc này mà chưa nhận `animationend` (ảnh bị ẩn, tab ẩn) thì đổi hẳn. */
const FADE_FALLBACK_MS = 600

/**
 * Đổi tư thế của Lumo: ảnh mới chồng lên ảnh cũ và chỉ bắt đầu mờ chéo khi `img.decode()` xong, nên không bao giờ nháy khung trống.
 * `animate` tắt (chuyển động tắt, chưa lộ) thì đổi ngay. Nơi gọi gắn `nextRef` vào lớp ảnh mới và gọi `finish` khi lớp đó mờ xong.
 */
export function useLumoSwap(pose: LumoPose, animate: boolean) {
  const [swap, setSwap] = useState<LumoSwap>({ current: pose, next: null, fading: false })
  if (pose !== (swap.next ?? swap.current)) {
    setSwap(animate && pose !== swap.current ? { current: swap.current, next: pose, fading: false } : { current: pose, next: null, fading: false })
  }
  const nextRef = useRef<HTMLSpanElement>(null)
  const next = swap.next

  useEffect(() => {
    if (!next || swap.fading) return
    let live = true
    const start = () => {
      if (live) setSwap((now) => (now.next === next ? { ...now, fading: true } : now))
    }
    const img = nextRef.current?.querySelector('img')
    if (img && typeof img.decode === 'function') img.decode().then(start, start)
    else start()
    return () => {
      live = false
    }
  }, [next, swap.fading])

  useEffect(() => {
    if (!next || !swap.fading) return
    const timer = window.setTimeout(() => setSwap((now) => (now.next === next ? { current: next, next: null, fading: false } : now)), FADE_FALLBACK_MS)
    return () => window.clearTimeout(timer)
  }, [next, swap.fading])

  const finish = () => setSwap((now) => (now.next ? { current: now.next, next: null, fading: false } : now))
  return { swap, nextRef, finish }
}
