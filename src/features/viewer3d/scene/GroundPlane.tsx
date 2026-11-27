import { useMemo } from 'react'
import { CanvasTexture, Color, SRGBColorSpace } from 'three'
import { readToken } from '@/lib/tokens'
import { groundLayout, type GroundFootprint } from './ground-plane'
import { useDisposeOnChange } from './useDisposeOnChange'

const NO_RAYCAST = () => null
/** Số lớp chồng của mép bóng mềm; mỗi lớp một hình chữ nhật bo góc, không cần `ctx.filter` (Safari không có). */
const SHADOW_LAYERS = 12
/** Độ đậm giữa vùng mặt đất và giữa bóng tiếp xúc; tier có bóng thật thì bóng tiếp xúc nhạt hơn để hai lớp không bẩn. */
const GROUND_ALPHA = 0.55
const CONTACT_ALPHA = { full: 0.62, soft: 0.34 } as const

function rgba(color: Color, alpha: number) {
  const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace)
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
}

function drawGround(footprint: GroundFootprint, contact: keyof typeof CONTACT_ALPHA) {
  const { texture, shadow } = groundLayout(footprint)
  const canvas = document.createElement('canvas')
  canvas.width = texture.width; canvas.height = texture.height
  const context = canvas.getContext('2d')
  // Vẽ lên canvas bằng sRGB (texture khai SRGBColorSpace): `rgba` đổi màu tuyến tính của three về sRGB
  const ground = new Color(readToken('--border-dark'))
  const dark = new Color(readToken('--canvas-2')).multiplyScalar(0.25)
  if (context) {
    context.save()
    context.translate(texture.width / 2, texture.height / 2); context.scale(texture.width / 2, texture.height / 2)
    const fade = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    fade.addColorStop(0, rgba(ground, GROUND_ALPHA)); fade.addColorStop(0.45, rgba(ground, GROUND_ALPHA * 0.7)); fade.addColorStop(1, rgba(ground, 0))
    context.fillStyle = fade; context.fillRect(-1, -1, 2, 2)
    context.restore()
    // Bóng tiếp xúc: các lớp từ ngoài vào trong, tổng độ đậm ở giữa đúng bằng CONTACT_ALPHA
    const layerAlpha = 1 - (1 - CONTACT_ALPHA[contact]) ** (1 / SHADOW_LAYERS)
    context.fillStyle = rgba(dark, layerAlpha)
    for (let i = 0; i < SHADOW_LAYERS; i++) {
      const grow = shadow.soft * (1 - (2 * i) / (SHADOW_LAYERS - 1))
      const w = shadow.width + grow * 2, h = shadow.height + grow * 2
      if (w <= 0 || h <= 0) continue
      context.beginPath()
      context.roundRect(shadow.x - grow, shadow.y - grow, w, h, Math.max(0, Math.min(shadow.soft, w / 2, h / 2)))
      context.fill()
    }
  }
  const map = new CanvasTexture(canvas)
  map.colorSpace = SRGBColorSpace
  return map
}

/**
 * Mặt đất tối rất nhẹ mờ dần ra rìa, kèm bóng tiếp xúc mềm theo hộp bao xe — **một** mặt phẳng, một texture sinh một lần, một draw
 * call, không shadow map; có ở mọi tier để xe không lơ lửng. Mặt đơn hướng lên: góc "Gầm xe" nhìn từ dưới không bị nó che.
 * `contact="soft"` khi tier có bóng thật (bóng tiếp xúc nhạt lại). Nơi gọi lấy `footprint` từ `groundFootprintOf`.
 */
export function GroundPlane({ footprint, contact = 'full' }: { footprint: GroundFootprint; contact?: keyof typeof CONTACT_ALPHA }) {
  const { groundY, x0, x1, halfWidth, centerZ } = footprint
  const layout = useMemo(() => groundLayout({ groundY, x0, x1, halfWidth, centerZ }), [groundY, x0, x1, halfWidth, centerZ])
  const map = useMemo(() => drawGround({ groundY, x0, x1, halfWidth, centerZ }, contact), [groundY, x0, x1, halfWidth, centerZ, contact])
  useDisposeOnChange(map)
  return <mesh name="ground" rotation={[-Math.PI / 2, 0, 0]} position={[...layout.center]} renderOrder={-1} raycast={NO_RAYCAST}>
    <planeGeometry args={[...layout.size]} />
    <meshBasicMaterial map={map} transparent depthWrite={false} toneMapped={false} />
  </mesh>
}
