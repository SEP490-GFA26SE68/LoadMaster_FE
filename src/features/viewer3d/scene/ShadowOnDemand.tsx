import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { Scene, WebGLRenderer } from 'three'
import { createShadowTracker } from './shadow-signature'

/** Lượt bóng gần nhất của một renderer: số lần đã vẽ lại, chi phí của lượt đó và khung (`info.render.frame`) đã vẽ nó. */
export type ShadowPass = { passes: number; calls: number; triangles: number; frame: number }

const lastPass = new WeakMap<WebGLRenderer, ShadowPass>()

/** Lượt bóng gần nhất của renderer; `undefined` khi cảnh không có bóng theo yêu cầu (tier không bóng). Chỉ `PerfProbe` đọc. */
export const shadowPassOf = (gl: WebGLRenderer): ShadowPass | undefined => lastPass.get(gl)

/**
 * Shadow map chỉ vẽ lại khi vật đổ bóng đổi (`shadow-signature.ts`). Mặc định three vẽ lại nó **mỗi** khung — xoay camera, rê chuột,
 * khung nét lúc nghỉ đều vẽ thêm một lượt 1.000 kiện vào bản đồ bóng 2048², dù đèn đứng yên và không vật nào đổi chỗ.
 *
 * Tắt `shadowMap.autoUpdate` và hỏi chữ ký trong `scene.onBeforeRender`: renderer gọi nó **sau** `scene.updateMatrixWorld()` và
 * **trước** lượt bóng của cùng lần vẽ, nên khung nào vật đổi chỗ thì bóng vẽ lại ngay trong khung đó — không có khung bóng lệch vật.
 * Không xin khung nào (giữ `frameloop="demand"`). Ghi lại chi phí của lượt bóng gần nhất để số draw call của debug không nhảy giữa
 * khung có và không có lượt bóng (`PerfProbe`). Gỡ (tier không còn bóng, canvas dựng lại) thì trả renderer về mặc định của three.
 */
export function ShadowOnDemand() {
  const get = useThree((state) => state.get)

  // Đọc renderer và cảnh qua `get` trong effect: đây là chỗ duy nhất ghi đè hành vi của chúng, không phải giá trị trả về từ hook
  useEffect(() => {
    const { gl, scene } = get()
    const shadowMap = gl.shadowMap
    const tracker = createShadowTracker()
    const previous = scene.onBeforeRender
    const render = shadowMap.render
    shadowMap.autoUpdate = false
    shadowMap.needsUpdate = true
    scene.onBeforeRender = function (this: Scene, ...args: Parameters<Scene['onBeforeRender']>) {
      previous.apply(this, args)
      if (tracker.changed(scene)) shadowMap.needsUpdate = true
    }
    shadowMap.render = function (...args: Parameters<typeof render>) {
      const redraw = shadowMap.enabled && shadowMap.needsUpdate && args[0].length > 0
      const { calls, triangles, frame } = gl.info.render
      render.apply(this, args)
      if (!redraw) return
      lastPass.set(gl, {
        passes: (lastPass.get(gl)?.passes ?? 0) + 1,
        calls: gl.info.render.calls - calls,
        triangles: gl.info.render.triangles - triangles,
        frame,
      })
    }
    return () => {
      scene.onBeforeRender = previous
      shadowMap.render = render
      shadowMap.autoUpdate = true
      shadowMap.needsUpdate = true
      lastPass.delete(gl)
    }
  }, [get])

  return null
}
