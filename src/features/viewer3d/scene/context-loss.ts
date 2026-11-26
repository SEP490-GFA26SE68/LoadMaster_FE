import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'

/**
 * Mất ngữ cảnh WebGL giữa chừng (card đồ hoạ khởi động lại, trình duyệt thu hồi bộ nhớ khi có nhiều tab 3D): khung hình đứng trắng / đen
 * mà không báo gì. `preventDefault` cho trình duyệt biết trang muốn khôi phục ngữ cảnh (three cũng gọi, gọi lại vô hại). Trả hàm gỡ.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, { onLost, onRestored }: { onLost: () => void; onRestored: () => void }): () => void {
  const handleLost = (event: Event) => {
    event.preventDefault()
    onLost()
  }
  canvas.addEventListener('webglcontextlost', handleLost)
  canvas.addEventListener('webglcontextrestored', onRestored)
  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost)
    canvas.removeEventListener('webglcontextrestored', onRestored)
  }
}

/** Đặt trong `<Canvas>`: nghe ngữ cảnh của chính canvas đang vẽ. */
export function ContextLossWatch({ onLost, onRestored }: { onLost: () => void; onRestored: () => void }) {
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => watchContextLoss(canvas, { onLost, onRestored }), [canvas, onLost, onRestored])
  return null
}
