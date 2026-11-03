import type { GuestContact, GuestContactPatch, NewGuestContact } from './contact-model'

/**
 * Yêu cầu liên hệ của khách (`ContactOfGuest`). Cùng quy ước với `MockDb`. Gửi là việc **công khai**: không cần phiên, phiên nào cũng
 * gửi được. Đọc và xử lý chỉ ba vai trò nền tảng (Hỗ trợ khách hàng, Quản lý nền tảng, Quản trị hệ thống); phiên của một công ty và vai trò
 * khác bị từ chối `ROLE_NOT_ALLOWED`. Yêu cầu liên hệ không thuộc công ty nào.
 */
export type ContactsDb = {
  /** Khách gửi yêu cầu: kho cấp mã `LH-NNN`, trạng thái `NEW`. Sai dữ liệu: `CONTACT_INVALID { field }`. Ghi `contact.received`. */
  createGuestContact(input: NewGuestContact): Promise<GuestContact>
  /** Mọi yêu cầu liên hệ, mới nhất trước. */
  listGuestContacts(): Promise<GuestContact[]>
  getGuestContact(id: string): Promise<GuestContact>
  /**
   * Đổi trạng thái (mọi chiều), người nhận việc (người đang hoạt động thuộc ba vai trò xử lý) và ghi chú. Lần đầu thành `RESOLVED` hoặc
   * `CLOSED` thì ghi `resolvedAt`. Không đổi gì thì không ghi nhật ký; có đổi thì ghi `contact.updated` kèm các trường đã đổi.
   */
  updateGuestContact(id: string, patch: GuestContactPatch): Promise<GuestContact>
}
