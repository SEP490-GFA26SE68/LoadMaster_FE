import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

/**
 * Hai bộ canh khung 3D của trang công khai (khung mở đầu `LandingStageViewer`, trang phương án mẫu `SamplePlanViewer`), đặt trong
 * `SceneCanvas`. `FirstFrame` báo một lần khi khung hình đầu đã vẽ: trang lúc đó mới đổi ảnh tĩnh hay chữ chờ sang khung 3D.
 */
export function FirstFrame({ onFrame }: { onFrame: () => void }) {
  const done = useRef(false)
  useFrame(() => {
    if (done.current) return
    done.current = true
    onFrame()
  })
  return null
}

/** Mất ngữ cảnh WebGL giữa chừng (card đồ hoạ khởi động lại, hết bộ nhớ): báo trang đổi sang hình minh hoạ thay vì để khung đen. */
export function ContextWatch({ onLost }: { onLost: () => void }) {
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => {
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [canvas, onLost])
  return null
}
