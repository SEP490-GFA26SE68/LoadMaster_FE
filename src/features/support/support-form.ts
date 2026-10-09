import { z } from 'zod'
import type { MessageKey, TFunction } from '@/lib/i18n'
import { MAX_TICKET_TEXT, MAX_TICKET_TITLE, TICKET_KINDS } from '@/lib/mock-db'

/**
 * Form gửi yêu cầu hỗ trợ và form trả lời (FE-8-07). Message của schema là key từ điển nên lỗi đổi theo ngôn ngữ; kho kiểm lại cùng
 * giới hạn (`TICKET_INVALID`).
 */
const ERRORS = {
  subjectRequired: 'support.form.errors.subjectRequired',
  subjectTooLong: 'support.form.errors.subjectTooLong',
  bodyRequired: 'support.form.errors.bodyRequired',
  bodyTooLong: 'support.form.errors.bodyTooLong',
  replyRequired: 'support.thread.errors.replyRequired',
  replyTooLong: 'support.thread.errors.replyTooLong',
} as const satisfies Record<string, MessageKey>

export const ticketFormSchema = z.object({
  kind: z.enum(TICKET_KINDS),
  title: z.string().trim().min(1, ERRORS.subjectRequired).max(MAX_TICKET_TITLE, ERRORS.subjectTooLong),
  description: z.string().trim().min(1, ERRORS.bodyRequired).max(MAX_TICKET_TEXT, ERRORS.bodyTooLong),
})
export type TicketFormValues = z.infer<typeof ticketFormSchema>

export const replyFormSchema = z.object({ text: z.string().trim().min(1, ERRORS.replyRequired).max(MAX_TICKET_TEXT, ERRORS.replyTooLong) })
export type ReplyFormValues = z.infer<typeof replyFormSchema>

/** Dịch message của schema; message không phải key của schema thì bỏ qua. */
export function translateSupportError(t: TFunction, message: string | undefined): string | undefined {
  switch (message) {
    case ERRORS.subjectRequired: return t(ERRORS.subjectRequired)
    case ERRORS.subjectTooLong: return t(ERRORS.subjectTooLong, { max: MAX_TICKET_TITLE })
    case ERRORS.bodyRequired: return t(ERRORS.bodyRequired)
    case ERRORS.bodyTooLong: return t(ERRORS.bodyTooLong, { max: MAX_TICKET_TEXT })
    case ERRORS.replyRequired: return t(ERRORS.replyRequired)
    case ERRORS.replyTooLong: return t(ERRORS.replyTooLong, { max: MAX_TICKET_TEXT })
    default: return undefined
  }
}
