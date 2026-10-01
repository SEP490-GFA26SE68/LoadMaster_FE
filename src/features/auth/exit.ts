import type { Role } from '@/types/user'
import { ROLE_HOME } from './landing'

export type ExitAction = { readonly kind: 'signOut' } | { readonly kind: 'link'; readonly to: string }

/**
 * Nút thoát của màn toàn màn hình (kho, tài xế) — các màn này không có nav rail. `screenHome` là đường dẫn của màn đang đứng.
 *
 * - Màn là màn chính của vai trò (nhân viên kho ở danh sách `/kho`, tài xế ở "Chuyến của tôi" `/tai-xe`): không còn màn nào khác
 *   để về, nên thoát là **đăng xuất**, không đẩy họ sang trang của điều phối viên.
 * - Điều phối viên về trang đã mở màn này (`contextual`, ví dụ chi tiết chuyến), không có thì về màn của mình. Từ FE-0-01 chưa ai đi
 *   tới nhánh này: route `/kho`, `/tai-xe` chỉ mở cho nhân viên kho và tài xế (trước đó chỉ `admin` toàn quyền mở được).
 * - Vai trò khác về màn chính của vai trò — nhân viên kho đang trong phiên xếp `/kho?chuyen=…` thì về danh sách `/kho` (LM-086),
 *   tài xế đang trong một chuyến `/tai-xe/diem-giao` thì về danh sách `/tai-xe` (LM-087). Bốn vai trò mới (FE-0-03) cũng theo luật
 *   này: quản trị hệ thống và quản trị công ty không xem được chuyến, nên không bao giờ được dẫn tới `contextual`.
 */
export function exitAction(role: Role, screenHome: string, contextual?: string): ExitAction {
  if (ROLE_HOME[role] === screenHome) return { kind: 'signOut' }
  if (role === 'dispatcher' && contextual) return { kind: 'link', to: contextual }
  return { kind: 'link', to: ROLE_HOME[role] }
}
