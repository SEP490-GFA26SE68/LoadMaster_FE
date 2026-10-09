import { EMPTY_COORDINATES, parseCoordinates, type CoordinateText } from '@/components/map'
import { deadlineIso } from '@/features/requirements/requirement-form'
import type { HandlingClass } from '@/domain/models'
import type { PickupPackage, PickupPoint, PickupRequestInput } from '@/lib/mock-db'

/**
 * Phép tính thuần của form yêu cầu nhận hàng dọc đường (FE-7-03): giá trị ban đầu, kiểm tra trả **mã** lỗi theo ô (component dịch) và
 * đầu vào gửi xuống kho. Mọi ô số là chữ đang gõ; hạn nhập bằng hai ô ngày + giờ như yêu cầu giao, để trống cả hai là không có hạn.
 */

export const MAX_NAME = 120
export const MAX_ADDRESS = 200
export const MAX_CODE = 40

export type PickupPointValues = { name: string; address: string; coordinates: CoordinateText }

export type PickupPackageValues = {
  packageCode: string
  lengthCm: string
  widthCm: string
  heightCm: string
  weightKg: string
  handlingClass: HandlingClass
}

export type PickupFormValues = {
  pickup: PickupPointValues
  delivery: PickupPointValues
  /** `YYYY-MM-DD`; trống cả ngày lẫn giờ là không có hạn. */
  deadlineDate: string
  /** `HH:mm` */
  deadlineTime: string
  packages: PickupPackageValues[]
}

export type PickupFormError = 'required' | 'tooLong' | 'coordinatesRequired' | 'coordinatesInvalid' | 'deadlineInvalid' | 'number' | 'packagesRequired'

/** Một lỗi: đường dẫn tới ô theo `react-hook-form` (`['packages', 0, 'lengthCm']`) và mã. */
export type PickupFormIssue = { path: (string | number)[]; code: PickupFormError }

export const SIZE_FIELDS = ['lengthCm', 'widthCm', 'heightCm', 'weightKg'] as const

export function emptyPackage(): PickupPackageValues {
  return { packageCode: '', lengthCm: '', widthCm: '', heightCm: '', weightKg: '', handlingClass: 'STANDARD' }
}

export function initialPickupValues(): PickupFormValues {
  const point = (): PickupPointValues => ({ name: '', address: '', coordinates: EMPTY_COORDINATES })
  return { pickup: point(), delivery: point(), deadlineDate: '', deadlineTime: '', packages: [emptyPackage()] }
}

/** Số dương từ chữ đang gõ (nhận dấu phẩy thập phân); `null` khi không phải số lớn hơn 0. */
export function positiveNumber(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'))
  return text.trim() !== '' && Number.isFinite(value) && value > 0 ? value : null
}

function pointIssues(point: PickupPointValues, prefix: 'pickup' | 'delivery'): PickupFormIssue[] {
  const issues: PickupFormIssue[] = []
  const text = (field: 'name' | 'address', max: number) => {
    const value = point[field].trim()
    if (value === '') issues.push({ path: [prefix, field], code: 'required' })
    else if (value.length > max) issues.push({ path: [prefix, field], code: 'tooLong' })
  }
  text('name', MAX_NAME)
  text('address', MAX_ADDRESS)
  const parsed = parseCoordinates(point.coordinates.lat, point.coordinates.lng)
  if (parsed.kind === 'empty') issues.push({ path: [prefix, 'coordinates'], code: 'coordinatesRequired' })
  else if (parsed.kind === 'error') issues.push({ path: [prefix, 'coordinates'], code: 'coordinatesInvalid' })
  return issues
}

/** Mọi lỗi của form, theo thứ tự ô trên màn. Không có lỗi là gửi được. */
export function validatePickupForm(values: PickupFormValues): PickupFormIssue[] {
  const issues = [...pointIssues(values.pickup, 'pickup'), ...pointIssues(values.delivery, 'delivery')]
  const hasDate = values.deadlineDate.trim() !== ''
  const hasTime = values.deadlineTime.trim() !== ''
  if ((hasDate || hasTime) && deadlineIso(values.deadlineDate, values.deadlineTime) === null) issues.push({ path: ['deadlineDate'], code: 'deadlineInvalid' })
  if (values.packages.length === 0) issues.push({ path: ['packages'], code: 'packagesRequired' })
  values.packages.forEach((pkg, index) => {
    const code = pkg.packageCode.trim()
    if (code === '') issues.push({ path: ['packages', index, 'packageCode'], code: 'required' })
    else if (code.length > MAX_CODE) issues.push({ path: ['packages', index, 'packageCode'], code: 'tooLong' })
    for (const field of SIZE_FIELDS) if (positiveNumber(pkg[field]) === null) issues.push({ path: ['packages', index, field], code: 'number' })
  })
  return issues
}

function pointInput(point: PickupPointValues): PickupPoint {
  const parsed = parseCoordinates(point.coordinates.lat, point.coordinates.lng)
  if (parsed.kind !== 'ok') throw new Error('Toạ độ của điểm chưa được kiểm trước khi đổi thành đầu vào')
  return { name: point.name.trim(), address: point.address.trim(), lat: parsed.lat, lng: parsed.lng }
}

function packageInput(pkg: PickupPackageValues): PickupPackage {
  const size = (field: (typeof SIZE_FIELDS)[number]) => positiveNumber(pkg[field]) ?? 0
  return {
    packageCode: pkg.packageCode.trim(), lengthCm: size('lengthCm'), widthCm: size('widthCm'), heightCm: size('heightCm'),
    weightKg: size('weightKg'), handlingClass: pkg.handlingClass,
  }
}

/** Đầu vào gửi kho; chỉ gọi sau khi `validatePickupForm` không còn lỗi. */
export function toPickupInput(values: PickupFormValues): PickupRequestInput {
  const deadline = deadlineIso(values.deadlineDate, values.deadlineTime)
  return {
    pickup: pointInput(values.pickup),
    delivery: pointInput(values.delivery),
    ...(deadline === null ? {} : { deadline }),
    packages: values.packages.map(packageInput),
  }
}
