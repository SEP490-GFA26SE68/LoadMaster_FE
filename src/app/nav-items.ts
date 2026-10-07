import { Box, ClipboardList, LayoutDashboard, Layers, MapPinned, Package, ScrollText, Tablet, Truck, Users, Warehouse } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ROLE_HOME } from '@/features/auth/landing'
import { can, type Permission } from '@/features/auth/permissions'
import type { MessageKey } from '@/lib/i18n'
import type { Role } from '@/types/user'

export type NavScreen = {
  readonly to: string
  readonly labelKey: MessageKey
  readonly icon: LucideIcon
  /** Quyền của route đích trong `App.tsx` (D-41): mục chỉ hiện khi người đăng nhập mở được màn đó. */
  readonly permission: Permission
}

/**
 * Các màn có mục trên thanh điều hướng — chỉ màn **đang có** route (D-20). Màn của sprint sau (Công ty, Hỗ trợ)
 * thêm một dòng ở đây và mã của nó vào `NAV_ITEMS` của vai trò, trong chính issue làm màn đó.
 */
export const NAV_SCREENS = {
  dashboard: { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  trips: { to: '/chuyen', labelKey: 'nav.trips', icon: Truck, permission: 'trips.view' },
  // Giám sát chuyến Đang vận chuyển (FE-6-10)
  monitoring: { to: '/giam-sat', labelKey: 'nav.monitoring', icon: MapPinned, permission: 'monitoring.view' },
  // Loại kiện và In nhãn mở từ màn Kho kiện, không có mục riêng
  packages: { to: '/kien-hang', labelKey: 'nav.packages', icon: Package, permission: 'packages.view' },
  requirements: { to: '/yeu-cau-giao', labelKey: 'nav.requirements', icon: ClipboardList, permission: 'requirements.view' },
  // Loại xe mở từ màn Đội xe
  fleet: { to: '/doi-xe', labelKey: 'nav.fleet', icon: Warehouse, permission: 'fleet.view' },
  users: { to: '/nguoi-dung', labelKey: 'nav.users', icon: Users, permission: 'users.manage' },
  // Gói cước: quản lý nền tảng quản lý danh mục gói (FE-8-02)
  plans: { to: '/nen-tang/goi', labelKey: 'nav.plans', icon: Layers, permission: 'subscriptionPlans.manage' },
  audit: { to: '/nhat-ky', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.view' },
  warehouse: { to: '/kho', labelKey: 'nav.warehouse', icon: Tablet, permission: 'warehouse.operate' },
  driver: { to: '/tai-xe', labelKey: 'nav.driver', icon: Box, permission: 'driver.operate' },
} as const satisfies Record<string, NavScreen>

export type NavScreenId = keyof typeof NAV_SCREENS

/**
 * Mục điều hướng của từng vai trò, theo thứ tự của vai trò đó (FE-0-04): màn chính của vai trò đứng đầu. Danh sách là phần chọn lọc
 * và thứ tự; quyền vẫn là cổng — `navItemsFor` bỏ mục vai trò không còn quyền mở.
 *
 * - Quản lý nền tảng: Gói cước (FE-8-02). Hỗ trợ khách hàng: chưa có màn nào (Sprint 8) nên chưa có mục nào.
 * - Quản lý công ty lập yêu cầu giao (FE-4b-02) và xem kho kiện chỉ đọc (FE-3b-03); điều phối viên xem yêu cầu giao để đưa vào chuyến.
 * - Giám sát (FE-6-10) đứng ngay sau Chuyến hàng ở cả hai vai trò: chuyến đang chạy là việc kế tiếp của chuyến đã lập.
 * - Nhân viên kho, tài xế làm việc ở màn toàn màn hình; thanh này chỉ hiện với họ ở màn hồ sơ, mục duy nhất đưa về màn của mình.
 */
export const NAV_ITEMS: Readonly<Record<Role, readonly NavScreenId[]>> = {
  systemAdmin: ['users', 'audit'],
  systemManager: ['plans'],
  systemSupporter: [],
  companyAdmin: ['users', 'audit'],
  manager: ['dashboard', 'requirements', 'packages', 'trips', 'monitoring', 'fleet'],
  dispatcher: ['trips', 'monitoring', 'packages', 'requirements', 'fleet', 'dashboard'],
  warehouse: ['warehouse'],
  driver: ['driver'],
}

/** Mục điều hướng `role` thấy: danh sách của vai trò, bỏ mục vai trò không có quyền mở. */
export function navItemsFor(role: Role): readonly NavScreen[] {
  return NAV_ITEMS[role].map((id): NavScreen => NAV_SCREENS[id]).filter((screen) => can(role, screen.permission))
}

/** Đích của logo: bảng điều khiển khi vai trò xem được, không thì màn chính của vai trò — không bao giờ là màn 403. */
export function logoPath(role: Role | undefined): string {
  return role === undefined || can(role, 'dashboard.view') ? '/' : ROLE_HOME[role]
}
