import type { Role } from '@/types/user'
import { ROLE_HOME } from './landing'
import { can } from './permissions'

export type ExitAction = { readonly kind: 'signOut' } | { readonly kind: 'link'; readonly to: string }

/**
 * Nút thoát của màn toàn màn hình (kho, tài xế) — các màn này không có nav rail. `screenHome` là đường dẫn của màn đang đứng.
 *
 * - Màn là màn chính của vai trò (nhân viên kho ở danh sách `/kho`, tài xế ở "Chuyến của tôi" `/tai-xe`): không còn màn nào khác
 *   để về, nên thoát là **đăng xuất**, không đẩy họ sang trang của điều phối viên.
 * - Vai trò xem được chuyến (`trips.view`: điều phối viên, quản lý công ty) về trang chuyến đã mở màn này (`contextual`, ví dụ chi
 *   tiết chuyến), không có thì về màn của mình. Từ FE-0-01 chưa ai đi tới nhánh này: route `/kho`, `/tai-xe` chỉ mở cho nhân viên kho
 *   và tài xế. Hỏi quyền chứ không hỏi tên vai trò (FE-0-04): vai trò nào về sau xem được chuyến cũng theo luật này.
 * - Vai trò khác về màn chính của vai trò — nhân viên kho đang trong phiên xếp `/kho?chuyen=…` thì về danh sách `/kho` (LM-086),
 *   tài xế đang trong một chuyến `/tai-xe/diem-giao` thì về danh sách `/tai-xe` (LM-087). Quản trị hệ thống, quản trị công ty và hai
 *   vai trò nền tảng còn lại không xem được chuyến, nên không bao giờ được dẫn tới `contextual`.
 */
export function exitAction(role: Role, screenHome: string, contextual?: string): ExitAction {
  if (ROLE_HOME[role] === screenHome) return { kind: 'signOut' }
  if (contextual && can(role, 'trips.view')) return { kind: 'link', to: contextual }
  return { kind: 'link', to: ROLE_HOME[role] }
}
