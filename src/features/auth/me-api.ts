/**
 * Hàm → endpoint backend (FE-0-09):
 *   fetchBackendMe → GET /api/users/me
 */

import { api } from '@/lib/api-client'
import type { Role } from '@/types/user'
import { roleOfBackend, type BackendUserProfile } from './backend-user'

/**
 * Người đang đăng nhập **ở backend**: mã số backend (khác mã của tài khoản mẫu đứng thay trong phiên của app, `userFromBackend`), tên và
 * vai trò (`null` khi backend có vai trò FE chưa biết). Cho `-api.ts` của feature đã nối backend cần lọc "của chính mình" hay biết vai
 * trò của người xem — phiên của app không giữ mã backend.
 */
export type BackendMe = { readonly id: string; readonly fullName: string; readonly role: Role | null }

// GET /api/users/me
export async function fetchBackendMe(): Promise<BackendMe> {
  const profile = await api().get<BackendUserProfile>('/api/users/me')
  return { id: String(profile.id), fullName: profile.fullName, role: roleOfBackend(profile.userRoleType) }
}
