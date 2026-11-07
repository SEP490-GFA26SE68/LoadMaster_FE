import { eq } from './numeric'

/**
 * Mã hướng đặt của Spec mục 6, theo thứ tự Spec liệt kê. Nguồn duy nhất của danh sách: schema ở `@/domain/models`
 * dựng từ đây, vì models đã import geometry và geometry không import ngược lại.
 */
export const ORIENTATION_CODES = ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'] as const

export type OrientationCode = (typeof ORIENTATION_CODES)[number]

/** Kích thước danh nghĩa của kiện, cùng tên trường với `CargoPackage` của Spec. */
export type PackageDimensions = {
  lengthCm: number
  widthCm: number
  heightCm: number
}

/** Kích thước kiện sau khi xoay theo trục X, Y, Z của thùng, cùng tên trường với `PackagePlacement` của Spec. */
export type PlacedDimensions = {
  placedLengthCm: number
  placedWidthCm: number
  placedHeightCm: number
}

function placed(placedLengthCm: number, placedWidthCm: number, placedHeightCm: number): PlacedDimensions {
  return { placedLengthCm, placedWidthCm, placedHeightCm }
}

/**
 * Spec 6, 7.5: mã hướng đọc theo thứ tự trục X, Y, Z. Chữ thứ nhất là cạnh kiện nằm dọc X (chiều dài thùng),
 * chữ thứ hai dọc Y (chiều rộng), chữ thứ ba dọc Z (chiều cao); L, W, H là dài, rộng, cao danh nghĩa của kiện.
 * Luôn áp lên kích thước danh nghĩa, không áp lên kích thước đã xoay.
 */
export function orientDimensions(dimensions: PackageDimensions, code: OrientationCode): PlacedDimensions {
  const { lengthCm: l, widthCm: w, heightCm: h } = dimensions
  switch (code) {
    case 'LWH': return placed(l, w, h)
    case 'LHW': return placed(l, h, w)
    case 'WLH': return placed(w, l, h)
    case 'WHL': return placed(w, h, l)
    case 'HLW': return placed(h, l, w)
    case 'HWL': return placed(h, w, l)
  }
}

/** Spec 6, `keepUpright`: hướng giữ chiều cao H của kiện ở trục Z, tức mặt đáy chỉ xoay quanh trục đứng. */
export const UPRIGHT_ORIENTATIONS: readonly OrientationCode[] = ['LWH', 'WLH']

export function isUpright(code: OrientationCode): boolean {
  return UPRIGHT_ORIENTATIONS.includes(code)
}

/** Luật hướng đặt của kiện, cùng tên trường với `CargoPackage` của Spec. */
export type OrientationRules = {
  allowedOrientations: readonly OrientationCode[]
  keepUpright: boolean
}

/**
 * Hướng kiện thật sự được dùng, theo thứ tự của kiện: `allowedOrientations`, bỏ hướng nằm khi `keepUpright`.
 * Schema đã từ chối dữ liệu xung đột (D-25); lọc ở đây chặn cả dữ liệu chưa qua schema, như form đang sửa.
 */
export function effectiveOrientations(pkg: OrientationRules): readonly OrientationCode[] {
  return pkg.keepUpright ? pkg.allowedOrientations.filter(isUpright) : pkg.allowedOrientations
}

function sameDimensions(a: PlacedDimensions, b: PlacedDimensions): boolean {
  return eq(a.placedLengthCm, b.placedLengthCm) && eq(a.placedWidthCm, b.placedWidthCm) && eq(a.placedHeightCm, b.placedHeightCm)
}

/**
 * Hướng kế tiếp khi xoay trong editor: vòng qua `effectiveOrientations` bắt đầu sau hướng hiện tại, bỏ qua hướng
 * cho cùng kích thước đã xoay với hiện tại (kiện có hai cạnh bằng nhau) để mỗi lần xoay đều đổi hình dạng.
 * Hướng hiện tại không thuộc danh sách (dữ liệu sai luật) thì vòng bắt đầu từ hướng đầu tiên.
 * Không còn hướng nào đổi được kích thước thì trả lại chính hướng hiện tại.
 */
export function nextOrientation(pkg: PackageDimensions & OrientationRules, current: OrientationCode): OrientationCode {
  return turn(pkg, current, effectiveOrientations(pkg))
}

/** Như `nextOrientation` nhưng vòng ngược (Shift + R của editor); hướng hiện tại không thuộc danh sách thì bắt đầu từ hướng cuối. */
export function previousOrientation(pkg: PackageDimensions & OrientationRules, current: OrientationCode): OrientationCode {
  return turn(pkg, current, [...effectiveOrientations(pkg)].reverse())
}

function turn(pkg: PackageDimensions, current: OrientationCode, options: readonly OrientationCode[]): OrientationCode {
  const after = options.indexOf(current) + 1
  const currentSize = orientDimensions(pkg, current)
  const cycle = [...options.slice(after), ...options.slice(0, after)]
  return cycle.find((code) => !sameDimensions(orientDimensions(pkg, code), currentSize)) ?? current
}

/** Hướng và kích thước đã xoay của một kiện đã xếp, cùng tên trường với `PackagePlacement` của Spec. */
export type OrientedPlacement = PlacedDimensions & { orientation: OrientationCode }

/** Spec 7.5: kích thước đã xếp phải đúng kích thước kiện theo hướng placement khai báo, so trong EPSILON. */
export function matchesOrientation(placement: OrientedPlacement, pkg: PackageDimensions): boolean {
  return sameDimensions(placement, orientDimensions(pkg, placement.orientation))
}
