import { CameraControls } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { PerspectiveCamera, Vector3 } from 'three'
import { useEffect, useRef, type ComponentRef } from 'react'
import type { CameraPreset } from '@/features/viewer3d/viewer-types'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import type { VehicleConfig } from '@/domain/models'
import { fitFrame, insetFrame, NO_INSETS, VEHICLE_FIT_MARGIN, vehicleFitCorners, type FramePoints } from './frame-fit'
import { boxCenter, containerCenter, SCENE_SCALE, type Vec3 } from './units'
import { specFramePoints } from './vehicle-spec-marks'

/**
 * Điều khiển camera bằng camera-controls (qua drei). Gốc thế giới là tâm
 * thùng nên mọi preset đều nhìn về (0,0,0). Chuyển góc 500ms giảm tốc
 * (mục 8); bật "giảm chuyển động" thì nhảy thẳng.
 *
 * Lệnh camera không transition không phát sự kiện nào của camera-controls, nên
 * `frameloop="demand"` không tự vẽ lại: sau mỗi lệnh đổi camera phải gọi
 * `invalidate()` (LM-056). Có transition thì lời gọi này gộp vào cùng frame.
 */

const PRESET_POSITIONS: Record<CameraPreset, Vec3> = {
  'goc-cheo': [8.5, 5.2, 7],
  // Đủ cao để nhìn qua nóc cabin vào trong thùng.
  truoc: [-7.5, 6.5, 0.001],
  'cua-sau': [10.5, 2.5, 0.001],
  'ben-hong': [0.001, 3, 9.5],
  tren: [0.001, 11, 0.01],
  // Từ dưới đất nhìn chếch lên khung gầm, trục và bánh (camera nằm dưới mặt đất, mặt đất chỉ nhận bóng một phía).
  'gam-xe': [5.5, -4.2, 7],
}

/** Xem trước ở form xe: góc "Trên" nhìn thẳng xuống, trục dọc xe nằm ngang màn hình. */
const SPEC_PRESET_POSITIONS: Partial<Record<CameraPreset, Vec3>> = { tren: [0, 11, 0.001] }

/** Khoảng hạ tâm nhìn so với tâm thùng, tính từ sàn thùng (m): góc gầm xe nhìn vào khung sườn, không vào giữa thùng. */
const PRESET_TARGET_BELOW_FLOOR: Partial<Record<CameraPreset, number>> = { 'gam-xe': 0.5 }

/** Cho phép xoay xuống dưới gầm; chừa một chút để không lật qua cực dưới. */
const MAX_POLAR_ANGLE = Math.PI - 0.12

/** Lề quanh các điểm của `specFramePoints`: chỗ cho nhãn DOM neo ở mép hình. */
const SPEC_FRAME_MARGIN = 1.08

/** smoothTime của SmoothDamp ≈ 60% thời gian tới đích → ~500ms */
const SMOOTH_TIME = 0.3

