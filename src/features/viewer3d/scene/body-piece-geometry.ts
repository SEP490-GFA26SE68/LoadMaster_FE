import { BoxGeometry, Color, CylinderGeometry, type BufferGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { BodyPiece, BodyTone } from './body-pieces'
import type { SceneMaterials } from './materials'
import { tintGeometry } from './tint-geometry'

/** Màu của từng tông mảnh thân xe, lấy từ vật liệu của scene (token). `beam`: giữa vách và gờ, như đà nóc của thùng kín. */
export function bodyToneColors(m: SceneMaterials): Record<BodyTone, string> {
  return {
    skirt: m.skirt,
    beam: `#${new Color(m.wall).lerp(new Color(m.skirt), 0.85).getHexString()}`,
    metal: m.metal,
    chassis: m.chassis,
    marker: m.marker,
    tailLight: m.tailLight,
    tarp: m.tarp,
    insulated: m.insulated,
    light: m.light,
  }
}

/** Gộp mọi mảnh (hộp, thanh tròn `segments` cạnh) vào **một** hình học màu theo đỉnh. */
export function piecesGeometry(pieces: readonly BodyPiece[], colors: Record<BodyTone, string>, segments: number): BufferGeometry {
  const parts = pieces.map((piece) => {
    if (piece.kind === 'box') {
      const { min, max } = piece
      return tintGeometry(new BoxGeometry(max[0] - min[0], max[1] - min[1], max[2] - min[2])
        .translate((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2), colors[piece.tone])
    }
    const rod = new CylinderGeometry(piece.radius, piece.radius, piece.span, segments)
    if (piece.axis === 'x') rod.rotateZ(Math.PI / 2)
    if (piece.axis === 'z') rod.rotateX(Math.PI / 2)
    return tintGeometry(rod.translate(...piece.center), colors[piece.tone])
  })
  const geometry = mergeGeometries(parts)!
  parts.forEach((part) => part.dispose())
  return geometry
}
