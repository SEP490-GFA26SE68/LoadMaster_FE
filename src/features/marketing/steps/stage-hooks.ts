import { useCallback, useState, useSyncExternalStore, type RefCallback } from 'react'
import { SCENE_HEIGHT, SCENE_WIDTH } from './scene-kit'

/**
 * Hai việc phụ của khung dính Cách hoạt động (`StepsStage`): biết khung đã tới gần khung nhìn chưa (mới tải trước ảnh Lumo của các bước
 * kế tiếp) và cỡ chữ tối thiểu của cảnh trên máy cảm ứng.
 */

/** Người xem bật tiết kiệm dữ liệu — cùng cách hỏi với `useStageGate`. */
export function savesData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return connection?.saveData === true
}

/** Khung đã vào trong một chiều cao khung nhìn quanh khung nhìn chưa: báo một lần rồi thôi theo dõi. Không có IntersectionObserver: chưa bao giờ. */
export function useNearViewport<T extends Element>(): [RefCallback<T>, boolean] {
  const [near, setNear] = useState(false)
  const ref = useCallback((el: T | null) => {
    if (!el || typeof IntersectionObserver !== 'function') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setNear(true)
        observer.disconnect()
      },
      { rootMargin: '100% 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, near]
}

const COARSE = '(pointer: coarse)'
/** Chữ trên máy cảm ứng hiện ra ít nhất chừng này px (AGENTS mục 10). */
const MIN_TEXT_PX = 16
/**
 * Cỡ chữ lớn nhất (đơn vị SVG) mà hình của các cảnh còn chứa được: chữ cái phương án, nhãn "Đã duyệt", chú giải điểm giao, nhãn cửa sau
 * không đè nhau. Cần lớn hơn thì vùng cảnh quá nhỏ — bỏ hình như khi khung quá thấp (`sections.css`).
 */
export const MAX_SCENE_FONT = 20

function subscribeCoarse(onChange: () => void): () => void {
  if (typeof matchMedia !== 'function') return () => {}
  const list = matchMedia(COARSE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function readCoarse(): boolean {
  return typeof matchMedia === 'function' && matchMedia(COARSE).matches
}

function readFine(): boolean {
  return false
}

/**
 * Cỡ chữ tối thiểu của cảnh (đơn vị SVG, `SceneTextFloor`) cho vùng cảnh gắn vào `ref`: 0 với con trỏ chuột — hình đúng như thiết kế.
 * Máy cảm ứng: đo vùng cảnh (ResizeObserver), hình co giữ tỉ lệ (`preserveAspectRatio` meet) nên tỉ lệ là cạnh bị chặn, và cỡ tối thiểu
 * là 16 px chia tỉ lệ đó. `null` khi cỡ đó vượt `MAX_SCENE_FONT`: vùng cảnh quá nhỏ để vẽ hình.
 */
export function useSceneTextFloor<T extends Element>(): [RefCallback<T>, number | null] {
  const coarse = useSyncExternalStore(subscribeCoarse, readCoarse, readFine)
  const [scale, setScale] = useState(0)
  const ref = useCallback(
    (el: T | null) => {
      if (!el || !coarse || typeof ResizeObserver !== 'function') return undefined
      const observer = new ResizeObserver(([entry]) => {
        const box = entry?.contentRect
        if (box) setScale(Math.min(box.width / SCENE_WIDTH, box.height / SCENE_HEIGHT))
      })
      observer.observe(el)
      return () => observer.disconnect()
    },
    [coarse],
  )
  if (!coarse || scale <= 0) return [ref, 0]
  const floor = Math.ceil(MIN_TEXT_PX / scale)
  return [ref, floor > MAX_SCENE_FONT ? null : floor]
}
