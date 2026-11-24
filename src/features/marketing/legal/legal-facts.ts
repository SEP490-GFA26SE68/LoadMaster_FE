import { PUBLIC_PRIVACY, PUBLIC_TERMS } from '@/features/auth/landing'

/**
 * Số và ngày mà hai trang pháp lý nói ra — một chỗ, để câu trong từ điển không mang số viết tay. Số về credit và gói lấy thẳng từ
 * `BILLING_CONSTANTS`; hai hạn của tài khoản dùng thử do máy chủ giữ (app chỉ hiện), nên ghi ở đây đúng như màn ký thoả thuận và màn khoá
 * đang nói — máy chủ đổi hạn thì sửa ở đây cùng lúc.
 */

/** Hạn ký thoả thuận dịch vụ của tài khoản dùng thử, tính từ khi tài khoản được cấp. */
export const TRIAL_AGREEMENT_HOURS = 72
/** Tài khoản dùng thử bị khoá vì chưa ký bị xoá hẳn sau chừng này ngày kể từ khi hết hạn dùng thử. */
export const TRIAL_PURGE_DAYS = 30

/** Ngày sửa nội dung hai trang lần cuối — giữa trưa giờ máy để định dạng ngày không lệch sang hôm trước / hôm sau. */
export const LEGAL_UPDATED_AT = new Date(2026, 10, 24, 12)

/** Hai tài liệu pháp lý, theo thứ tự của bộ chuyển trên dải trời. */
export const LEGAL_DOCS = ['privacy', 'terms'] as const
export type LegalDoc = (typeof LEGAL_DOCS)[number]

export const LEGAL_PATHS: Readonly<Record<LegalDoc, string>> = { privacy: PUBLIC_PRIVACY, terms: PUBLIC_TERMS }
