import { useMemo } from 'react'
import { CanvasTexture, SRGBColorSpace } from 'three'
import type { SceneMaterials } from './materials'
import type { TruckLayout } from './truck-layout'
import { useDisposeOnChange } from './useDisposeOnChange'
import { VAN_BUMPER_OUT } from './van-details'

/** Biển dài một hàng của xe tải (520 × 110 mm), ảnh 2 px mỗi mm cho chữ còn nét khi phóng gần. */
const PLATE_W = 0.52, PLATE_H = 0.11
const PX_PER_M = 2000
/** Phông có sẵn ở mọi máy: không chờ phông web tải, chữ biển số chỉ có số, chữ hoa, gạch, chấm. */
const PLATE_FONT = 'Arial, Helvetica, sans-serif'

function plateTexture(text: string, m: SceneMaterials) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(PLATE_W * PX_PER_M)
  canvas.height = Math.round(PLATE_H * PX_PER_M)
  const g = canvas.getContext('2d')
  if (!g) return null
  const { width: w, height: h } = canvas
  const border = h * 0.07
  g.fillStyle = m.plateInk; g.fillRect(0, 0, w, h)
  g.fillStyle = m.plate; g.fillRect(border, border, w - border * 2, h - border * 2)
  g.fillStyle = m.plateInk
  g.textAlign = 'center'; g.textBaseline = 'middle'
  let size = h * 0.72
  g.font = `700 ${size}px ${PLATE_FONT}`
  const room = w - border * 6
  const measured = g.measureText(text).width
  if (measured > room) { size *= room / measured; g.font = `700 ${size}px ${PLATE_FONT}` }
  g.fillText(text, w / 2, h / 2 + size * 0.04)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

/**
 * Biển số ở đuôi xe, dưới cửa sau (trên cản sau, giữa hai chân đỡ; van: dán giữa mặt cản sau liền thân): chỉ khi tên xe theo quy ước "Tên · biển số" (`splitVehicleName`),
 * một tấm phẳng, một draw call, chỉ ở `vehicleDetail: 'full'`. Không có biển số thì không vẽ gì.
 */
export function LicensePlate({ plate, layout, length, width, materials }: {
  plate: string; layout: TruckLayout; length: number; width: number; materials: SceneMaterials
}) {
  const texture = useMemo(() => plateTexture(plate, materials), [plate, materials])
  useDisposeOnChange(texture)
  if (!texture) return null
  const y = layout.van ? layout.rearBumperY + 0.02 : Math.min(-PLATE_H / 2 - 0.05, layout.rearBumperY + 0.17)
  const x = layout.van ? length + VAN_BUMPER_OUT + 0.004 : length + 0.2
  return <mesh name="vehicle-plate" position={[x, y, width / 2]} rotation={[0, Math.PI / 2, 0]}>
    <planeGeometry args={[PLATE_W, PLATE_H]} />
    <meshStandardMaterial map={texture} roughness={0.55} metalness={0.05} />
  </mesh>
}
