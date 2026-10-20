import { useEffect, useState } from 'react'

/** jsdom và trình duyệt tắt WebGL không có lớp này: khung 3D nhường chỗ cho hình minh hoạ SVG ngay từ lần vẽ đầu. */
const HAS_WEBGL = typeof WebGLRenderingContext !== 'undefined'

/** Chờ trình duyệt rảnh tối đa chừng này rồi mới tải phần 3D, để chữ và nút của phần mở đầu vẽ trước. */
const IDLE_TIMEOUT_MS = 1200
/** Khung còn cách khung nhìn chừng này (trên hay dưới) thì coi là sắp tới: bắt đầu tải để khung kịp vẽ khi cuộn tới. */
const NEAR_MARGIN = '250px 0px'

export type StageGate = 'off' | 'wait' | 'go'

function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}

/**
 * Có lớp WebGL chưa chắc tạo được ngữ cảnh (card đồ hoạ bị chặn, hết ngữ cảnh, tiến trình GPU vừa hỏng): thử tạo một ngữ cảnh nhỏ rồi
 * trả lại ngay. Lỗi tạo ngữ cảnh của khung 3D không đi qua ranh giới lỗi của React, nên phải hỏi trước khi tải.
 */
function canCreateContext(): boolean {
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!gl) return false
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}

/** `target` đã tới gần khung nhìn chưa (một IntersectionObserver, ngắt ngay khi tới). Không có IntersectionObserver thì coi như đã tới. */
function useNear(target: Element | null, enabled: boolean): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver !== 'function')
  useEffect(() => {
    if (!enabled || near || !target) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return
      setNear(true)
      observer.disconnect()
    }, { rootMargin: NEAR_MARGIN })
    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, near, target])
  return near
}

/**
 * Cổng của khung 3D trên trang giới thiệu: `off` — không có WebGL, không tạo được ngữ cảnh, hoặc người xem bật tiết kiệm dữ liệu (không
 * tải Three.js, không chạy bộ tối ưu); `wait` — chờ khung `target` tới gần khung nhìn (cách 250 px) rồi chờ trình duyệt rảnh; `go` — tải
 * phần 3D và chạy chuyến mẫu. Không bao giờ chặn lần vẽ đầu: phép thử ngữ cảnh chạy lúc trình duyệt rảnh, và trang mở ở xa khung (điện
 * thoại, mở thẳng một neo bên dưới) thì không tải gì cho tới khi cuộn gần tới.
 */
export function useStageGate(target: Element | null): StageGate {
  const [blocked] = useState(() => !HAS_WEBGL || savesData())
  const [opened, setOpened] = useState<'off' | 'go' | null>(null)
  const near = useNear(target, !blocked)
  useEffect(() => {
    if (blocked || !near || opened) return
    const open = () => setOpened(canCreateContext() ? 'go' : 'off')
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(open, { timeout: IDLE_TIMEOUT_MS })
      return () => window.cancelIdleCallback(id)
    }
    const timer = window.setTimeout(open, 300)
    return () => window.clearTimeout(timer)
  }, [blocked, near, opened])
  return blocked ? 'off' : opened ?? 'wait'
}
