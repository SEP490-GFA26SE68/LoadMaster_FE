import type { BufferGeometry, Material, Object3D } from 'three'

/**
 * "Chữ ký" của mọi thứ quyết định nội dung shadow map (thuần three.js, không React). Shadow map vẽ trong không gian đèn: đèn đứng yên
 * thì nó chỉ phụ thuộc vật đổ bóng — không phụ thuộc camera, khung hình hay DPR. `ShadowOnDemand` so chữ ký mỗi lần vẽ và chỉ xin vẽ
 * lại shadow map khi chữ ký đổi.
 *
 * Duyệt như lượt bóng của three (`WebGLShadowMap.renderObject`): bỏ cả nhánh `visible = false`; mỗi mesh / line / points có
 * `castShadow` ghi danh tính, `layers`, `matrixWorld`, hình học (danh tính, `drawRange`, phiên bản từng attribute), vật liệu (danh tính,
 * `visible`, `version`), với `InstancedMesh` thêm `count` và phiên bản `instanceMatrix` (ghi ma trận kiện imperative luôn tăng phiên
 * bản); mỗi đèn có `castShadow` ghi `matrixWorld` của đèn và đích, cỡ bản đồ và khung camera bóng. Màu instance không nằm trong chữ
 * ký: lượt bóng không đọc màu.
 *
 * Phải đọc **sau** `scene.updateMatrixWorld()` của lần vẽ (`scene.onBeforeRender`): đọc trước thì ma trận của khung này chưa tính.
 */

type ShadowObject = Object3D & {
  isMesh?: boolean
  isLine?: boolean
  isPoints?: boolean
  isLight?: boolean
  isInstancedMesh?: boolean
  geometry?: BufferGeometry
  material?: Material | Material[]
  count?: number
  instanceMatrix?: { version: number }
  target?: Object3D
  shadow?: {
    mapSize: { x: number; y: number }
    camera: { left?: number; right?: number; top?: number; bottom?: number; near: number; far: number }
  }
}

const ids = new WeakMap<object, number>()
let nextId = 1
/** Số định danh không đổi cho một object (hình học, attribute, vật liệu) mà không giữ tham chiếu tới nó. */
function idOf(value: object): number {
  let id = ids.get(value)
  if (id === undefined) { id = nextId++; ids.set(value, id) }
  return id
}

function pushMatrix(out: number[], elements: ArrayLike<number>) {
  for (let i = 0; i < 16; i++) out.push(elements[i]!)
}

function pushGeometry(out: number[], geometry: BufferGeometry | undefined) {
  if (!geometry) { out.push(-1); return }
  out.push(idOf(geometry), geometry.drawRange.start, geometry.drawRange.count, geometry.index ? idOf(geometry.index) : -1, geometry.index?.version ?? -1)
  for (const name in geometry.attributes) {
    const attribute = geometry.attributes[name]!
    out.push(idOf(attribute), 'isInterleavedBufferAttribute' in attribute ? attribute.data.version : attribute.version)
  }
}

function pushMaterial(out: number[], material: Material | Material[] | undefined) {
  if (!material) { out.push(-1); return }
  for (const m of Array.isArray(material) ? material : [material]) out.push(idOf(m), m.visible ? 1 : 0, m.version)
}

function visit(object: ShadowObject, out: number[]) {
  if (!object.visible) return
  if (object.castShadow && (object.isMesh || object.isLine || object.isPoints)) {
    out.push(object.id, object.layers.mask)
    pushMatrix(out, object.matrixWorld.elements)
    pushGeometry(out, object.geometry)
    pushMaterial(out, object.material)
    if (object.isInstancedMesh) out.push(object.count ?? 0, object.instanceMatrix ? idOf(object.instanceMatrix) : -1, object.instanceMatrix?.version ?? -1)
  } else if (object.castShadow && object.isLight && object.shadow) {
    const { mapSize, camera } = object.shadow
    out.push(object.id)
    pushMatrix(out, object.matrixWorld.elements)
    if (object.target) pushMatrix(out, object.target.matrixWorld.elements)
    out.push(mapSize.x, mapSize.y, camera.left ?? 0, camera.right ?? 0, camera.top ?? 0, camera.bottom ?? 0, camera.near, camera.far)
  }
  for (const child of object.children) visit(child as ShadowObject, out)
}

/** Ghi chữ ký của cây `root` vào `out` (xoá nội dung cũ, không cấp phát mảng mới). */
export function shadowSignature(root: Object3D, out: number[] = []): number[] {
  out.length = 0
  visit(root as ShadowObject, out)
  return out
}

/**
 * Bộ so: `changed(root)` trả `true` ở lần đầu và mỗi khi chữ ký khác lần trước. Hai mảng dùng luân phiên, không cấp phát theo khung.
 * `Object.is` để `NaN` trong ma trận (không nên có) không làm shadow map vẽ lại mãi.
 */
export function createShadowTracker() {
  let previous: number[] | null = null
  let next: number[] = []
  return {
    changed(root: Object3D): boolean {
      shadowSignature(root, next)
      const same = previous !== null && sameValues(previous, next)
      const swap = previous ?? []
      previous = next
      next = swap
      return !same
    },
  }
}

function sameValues(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false
  return true
}
