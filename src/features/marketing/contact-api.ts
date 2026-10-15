/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Trang công khai: gọi được khi chưa đăng nhập.
 *   sendGuestContact → POST /api/contact-guests
 */

import { getMockDb, type GuestContact, type NewGuestContact } from '@/lib/mock-db'

/** Gửi yêu cầu liên hệ của khách chưa có tài khoản; kho trả yêu cầu vừa ghi (mã `LH-NNN`, trạng thái Mới). */
// POST /api/contact-guests
export function sendGuestContact(input: NewGuestContact): Promise<GuestContact> {
  return getMockDb().createGuestContact(input)
}
