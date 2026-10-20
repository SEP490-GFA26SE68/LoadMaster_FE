import { useMemo } from 'react'
import {
  CAB_PROFILE, DIORAMA, DIORAMA_COLORS, DIORAMA_FRAME_POINTS, DIORAMA_LIFT, laneBounds, STAGE_CAMERA, type Footprint, type Range, type StageView,
} from '@/features/viewer3d/landing/diorama-layout'
import { VEHICLE_FIT_MARGIN, vehicleFitCorners, type Insets } from '@/features/viewer3d/scene/frame-fit'
import { CAB_X, truckLayout, WHEEL_RADIUS, WHEEL_Y } from '@/features/viewer3d/scene/truck-layout'
import { containerSize } from '@/features/viewer3d/scene/units'
import { alongPoint, projectAlong } from '@/lib/isometric'
import { stopColor } from '@/lib/stops'
import { readToken } from '@/lib/tokens'
import { cn } from '@/lib/utils'
import { LANDING_REQUEST } from './landing-sample.mock'

type P3 = readonly [number, number, number]
type Paint = readonly [color: string, factor: number] // token (hoặc mã hex) và hệ số nhân tuyến tính, như `sceneMaterials` và `DIORAMA_LIFT`
type Mark = { lines: readonly (readonly P3[])[]; fill?: string; dashed?: boolean } // đa giác tô màu, hoặc nét trắng mờ khi không có `fill`

/** Hướng nhìn của góc `goc-cheo` (`CameraRig`, từ tâm nhìn tới camera); 40 đơn vị viewBox mỗi mét. */
const VIEW: P3 = [8.5, 5.2, 7], UP: P3 = [0, 1, 0], SCALE = 40
const { vehicle } = LANDING_REQUEST, { length: L, width: W, height: H } = containerSize(vehicle), CENTRE: P3 = [L / 2, H / 2, W / 2]
/** Vật liệu xe của `sceneMaterials` (nó dựng màu bằng Three.js nên không import vào đây); cabin, kính có độ kim loại nên bớt khuếch tán. */
const M = { floor: ['--border-dark', 1.55], wall: ['--border-dark', 1.25], skirt: ['--border-dark', 1.9], cab: ['--bg', 0.62 * 0.82], chassis: ['--panel-dark', 0.9],
  wheel: ['--canvas-2', 1.1], metal: ['--text-disabled', 0.8], glass: ['--info', 0.24 * 0.7], marker: ['--warning', 0.7] } as const satisfies Record<string, Paint>
const paint = (key: keyof typeof DIORAMA_COLORS): Paint => [DIORAMA_COLORS[key], DIORAMA_LIFT[key] ?? 1]
const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: P3, b: P3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: P3, b: P3): P3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const unit = (a: P3): P3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l] }
/** Ánh sáng của `SceneLighting` (không tone mapping): bán cầu trời trắng 0,95 và ba đèn hướng [hướng tới đèn, cường độ]. */
const LIGHTS = ([[[3, 12, 4], 1.9], [[-5, 5, -6], 0.45], [[2, -10, 3], 0.55]] as const).map(([d, i]) => [unit(d), i] as const)
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const srgb = (c: number) => Math.round(255 * Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055))

