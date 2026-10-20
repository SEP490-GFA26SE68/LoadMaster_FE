import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefCallback,
} from 'react'
import { createRevealRegistry, RevealRuntimeContext, type RevealRuntime } from './reveal-runtime'
import './reveal.css'

const REDUCE = '(prefers-reduced-motion: reduce)'
const OFF: RevealRuntime = { motion: false, registry: null }

/** Chuyển động chỉ bật khi có IntersectionObserver, có `matchMedia` và người xem không xin giảm chuyển động (jsdom: tắt). */
function canMove(): boolean {
  return typeof IntersectionObserver === 'function' && typeof matchMedia === 'function' && !matchMedia(REDUCE).matches
}

function subscribeReduce(onChange: () => void): () => void {
  const list = matchMedia(REDUCE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function readReduce(): boolean {
  return matchMedia(REDUCE).matches
}

function subscribeNothing(): () => void {
  return () => {}
}

function readFalse(): boolean {
  return false
}

/**
 * Bọc nội dung trang giới thiệu (`LandingPage`). Chuyển động tính một lần lúc vẽ đầu: tắt (jsdom, giảm chuyển động) thì không thêm phần
 * tử nào — DOM đúng như trước. Bật thì thêm gốc `<div data-reveal-root data-motion="on" class="contents">` (không đổi bố cục), một
 * IntersectionObserver và hai lưới an toàn: phần tử nhận focus và lúc in trang hiện ngay trạng thái cuối. Người xem đổi sang giảm chuyển
 * động giữa chừng thì `data-motion` mất, mọi thứ về trạng thái cuối và không bật lại trong lần mở trang này.
 */
export function RevealProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(canMove)
  const reduce = useSyncExternalStore(initial ? subscribeReduce : subscribeNothing, initial ? readReduce : readFalse, readFalse)
  const [stopped, setStopped] = useState(false)
  if (initial && reduce && !stopped) setStopped(true)
  const motion = initial && !reduce && !stopped
  const [registry] = useState(createRevealRegistry)
  const runtime = useMemo<RevealRuntime>(() => ({ motion, registry }), [motion, registry])

  useEffect(() => {
    if (!motion) return
    registry.connect()
    const handlePrint = () => registry.revealAll()
    window.addEventListener('beforeprint', handlePrint)
    return () => {
      window.removeEventListener('beforeprint', handlePrint)
      registry.disconnect()
    }
  }, [motion, registry])

  if (!initial) return <RevealRuntimeContext value={OFF}>{children}</RevealRuntimeContext>
  const { attachRoot, revealAround } = registry
  return (
    <RevealRuntimeContext value={runtime}>
      <div
        ref={attachRoot}
        data-reveal-root=""
        data-motion={motion ? 'on' : undefined}
        className="contents"
        onFocus={motion ? (event) => revealAround(event.target) : undefined}
      >
        {children}
      </div>
    </RevealRuntimeContext>
  )
}

/** Chuyển động của trang giới thiệu có đang bật không. Ngoài `RevealProvider` (vd. `/bang-gia`), jsdom và giảm chuyển động: `false`. */
export function useRevealMotion(): boolean {
  return useContext(RevealRuntimeContext).motion
}

/**
 * Ref callback đăng ký một phần tử bất kỳ (kể cả phần tử SVG) với observer chung: khi lộ đủ, phần tử nhận `data-shown` một lần rồi thôi
 * theo dõi; `onShow(instant)` được gọi đúng lúc đó (`instant` khi mở bằng focus hay lúc in). `trigger: 'mount'` mở ngay lúc gắn. Phần tử
 * nhận `data-reveal-gate`: mọi mảnh bên trong đọc `--reveal-play` (`paused` tới khi cổng mở) — CSS riêng của nơi gọi viết
 * `[data-motion='on'] .x { animation: … both; animation-play-state: var(--reveal-play, running); }` và thêm lớp `reveal-piece` để lưới
 * an toàn (focus, in) cho nhảy tới trạng thái cuối; khung hình cuối phải trùng style của chính phần tử (bỏ `to`). Chuyển động tắt: ref
 * không làm gì, `onShow` không bao giờ được gọi.
 */
export function useRevealRef<T extends Element = HTMLElement>(
  onShow?: (instant: boolean) => void,
  trigger: 'view' | 'mount' = 'view',
): RefCallback<T> {
  const { motion, registry } = useContext(RevealRuntimeContext)
  const listener = useRef(onShow)
  useLayoutEffect(() => {
    listener.current = onShow
  })
  return useCallback(
    (el: T | null) => {
      if (!el || !motion || !registry) return
      if (trigger === 'mount') return registry.open(el, listener)
      return registry.observe(el, listener)
    },
    [motion, registry, trigger],
  )
}
