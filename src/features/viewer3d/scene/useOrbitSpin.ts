import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, type RefObject } from 'react'
import type { CameraControls } from '@react-three/drei'
import type { ComponentRef } from 'react'
import { orbitSpinStep } from './orbit-spin'

type Controls = ComponentRef<typeof CameraControls>

/**
 * "Xoay một vòng": khi `active`, mỗi khung hình xoay camera quanh tâm nhìn hiện tại một góc theo thời gian thật (`orbitSpinStep`), giữ
 * góc nghiêng và khoảng cách, rồi gọi `onEnd` khi đủ đúng một vòng. Xoay bằng `rotate` của camera-controls không qua transition — không
 * phát `controlstart`, nên không bị coi là người dùng điều khiển ("Theo bước" không tạm dừng, lấy nét kiện giữ nguyên). Tự `invalidate`
 * trong lúc quay; xong thì thôi, demand loop nghỉ. Góc quay không đi qua state React.
 */
export function useOrbitSpin(controlsRef: RefObject<Controls | null>, active: boolean, onEnd?: () => void) {
  const invalidate = useThree((state) => state.invalidate)
  const rotated = useRef(0)
  const finished = useRef(false)
  const endRef = useRef(onEnd)
  useEffect(() => { endRef.current = onEnd }, [onEnd])

  useEffect(() => {
    rotated.current = 0
    finished.current = false
    if (active) invalidate()
  }, [active, invalidate])

  useFrame((_, delta) => {
    const controls = controlsRef.current
    if (!active || finished.current || !controls) return
    const { step, done } = orbitSpinStep(rotated.current, delta)
    rotated.current += step
    if (step) void controls.rotate(step, 0, false)
    // Lần xoay cuối cũng cần một khung để camera-controls ghi tư thế mới; sau đó không xin thêm
    invalidate()
    if (done) {
      finished.current = true
      endRef.current?.()
    }
  })
}
