import { z } from 'zod'
import type { Formatter } from '@/lib/format'
import { CONTACT_LIMITS, CONTACT_STATUSES, type GuestContact, type GuestContactPatch } from '@/lib/mock-db'

/**
 * Form xử lý một yêu cầu liên hệ ở khung bên phải của `/lien-he-khach`: luật thuần, không React. Message của schema là key từ điển;
 * kho kiểm lại cùng giới hạn (`CONTACT_INVALID`).
 */

/** Ô "Người nhận việc" chưa chọn ai: Radix Select không nhận giá trị rỗng. */
export const NO_ASSIGNEE = 'none'

export const NOTE_TOO_LONG = 'contacts.panel.noteTooLong'

export const contactPanelSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
  assignee: z.string(),
  note: z.string().trim().max(CONTACT_LIMITS.note, NOTE_TOO_LONG),
})
export type ContactPanelValues = z.infer<typeof contactPanelSchema>

export function contactPanelValues(contact: GuestContact): ContactPanelValues {
  return { status: contact.status, assignee: contact.assignedToId ?? NO_ASSIGNEE, note: contact.note ?? '' }
}

/** Trường người dùng đã sửa trên form (`dirtyFields` của react-hook-form, so với lúc mở khung hoặc lần lưu gần nhất). */
export type ContactPanelDirty = Partial<Record<keyof ContactPanelValues, boolean | undefined>>

/**
 * `PATCH` chỉ gồm trường người dùng đã sửa mà còn khác yêu cầu trong kho: trường người khác vừa đổi trong lúc khung đang mở không bị ghi
 * đè bằng giá trị cũ của form. Rỗng là không có gì để lưu. Bỏ người nhận là `assignedToId: null`, xoá ghi chú là `note: ''`.
 */
export function contactPatch(contact: GuestContact, values: ContactPanelValues, dirty: ContactPanelDirty): GuestContactPatch {
  const assignee = values.assignee === NO_ASSIGNEE ? undefined : values.assignee
  const note = values.note.trim()
  return {
    ...(dirty.status && values.status !== contact.status ? { status: values.status } : {}),
    ...(dirty.assignee && assignee !== contact.assignedToId ? { assignedToId: assignee ?? null } : {}),
    ...(dirty.note && note !== (contact.note ?? '') ? { note } : {}),
  }
}

/**
 * Liên kết `mailto:` tới email của khách: phần trước và sau `@` mã hoá riêng, nên ký tự lạ lọt qua (`?`, `&`, `=`) không thành tham số
 * thêm người nhận hay tiêu đề. Kho đã chặn các email đó (`isContactEmail`); đây là lớp thứ hai khi dữ liệu đến từ nơi khác.
 */
export function mailtoHref(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return `mailto:${encodeURIComponent(email)}`
  return `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}`
}

/**
 * Mốc giờ máy chủ ghi kèm múi giờ (`Instant`, ví dụ `2026-11-19T13:59:23.530714200Z`). Phần lẻ của giây (tới 9 chữ số) bị bỏ trước khi đọc:
 * giờ hiện ra chỉ tới phút, và không phải trình duyệt nào cũng đọc được 9 chữ số lẻ.
 */
const SERVER_INSTANT = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.\d+)?(Z|[+-]\d{2}:\d{2})/g

/**
 * Ghi chú nội bộ để hiện và sửa: máy chủ nối dòng `[Phản hồi email lúc <Instant>]: …` vào ghi chú mỗi lần gửi email cho khách, nên mốc
 * giờ thô đổi thành ngày giờ như giờ gửi của yêu cầu hỗ trợ ("19/11/2026 20:59"). Chỉ đổi mốc có múi giờ; chữ người dùng gõ giữ nguyên.
 */
export function readableNote(note: string, format: Formatter): string {
  return note.replace(SERVER_INSTANT, (match, local: string, zone: string) => {
    const at = new Date(`${local}${zone}`)
    return Number.isNaN(at.getTime()) ? match : `${format.date(at)} ${format.time(at)}`
  })
}
