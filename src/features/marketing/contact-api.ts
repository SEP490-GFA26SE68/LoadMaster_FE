/**
 * Hàm → endpoint backend (FE-0-09); nối backend chỉ thay thân hàm. Trang công khai: gọi được khi chưa đăng nhập (không có phiên thì
 * không gửi token — `POST /api/contact-guests` mở cho khách).
 *   sendGuestContact → POST /api/contact-guests
 */

import { guestContactOf, newContactBody, type ContactOfGuestDto } from '@/features/contacts/contact-dto'
import { api, ApiError } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
import { getMockDb, type GuestContact, type NewGuestContact } from '@/lib/mock-db'

const ON_BACKEND = usesBackend('contacts')

/**
 * Yêu cầu của khách được lưu ở đâu (AGENTS mục 9, "Phần backend chưa có thì ẩn"): kho mẫu chỉ giữ nó trong trình duyệt này, nên form liên
 * hệ và trang chính sách bảo mật nói thật điều đó thay vì hứa đội LoadMaster sẽ nhận được. Không đổi lượt gọi mạng nào.
 */
export const GUEST_CONTACT_SOURCE = { storedInBrowser: !ON_BACKEND } as const

/**
 * Gửi yêu cầu liên hệ của khách chưa có tài khoản; trả yêu cầu vừa ghi, trạng thái Mới. Kho mẫu cấp mã `LH-NNN`, backend cấp mã số.
 * Backend từ chối (thiếu trường, email sai): `ApiError` mã `BAD_REQUEST`; form hiện câu qua `dataErrorMessage`.
 */
// POST /api/contact-guests
export async function sendGuestContact(input: NewGuestContact): Promise<GuestContact> {
  if (!ON_BACKEND) return getMockDb().createGuestContact(input)
  const contact = guestContactOf(await api().post<ContactOfGuestDto>('/api/contact-guests', { body: newContactBody(input) }))
  if (contact === null) throw new ApiError('SERVER_ERROR')
  return contact
}