/** Màu một mặt như vật liệu Standard nhám của khung 3D: khuếch tán Lambert cộng chút phản xạ, tính tuyến tính rồi ra sRGB. jsdom: giữ token. */
function lit([color, factor]: Paint, n: P3): string {
  const hex = color.startsWith('--') ? readToken(color as `--${string}`) : color
  if (!/^#[\da-f]{6}$/i.test(hex)) return color.startsWith('--') ? `var(${color})` : color
  const light = (0.95 * (0.5 + 0.5 * n[1]) + LIGHTS.reduce((sum, [d, i]) => sum + i * Math.max(0, dot(n, d)), 0)) / Math.PI, spec = 0.004 + 0.008 * Math.max(0, n[1])
  return `#${[1, 3, 5].map((i) => srgb(linear(Number.parseInt(hex.slice(i, i + 2), 16) / 255) * factor * light + spec).toString(16).padStart(2, '0')).join('')}`
}

/** Các mặt theo thứ tự vẽ từ xa tới gần (SVG không có bộ đệm độ sâu), cùng số đo với `diorama-geometry` và xe của khung 3D. */
function posterScene(): Mark[] {
  const marks: Mark[] = []
  const face = (points: readonly P3[], toward: P3, color: Paint) => { // đa giác lồi quay về `toward`; quay lưng lại camera thì bỏ
    const raw = unit(cross(sub(points[1]!, points[0]!), sub(points[2]!, points[0]!))), normal: P3 = dot(raw, toward) < 0 ? [-raw[0], -raw[1], -raw[2]] : raw
    if (dot(normal, VIEW) > 0) marks.push({ lines: [points], fill: lit(color, normal) })
  }
  const rect = (x: Range, z: Range): Footprint => [[x[0], z[0]], [x[1], z[0]], [x[1], z[1]], [x[0], z[1]]], at = (f: Footprint, y: number) => f.map(([x, z]): P3 => [x, y, z])
  const prism = (f: Footprint, [bottom, top]: Range, side: Paint, cap: Paint | null, inward = false) => { // mặt bên quay ra (vào trong: `inward`), rồi mặt trên
    const cx = f.reduce((s, [x]) => s + x, 0) / f.length, cz = f.reduce((s, [, z]) => s + z, 0) / f.length, out = inward ? -1 : 1
    f.map((p, i) => [p, f[(i + 1) % f.length]!] as const).forEach(([[x, z], [nx, nz]]) =>
      face([[x, bottom, z], [nx, bottom, nz], [nx, top, nz], [x, top, z]], [out * ((x + nx) / 2 - cx), 0, out * ((z + nz) / 2 - cz)], side))
    if (cap) face(at(f, top), UP, cap)
  }
  const box = (x: Range, y: Range, z: Range, c: Paint) => prism(rect(x, z), y, c, c), flat = (x: Range, z: Range, y: number, c: Paint) => face(at(rect(x, z), y), UP, c)
  const front = (x: Range, y: Range, z: number, c: Paint) => face([[x[0], y[0], z], [x[1], y[0], z], [x[1], y[1], z], [x[0], y[1], z]], [0, 0, 1], c)
  const ring = (n: number, a0: number, put: (c: number, s: number) => P3) => // n + 1 điểm trên đường tròn đơn vị, lệch `a0` rad
    Array.from({ length: n + 1 }, (_, k) => a0 + 2 * Math.PI * k / n).map((a) => put(Math.cos(a), Math.sin(a)))
  const { slab, road, dock, leveller, warehouse: w } = DIORAMA
  prism(slab.footprint, [slab.bottom, slab.top], paint('slabSide'), paint('slabTop'))
  flat(road.x, road.z, road.top, paint('road'))
  for (const z of [road.z[0] + 0.14, road.z[1] - 0.14 - road.line]) flat([road.x[0] + 0.1, road.x[1]], [z, z + road.line], road.top, paint('roadLine'))
  for (const { x, z, height: h } of DIORAMA.trees) {
    const r = Math.min(0.45, 0.25 * h + 0.1), base = ring(7, 0.3, (c, s) => [x + r * c, slab.top + 0.24 * h, z + r * s])
    box([x - 0.06, x + 0.06], [slab.top, slab.top + 0.32 * h], [z - 0.06, z + 0.06], paint('trunk'))
    base.slice(1).forEach((q, k) => face([base[k]!, [x, slab.top + h, z], q], [(base[k]![0] + q[0]) / 2 - x, 0.3, (base[k]![2] + q[2]) / 2 - z], paint('canopy')))
  }
  // Nhà kho: mái lõm, mặt trong rồi mặt ngoài tường chắn mái (che phần mái gần), mép trên tường chắn, dải màu, cửa dock
  const rim = w.top + w.parapet, t = w.parapetWidth, outer = rect(w.x, w.z), inner = rect([w.x[0] + t, w.x[1] - t], [w.z[0] + t, w.z[1] - t])
  face(at(inner, w.top), UP, paint('roof'))
  prism(inner, [w.top, rim], paint('wall'), null, true)
  prism(outer, [slab.top, rim], paint('wall'), null)
  at(outer, rim).forEach((p, k, lip) => face([p, lip[(k + 1) % 4]!, at(inner, rim)[(k + 1) % 4]!, at(inner, rim)[k]!], UP, paint('wall')))
  prism(outer, w.band, paint('band'), null)
  for (const door of w.doors) front(door, [dock.top, w.doorTop], w.z[1], paint('door'))
  // Xe như `TruckCab` và `Container` lúc chuyện bắt đầu: khung gầm, bánh phía gần, bậc lên, cabin, thùng rỗng, cầu dẫn, cửa sau mở 110°
  const { axles, frame, wheels } = truckLayout(L, W, vehicle.axles)
  box([frame.fromX, frame.toX], [-0.75, -0.1], frame.railZ, M.chassis)
  box([CAB_X - 0.8, CAB_X + 0.8], [WHEEL_Y, 0.35], [0.08, W - 0.08], M.chassis)
  for (const y of [-0.3, -0.52]) front([axles[0]!.x + 0.8, axles[1]!.x - 0.72], [y - 0.035, y + 0.035], W, M.metal)
  for (const { x, z } of wheels.filter((wheel) => wheel.z > W / 2).sort((a, b) => a.z - b.z))
    for (const [r, dz, color] of [[WHEEL_RADIUS, -0.15, M.wheel], [WHEEL_RADIUS, 0.15, M.wheel], [0.32, 0.15, M.metal], [0.14, 0.15, M.chassis]] as const)
      face(ring(16, 0, (c, s) => [x + r * c, WHEEL_Y + r * s, z + dz]), [0, 0, 1], color)
  for (const y of [0.18, -0.01]) box([CAB_X + 0.27, CAB_X + 0.77], [y - 0.03, y + 0.03], [W - 0.13, W + 0.11], M.metal)
  face(CAB_PROFILE.map(([x, y]): P3 => [CAB_X + x, y, W - 0.035]), [0, 0, 1], M.cab)
  flat([CAB_X - 0.46, CAB_X + 0.75], [0.035, W - 0.035], 2.3, M.cab)
  front([CAB_X - 0.34, CAB_X + 0.58], [1.445, 2.075], W - 0.03, M.glass)
  for (let k = 3; k < 8; k++) flat([CAB_X - 0.445, CAB_X - 0.395], [W * k / 10 - 0.045, W * k / 10 + 0.045], 2.3575, M.marker)
  flat([0, L], [0, W], 0, M.floor)
  marks.push({ lines: Array.from({ length: Math.ceil(W / 0.2) - 1 }, (_, k): P3[] => [[0, 0, 0.2 * (k + 1)], [L, 0, 0.2 * (k + 1)]]) })
  face([[0, 0, 0], [0, 0, W], [0, H, W], [0, H, 0]], [1, 0, 0], M.wall)
  front([0, L], [0, H], 0, M.wall)
  front([0, L], [0, 0.28], 0.015, M.skirt)
  for (const { xCm: x, yCm: y, zCm: z, lengthCm: dx, widthCm: dz, heightCm: dy, loadBearing } of vehicle.obstacles)
    box([x / 100, (x + dx) / 100], [z / 100, (z + dy) / 100], [y / 100, (y + dz) / 100], [loadBearing ? '--obstacle-bearing' : '--obstacle', 1])
  front([0, L], [0, 0.28], W + 0.015, M.skirt)
  box(leveller.x, [leveller.top - leveller.thickness, leveller.top], leveller.z, paint('leveller'))
  for (const [hinge, tip] of [[0, -0.41], [W, W + 0.41]] as const) face([[L, 0, hinge], [L + 1.128, 0, tip], [L + 1.128, H, tip], [L, H, hinge]], [0, 0, 1], M.wall)
  // Dock, mép trước cyan, khung sơn của bốn làn chờ (làn trống: chuyện chưa bắt đầu), viền đứt nét của thùng như `Container`
  prism(dock.footprint, [slab.top, dock.top], paint('dockFace'), paint('dockTop'))
  const edge = Math.min(...dock.footprint.map(([x]) => x)), zs = dock.footprint.map(([, z]) => z)
  flat([edge, edge + dock.band], [Math.min(...zs), Math.max(...zs)], dock.top, paint('dockEdge'))
  for (const lane of DIORAMA.lanes) {
    const { x, z } = laneBounds(lane), [x0, x1, z0, z1] = [x[0] - 0.06, x[1] + 0.06, z[0] - 0.06, z[1] + 0.06], e = 0.05, color: Paint = [stopColor(lane.stop), 1]
    for (const [lx, lz] of [[[x0, x1], [z0, z0 + e]], [[x0, x1], [z1 - e, z1]], [[x1 - e, x1], [z0, z1]], [[x0 - 0.1, x0 + e], [z0, z1]]] as const) flat(lx, lz, dock.top, color)
  }
  marks.push({ dashed: true, lines: [at(rect([0, L], [0, W]), H).concat([[0, H, 0]]), ...[[L, 0], [L, W], [0, W], [0, 0]].map(([x, z]): P3[] => [[x!, H, z!], [x!, 0, z!]])] })
  return marks
}

/** Khung nhìn và phép chiếu như camera của khung 3D, đo ở mặt phẳng tâm nhìn. Toàn cảnh (camera xa): chiếu song song, ôm `DIORAMA_FRAME_POINTS`
 * với lề 1,06 như `insetFrame`. Góc khác (camera gần): khung vừa khít của `CameraRig` quanh tâm thùng chia `zoom`, mỗi điểm phóng
 * k = khoảng cách / (khoảng cách − độ sâu) lần quanh tâm nhìn — đúng phối cảnh `STAGE_CAMERA.fov` khi khung nằm ngang. */
function cameraOf(view: StageView) {
  const overview = view === 'overview', screen = (p: P3) => alongPoint(VIEW, p[0], p[2], p[1]), toward = unit(VIEW), depth = (p: P3) => dot(sub(p, CENTRE), toward)
  const corners = overview ? DIORAMA_FRAME_POINTS : vehicleFitCorners(CENTRE, true), xs = corners.map((p) => screen(p)[0]), ys = corners.map((p) => screen(p)[1])
  const [margin, zoom, tan] = overview ? [1.06, 1, 0] : [VEHICLE_FIT_MARGIN, STAGE_CAMERA.zoom, Math.tan(STAGE_CAMERA.fov * Math.PI / 360)]
  const [cx, cy] = overview ? [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2] : screen(CENTRE)
  const half = (values: number[], c: number) => Math.max(...values.map((v, k) => depth(corners[k]!) * tan + margin * Math.abs(v - c))) / zoom
  const hw = half(xs, cx), hh = half(ys, cy), distance = hh / tan
  const point = (p: P3) => { const k = overview ? 1 : distance / (distance - depth(p)), o = SCALE * (1 - k); return projectAlong(VIEW, SCALE * k, cx * o, cy * o)(p[0], p[2], p[1]) }
  return { point, viewBox: [cx - hw, cy - hh, 2 * hw, 2 * hh].map((value) => (value * SCALE).toFixed(1)).join(' ') }
}

/** Ảnh tĩnh của khung 3D "Sân kho kể chuyện" lúc trình duyệt tải bộ máy 3D: trạng thái đầu của chuyện, cùng `DIORAMA`, màu, ánh sáng và góc
 * `goc-cheo` với khung 3D, vẽ bằng `projectAlong` (SVG, không Three.js). `insets`: lề của góc Toàn cảnh. Không số. */
export function DioramaPoster({ view = 'overview', insets, className }: { view?: StageView; insets?: Insets; className?: string }) {
  const marks = useMemo(() => posterScene(), []), { viewBox, point } = useMemo(() => cameraOf(view), [view])
  const pad = view === 'overview' && insets ? { paddingTop: insets.top, paddingRight: insets.right, paddingBottom: insets.bottom, paddingLeft: insets.left } : undefined
  return (
    <div aria-hidden className={cn('flex', className)} style={pad}>
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="block size-full min-h-0 min-w-0">
        {marks.map(({ lines, fill, dashed }, index) => <path key={index} d={lines.map((line) => `M${line.map(point).join('L')}${fill ? 'Z' : ''}`).join('')}
          fill={fill ? undefined : 'none'} strokeDasharray={dashed ? '3 2.4' : undefined}
          style={fill ? { fill } : { stroke: 'var(--bg)', strokeOpacity: dashed ? 0.26 : 0.24, strokeWidth: 1 }} />)}
      </svg>
    </div>
  )
}
