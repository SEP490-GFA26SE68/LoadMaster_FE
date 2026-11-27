import { easings, useSpring } from '@react-spring/three'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import type { VehicleConfig } from '@/domain/models'
import { containerSize, type Vec3 } from './units'
import { resizePose, resizeStart, visualBox, VEHICLE_RESIZE_MS, type SceneBox } from './vehicle-resize'

/**
 * Nhóm xe của khung 3D (trừ trang giới thiệu): cả cảnh dời về tâm thùng, thùng (`container`) nằm trong một nhóm riêng. Kích thước lòng
 * thùng đổi thì thùng co / giãn từ cỡ cũ về cỡ mới trong 500 ms giảm tốc (`vehicle-resize.ts`) — ghi thẳng scale và position của hai
 * nhóm qua spring + `invalidate`, không state React theo khung hình, không dựng lại geometry. Cabin, bánh, mặt đất, kiện, vật cản và
 * mọi thứ khác trong `children` vẽ ngay ở cỡ mới (kiện là dữ liệu, không co giãn) và chỉ dời theo tâm thùng. Lần dựng đầu, `animate`
 * tắt (giảm chuyển động, tier không có animation) hoặc đổi quá nhỏ / quá lớn: nhảy thẳng. Xong luôn về đúng scale 1.
 */
export function VehicleFrame({ vehicle, animate, container, children }: {
  vehicle: Pick<VehicleConfig, 'innerLengthCm' | 'innerWidthCm' | 'innerHeightCm'>
  animate: boolean
  container: ReactNode
  children?: ReactNode
}) {
  const invalidate = useThree((state) => state.invalidate)
  const scene = useRef<Group>(null)
  const box = useRef<Group>(null)
  /** Thùng đang hiện trên màn (đã tính chuyển động dở) — lần đổi kế tiếp bắt đầu từ đây */
  const shown = useRef<SceneBox | null>(null)
  /** Lần đổi cỡ đang chạy: lời gọi lại của spring cũ (bị dừng giữa chừng) không ghi đè tư thế của lần mới */
  const generation = useRef(0)
  const [, api] = useSpring(() => ({ t: 1 }))
  const { length, height, width } = containerSize(vehicle)

  useLayoutEffect(() => {
    const to: SceneBox = { length, height, width }
    function apply(start: Vec3, t: number) {
      const pose = resizePose(start, to, t)
      box.current?.scale.set(...pose.scale)
      scene.current?.position.set(...pose.offset)
      shown.current = visualBox(to, pose.scale)
      invalidate()
    }
    const start = animate ? resizeStart(shown.current, to) : null
    const run = ++generation.current
    api.stop()
    if (!start) { apply([1, 1, 1], 1); return }
    apply(start, 0)
    api.set({ t: 0 })
    void api.start({
      t: 1, config: { duration: VEHICLE_RESIZE_MS, easing: easings.easeOutCubic },
      onChange: (result) => { if (run === generation.current) apply(start, Math.min(1, Number(result.value.t))) },
      onRest: () => { if (run === generation.current) apply(start, 1) },
    })
  }, [length, height, width, animate, api, invalidate])

  return <group ref={scene} name="vehicle-frame">
    <group ref={box} name="vehicle-box">{container}</group>
    {children}
  </group>
}
