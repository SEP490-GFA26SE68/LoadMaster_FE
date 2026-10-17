import { isoFromBackend } from '@/lib/backend-time'
import { CONTACT_REQUEST_TYPES, CONTACT_STATUSES, type GuestContact, type GuestContactPatch, type NewGuestContact } from '@/lib/mock-db'

/**
 * DTO của `/api/contact-guests` (entity `ContactOfGuest` của backend) và phép đổi sang kiểu của app. Chỉ `contacts-api.ts` và
 * `marketing/contact-api.ts` dùng — kiểu DTO không đi ra khỏi lớp API. Backend trả DTO trần (không phong bì `ApiResponse`); mã số đổi
 * sang chuỗi, trường `null` hay rỗng thành vắng như yêu cầu của kho mẫu.
 */
export type ContactOfGuestDto = {
  readonly id: number
  readonly fullName: string
  readonly email: string
  readonly phoneNumber: string | null
  readonly companyName: string | null
  readonly interestedPlanId: number | null
  readonly interestedPlanName: string | null
  readonly assignedToId: number | null
  readonly assignedToName: string | null
  readonly message: string | null
  readonly requestType: string
  readonly status: string
  readonly note: string | null
  readonly createdAt: string
  readonly resolvedAt: string | null
}

function filled(value: string | null): value is string {
  return value !== null && value.trim() !== ''
}

function oneOf<const Values extends readonly string[]>(values: Values, value: string): Values[number] | undefined {
  return values.find((item) => item === value)
}

/** Loại hay trạng thái backend mới mà FE chưa biết: không vào danh sách — màn không có nhãn hay luật đúng cho nó. */
export function guestContactOf(dto: ContactOfGuestDto): GuestContact | null {
  const requestType = oneOf(CONTACT_REQUEST_TYPES, dto.requestType)
  const status = oneOf(CONTACT_STATUSES, dto.status)
  if (requestType === undefined || status === undefined) return null
  return {
    id: String(dto.id),
    fullName: dto.fullName,
    email: dto.email,
    ...(filled(dto.phoneNumber) ? { phoneNumber: dto.phoneNumber } : {}),
    ...(filled(dto.companyName) ? { companyName: dto.companyName } : {}),
    ...(dto.interestedPlanId === null ? {} : { interestedPlanId: String(dto.interestedPlanId) }),
    ...(filled(dto.interestedPlanName) ? { interestedPlanName: dto.interestedPlanName } : {}),
    ...(filled(dto.message) ? { message: dto.message } : {}),
    requestType,
    status,
    ...(dto.assignedToId === null ? {} : { assignedToId: String(dto.assignedToId) }),
    ...(filled(dto.assignedToName) ? { assignedToName: dto.assignedToName } : {}),
    ...(filled(dto.note) ? { note: dto.note } : {}),
    createdAt: isoFromBackend(dto.createdAt),
    ...(dto.resolvedAt === null ? {} : { resolvedAt: isoFromBackend(dto.resolvedAt) }),
  }
}

const NUMERIC_ID = /^\d+$/

/**
 * Thân `POST`: đủ bảy trường của form công khai. Mã gói của danh mục backend là số; mã của kho mẫu (`PLAN-002` — bảng giá chưa đọc
 * backend) thì không gửi: backend coi nó là JSON sai và từ chối cả yêu cầu (400).
 */
export function newContactBody(input: NewGuestContact) {
  const planId = input.interestedPlanId
  return {
    fullName: input.fullName,
    email: input.email,
    phoneNumber: input.phoneNumber ?? null,
    companyName: input.companyName ?? null,
    interestedPlanId: planId !== undefined && NUMERIC_ID.test(planId) ? Number(planId) : null,
    message: input.message ?? null,
    requestType: input.requestType,
  }
}

/**
 * Thân `PATCH`: trường vắng giữ nguyên. Backend bỏ qua trường `null`, nên **không bỏ được người nhận việc** — màn không cho chọn
 * (`CONTACTS_SOURCE.canUnassign`); `note: ''` vẫn xoá ghi chú (backend lưu mọi chuỗi khác `null`).
 */
export function contactPatchBody(patch: GuestContactPatch) {
  const assignee = patch.assignedToId
  if (assignee === null) throw new Error('Backend chưa bỏ được người nhận việc của yêu cầu liên hệ')
  if (assignee !== undefined && !NUMERIC_ID.test(assignee)) throw new Error(`Mã người nhận việc không phải mã backend: ${assignee}`)
  return {
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(assignee === undefined ? {} : { assignedToId: Number(assignee) }),
    ...(patch.note === undefined ? {} : { note: patch.note }),
  }
}