export function CameraRig({
  preset,
  reducedMotion,
  focus,
  vehicle,
  fit = false,
  fitRequest = 0,
  specFrame = false,
  vehicleDecoration = false,
  zoom = 1,
  framePoints,
  jumpFirst = false,
  onUserControl,
}: {
  preset: CameraPreset
  reducedMotion: boolean
  focus?: { placement: ScenePlacement; request: number; follow?: boolean } | null
  vehicle?: VehicleConfig
  fit?: boolean
  /** Tăng lên để canh lại khung dù preset và xe không đổi (bấm lại góc đang chọn sau khi tự xoay). */
  fitRequest?: number
  /** Xem trước ở form xe: canh khung theo đúng những điểm hình vẽ chạm tới (`specFramePoints`) thay cho hộp bao rộng rãi. */
  specFrame?: boolean
  vehicleDecoration?: boolean
  /** Lớn hơn 1: camera đứng gần hơn khung vừa khít (trang giới thiệu: khung hình không có HUD nên không cần chừa lề rộng). */
  zoom?: number
  /** Canh theo một tập điểm của cảnh (hệ góc thùng) trong khung đã trừ lề, thay cho hộp bao của xe — góc Toàn cảnh trang giới thiệu. */
  framePoints?: FramePoints
  /** Lần canh đầu tiên đặt thẳng camera, không bay từ vị trí khởi tạo của canvas (trang giới thiệu hiện khung qua hình poster). */
  jumpFirst?: boolean
  onUserControl?: () => void
}) {
  const controlsRef = useRef<ComponentRef<typeof CameraControls>>(null)
  const applied = useRef<{ preset: CameraPreset; vehicle?: VehicleConfig; request: number; points?: FramePoints } | null>(null)
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)
  const invalidate = useThree((state) => state.invalidate)
  const beforeFocus = useRef<{ position: Vector3; target: Vector3 } | null>(null)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !size.width || !size.height) return
    // Responsive panels can resize the Canvas mid-orbit. Keep the user's pose;
    // only an explicit preset, a new vehicle, new frame points or `fitRequest` requests a fresh framing.
    const previous = applied.current
    if (previous?.preset === preset && previous.vehicle === vehicle && previous.request === fitRequest && previous.points === framePoints) return
    applied.current = { preset, vehicle, request: fitRequest, points: framePoints }
    beforeFocus.current = null
    const transition = !reducedMotion && !(jumpFirst && !previous)
    let [x, y, z] = (specFrame ? SPEC_PRESET_POSITIONS[preset] : undefined) ?? PRESET_POSITIONS[preset]
    if (framePoints && vehicle && camera instanceof PerspectiveCamera) {
      const center = containerCenter(vehicle)
      const points = framePoints.points.map((p): Vec3 => [p[0] - center[0], p[1] - center[1], p[2] - center[2]])
      const { position, target } = insetFrame(points, [x, y, z], {
        fovDeg: camera.fov, width: size.width, height: size.height, insets: framePoints.insets ?? NO_INSETS,
      })
      void controls.setLookAt(...position, ...target, transition)
      invalidate()
      return
    }
    if (fit && specFrame && vehicle && camera instanceof PerspectiveCamera) {
      const center = containerCenter(vehicle)
      const tanHalfV = Math.tan(camera.fov * Math.PI / 360)
      const points = specFramePoints(vehicle).map((p): Vec3 => [p[0] - center[0], p[1] - center[1], p[2] - center[2]])
      const { distance, target } = fitFrame(points, [x, y, z], {
        tanHalfH: tanHalfV * size.width / Math.max(1, size.height), tanHalfV, margin: SPEC_FRAME_MARGIN, minDistance: 3,
      })
      const scale = distance / Math.hypot(x, y, z)
      void controls.setLookAt(target[0] + x * scale, target[1] + y * scale, target[2] + z * scale, ...target, transition)
      invalidate()
      return
    }
    if (fit && vehicle && camera instanceof PerspectiveCamera) {
      const center = containerCenter(vehicle)
      const vfov = camera.fov * Math.PI / 180
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * size.width / Math.max(1, size.height))
      const direction = new Vector3(x, y, z).normalize()
      const right = new Vector3().crossVectors(new Vector3(0, 1, 0), direction).normalize()
      const up = new Vector3().crossVectors(direction, right).normalize()
      // Fit projected corners at the existing angle, not a length-dominated sphere.
      // This keeps a rear-door view readable on phones without fitToBox rotating it.
      let distance = 3
      const point = new Vector3()
      for (const [px, py, pz] of vehicleFitCorners(center, vehicleDecoration)) {
        const depth = point.set(px - center[0], py - center[1], pz - center[2]).dot(direction)
        distance = Math.max(distance, depth + Math.abs(point.dot(right)) * VEHICLE_FIT_MARGIN / Math.tan(hfov / 2),
          depth + Math.abs(point.dot(up)) * VEHICLE_FIT_MARGIN / Math.tan(vfov / 2))
      }
      const scale = distance / zoom / Math.hypot(x, y, z)
      x *= scale; y *= scale; z *= scale
    }
    const below = PRESET_TARGET_BELOW_FLOOR[preset]
    const targetY = below !== undefined && vehicle ? -containerCenter(vehicle)[1] - below : 0
    void controls.setLookAt(x, y + targetY, z, 0, targetY, 0, transition)
    invalidate()
  }, [preset, reducedMotion, vehicle, fit, fitRequest, specFrame, vehicleDecoration, zoom, framePoints, jumpFirst, size.width, size.height, camera, invalidate])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || !vehicle) return
    if (!focus) {
      const saved = beforeFocus.current
      beforeFocus.current = null
      if (saved) {
        void controls.setLookAt(saved.position.x, saved.position.y, saved.position.z, saved.target.x, saved.target.y, saved.target.z, !reducedMotion)
        invalidate()
      }
      return
    }
    const center = containerCenter(vehicle)
    const target = boxCenter(focus.placement).map((value, i) => value - center[i]!) as Vec3
    if (!beforeFocus.current) beforeFocus.current = { position: controls.getPosition(new Vector3()), target: controls.getTarget(new Vector3()) }
    // Keep orientation, with a contextual dolly rather than fitToBox's automatic rotation.
    void controls.moveTo(...target, !reducedMotion)
    const diagonal = Math.hypot(focus.placement.lengthCm, focus.placement.widthCm, focus.placement.heightCm) * SCENE_SCALE
    void controls.dollyTo(focus.follow ? Math.max(6, diagonal * 3) : Math.max(3, Math.min(6, diagonal * 3)), !reducedMotion)
    invalidate()
  }, [focus, vehicle, reducedMotion, invalidate])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const controls = controlsRef.current, saved = beforeFocus.current
      if (event.key !== 'Escape' || !controls?.enabled || !saved || (event.target instanceof Element && event.target.closest('[role="dialog"]'))) return
      beforeFocus.current = null
      onUserControl?.()
      void controls.setLookAt(saved.position.x, saved.position.y, saved.position.z, saved.target.x, saved.target.y, saved.target.z, !reducedMotion)
      invalidate()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onUserControl, reducedMotion, invalidate])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      onControlStart={onUserControl}
      smoothTime={reducedMotion ? 0.05 : SMOOTH_TIME}
      minDistance={3}
      maxDistance={80}
      minPolarAngle={0.02}
      maxPolarAngle={MAX_POLAR_ANGLE}
      dollySpeed={0.6}
    />
  )
}
