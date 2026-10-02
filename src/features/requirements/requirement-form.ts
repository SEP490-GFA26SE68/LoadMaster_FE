import { coordinateText, parseCoordinates, type CoordinateText } from '@/components/map'
import { REQUIREMENT_FIELDS_AFTER_PENDING, REQUIREMENT_PRIORITIES, type DeliveryRequirement, type RequirementChanges, type RequirementInput, type RequirementPriority } from '@/lib/mock-db'

/**
 * Phép tính thuần của form yêu cầu giao (FE-4b-02): giá trị ban đầu, kiểm tra trả **mã** lỗi theo ô (component dịch), và đầu vào gửi
 * xuống kho. Hạn nhập bằng hai ô ngày + giờ theo giờ của máy — cùng múi giờ với chỗ hiện hạn (`format.date` / `format.time`). Toạ độ
 * là chữ của hai ô vĩ độ / kinh độ của ô chọn toạ độ (FE-4b-03); để trống cả hai là yêu cầu chưa có toạ độ.
 */

export const MAX_NAME = 120
export const MAX_ADDRESS = 200
export const MAX_NOTE = 300

export type RequirementFormValues = {
  destinationName: string
  address: string
  /** `YYYY-MM-DD` */
  deadlineDate: string
  /** `HH:mm` */
  deadlineTime: string
  priority: RequirementPriority
  packageIds: string[]
  note: string
  coordinates: CoordinateText
}

export type RequirementFieldError = 'required' | 'tooLong' | 'deadlineInvalid' | 'deadlinePast' | 'packagesRequired' | 'coordinatesInvalid'
export type RequirementFormErrors = Partial<Record<keyof RequirementFormValues, RequirementFieldError>>

const pad = (value: number) => String(value).padStart(2, '0')

/** Ngày và giờ (theo giờ của máy) của một thời điểm ISO, cho hai ô nhập. */
export function deadlineParts(iso: string): Pick<RequirementFormValues, 'deadlineDate' | 'deadlineTime'> {
  const at = new Date(iso)
  return {
    deadlineDate: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`,
    deadlineTime: `${pad(at.getHours())}:${pad(at.getMinutes())}`,
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

/** Thời điểm ISO của ngày + giờ nhập theo giờ của máy; `null` khi thiếu hoặc sai dạng. */
export function deadlineIso(date: string, time: string): string | null {
  if (!DATE.test(date) || !TIME.test(time)) return null
  const at = new Date(`${date}T${time}:00`)
  return Number.isNaN(at.getTime()) ? null : at.toISOString()
}

/** Giờ mặc định của hạn trên form tạo mới: cuối giờ hành chính. Ngày để trống cho người lập chọn. */
export const DEFAULT_DEADLINE_TIME = '17:00'

export function initialValues(requirement?: DeliveryRequirement): RequirementFormValues {
  if (!requirement) {
    return { destinationName: '', address: '', deadlineDate: '', deadlineTime: DEFAULT_DEADLINE_TIME, priority: 'NORMAL', packageIds: [], note: '', coordinates: coordinateText(undefined, undefined) }
  }
  return {
    destinationName: requirement.destinationName,
    address: requirement.address,
    ...deadlineParts(requirement.deadline),
    priority: requirement.priority,
    packageIds: [...requirement.packageIds],
    note: requirement.note ?? '',
    coordinates: coordinateText(requirement.lat, requirement.lng),
  }
}

/**
 * Lỗi theo ô. Hạn phải ở tương lai so với `now` — trừ khi sửa mà không đổi hạn (`original`): hạn cũ đã qua vẫn lưu được các trường
 * khác, như kho.
 */
export function validateRequirement(values: RequirementFormValues, now: Date, original?: Pick<DeliveryRequirement, 'deadline'>): RequirementFormErrors {
  const errors: RequirementFormErrors = {}
  const text = (field: 'destinationName' | 'address', max: number) => {
    const value = values[field].trim()
    if (value === '') errors[field] = 'required'
    else if (value.length > max) errors[field] = 'tooLong'
  }
  text('destinationName', MAX_NAME)
  text('address', MAX_ADDRESS)
  if (values.note.trim().length > MAX_NOTE) errors.note = 'tooLong'
  if (!REQUIREMENT_PRIORITIES.includes(values.priority)) errors.priority = 'required'
  if (values.packageIds.length === 0) errors.packageIds = 'packagesRequired'

  if (values.deadlineDate === '') errors.deadlineDate = 'required'
  else if (values.deadlineTime === '') errors.deadlineTime = 'required'
  else {
    const iso = deadlineIso(values.deadlineDate, values.deadlineTime)
    if (iso === null) errors.deadlineDate = 'deadlineInvalid'
    else if (iso !== original?.deadline && Date.parse(iso) <= now.getTime()) errors.deadlineDate = 'deadlinePast'
  }
  // Câu lỗi của từng ô vĩ độ / kinh độ do ô chọn toạ độ tự hiện; ở đây chỉ chặn lưu
  if (parseCoordinates(values.coordinates.lat, values.coordinates.lng).kind === 'error') errors.coordinates = 'coordinatesInvalid'
  return errors
}

/** Đầu vào tạo yêu cầu. Gọi sau khi `validateRequirement` không còn lỗi. Hai ô toạ độ để trống thì không gửi toạ độ. */
export function toInput(values: RequirementFormValues): RequirementInput {
  const point = parseCoordinates(values.coordinates.lat, values.coordinates.lng)
  return {
    destinationName: values.destinationName.trim(),
    address: values.address.trim(),
    deadline: deadlineIso(values.deadlineDate, values.deadlineTime) ?? '',
    priority: values.priority,
    packageIds: values.packageIds,
    note: values.note.trim(),
    ...(point.kind === 'ok' ? { lat: point.lat, lng: point.lng } : {}),
  }
}

/**
 * Thay đổi gửi khi sửa. Yêu cầu còn chờ xếp chuyến: mọi trường; hai ô toạ độ để trống là bỏ toạ độ đang có (`null`). Yêu cầu đã vào
 * chuyến: chỉ hạn và ưu tiên (mục 7.3).
 */
export function toChanges(values: RequirementFormValues, current: DeliveryRequirement): RequirementChanges {
  const input = toInput(values)
  if (current.status !== 'PENDING') {
    return Object.fromEntries(REQUIREMENT_FIELDS_AFTER_PENDING.map((field) => [field, input[field]]))
  }
  return { ...input, lat: input.lat ?? null, lng: input.lng ?? null }
}

/** Ô còn sửa được ở trạng thái `status` của yêu cầu đang sửa; tạo mới (vắng) thì mọi ô. */
export function isFieldEditable(field: keyof RequirementInput, status?: DeliveryRequirement['status']): boolean {
  const open: readonly string[] = REQUIREMENT_FIELDS_AFTER_PENDING
  return status === undefined || status === 'PENDING' || open.includes(field)
}
