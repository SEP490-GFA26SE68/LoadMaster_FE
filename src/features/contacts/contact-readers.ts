import { usesBackend } from '@/lib/backend-config'
import { CONTACT_HANDLER_ROLES } from '@/lib/mock-db'
import type { Role } from '@/types/user'

/** Vai trò máy chủ cho đọc và sửa yêu cầu liên hệ: `@PreAuthorize` của `GET` / `PATCH /api/contact-guests` (ContactGuestController). */
const SERVER_CONTACT_READERS = ['systemSupporter', 'systemManager', 'systemAdmin'] as const satisfies readonly Role[]

/**
 * Ai đọc được yêu cầu liên hệ của khách theo nguồn đang chạy — trang Chính sách bảo mật nói đúng danh sách này. Máy chủ cho thêm quản lý
 * nền tảng đọc qua API dù màn `/lien-he-khach` chỉ mở cho hai vai trò `contacts.handle`. File riêng, nhẹ: trang công khai không kéo
 * `contacts-api.ts` vào chunk của nó.
 */
export const CONTACT_READER_ROLES: readonly Role[] = usesBackend('contacts') ? SERVER_CONTACT_READERS : CONTACT_HANDLER_ROLES
