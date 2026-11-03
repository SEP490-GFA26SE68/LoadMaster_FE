import { Box, Building2, ClipboardList, CreditCard, Inbox, LayoutDashboard, Layers, LifeBuoy, MapPinned, Package, ScrollText, Tablet, Truck, Users, Warehouse } from 'lucide-react'
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
  dashboard: { to: '/tong-quan', labelKey: 'nav.dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  trips: { to: '/chuyen', labelKey: 'nav.trips', icon: Truck, permission: 'trips.view' },
  // Giám sát chuyến Đang vận chuyển (FE-6-10)
  monitoring: { to: '/giam-sat', labelKey: 'nav.monitoring', icon: MapPinned, permission: 'monitoring.view' },
  // Loại kiện và In nhãn mở từ màn Kho kiện, không có mục riêng
  packages: { to: '/kien-hang', labelKey: 'nav.packages', icon: Package, permission: 'packages.view' },

  warehouseCustomers: {
    to: '/kho-khach-hang',
    labelKey: 'nav.customers',
    icon: Users,
    permission: 'warehouse.operate',
  },
  requirements: { to: '/yeu-cau-giao', labelKey: 'nav.requirements', icon: ClipboardList, permission: 'requirements.view' },
  // Loại xe mở từ màn Đội xe
  fleet: { to: '/doi-xe', labelKey: 'nav.fleet', icon: Warehouse, permission: 'fleet.view' },
  companyWarehouses: {
    to: '/quan-ly-kho',
    labelKey: 'companyWarehouses.title',
    icon: Warehouse,
    permission: 'companyWarehouses.manage',
  },
  // Công ty: quản trị hệ thống (FE-8-06)
  companies: { to: '/nen-tang/cong-ty', labelKey: 'nav.companies', icon: Building2, permission: 'companies.manage' },
  // Hỗ trợ: Hỗ trợ khách hàng (FE-8-07)
  support: { to: '/ho-tro', labelKey: 'nav.support', icon: LifeBuoy, permission: 'support.handle' },
  // Liên hệ của khách gửi từ trang giới thiệu công khai: ba vai trò nền tảng
  contacts: { to: '/lien-he-khach', labelKey: 'nav.contacts', icon: Inbox, permission: 'contacts.handle' },
  users: { to: '/nguoi-dung', labelKey: 'nav.users', icon: Users, permission: 'users.manage' },
  // Gói cước: quản lý nền tảng quản lý danh mục gói (FE-8-02); quản trị công ty xem gói và credit của công ty (FE-8-03)
  plans: { to: '/nen-tang/goi', labelKey: 'nav.plans', icon: Layers, permission: 'subscriptionPlans.manage' },
  // Lịch sử gói cước đã thêm/kích hoạt
  subscriptionHistory: { to: '/nen-tang/lich-su-goi', labelKey: 'nav.subscriptionHistory', icon: ScrollText, permission: 'subscriptionPlans.manage' },
  // Đơn yêu cầu tạo tài khoản dùng thử
  trialRequests: { to: '/nen-tang/yeu-cau-dung-thu', labelKey: 'nav.trialRequests', icon: ClipboardList, permission: 'trialRequests.manage' },
  billing: { to: '/goi-cuoc', labelKey: 'nav.billing', icon: CreditCard, permission: 'billing.manage' },
  audit: { to: '/nhat-ky', labelKey: 'nav.audit', icon: ScrollText, permission: 'audit.view' },
  warehouse: { to: '/kho', labelKey: 'nav.warehouse', icon: Tablet, permission: 'warehouse.operate' },
  driver: { to: '/tai-xe', labelKey: 'nav.driver', icon: Box, permission: 'driver.operate' },
} as const satisfies Record<string, NavScreen>

export type NavScreenId = keyof typeof NAV_SCREENS

/**
 * Mục điều hướng của từng vai trò, theo thứ tự của vai trò đó (FE-0-04): màn chính của vai trò đứng đầu. Danh sách là phần chọn lọc
 * và thứ tự; quyền vẫn là cổng — `navItemsFor` bỏ mục vai trò không còn quyền mở.
 *
 * - Quản trị hệ thống: Công ty (FE-8-06) · Người dùng · Nhật ký · Liên hệ của khách · Đơn dùng thử.
 *   Quản lý nền tảng: Gói cước (FE-8-02) · Công ty · Đơn dùng thử · Lịch sử gói. Hỗ trợ khách hàng: Hỗ trợ (FE-8-07) · Liên hệ của khách.
 */
export const NAV_ITEMS: Readonly<Record<Role, readonly NavScreenId[]>> = {
  systemAdmin: ['companies', 'users', 'audit', 'contacts', 'trialRequests', 'subscriptionHistory'],
  systemManager: ['plans', 'subscriptionHistory', 'companies', 'trialRequests'],
  systemSupporter: ['support', 'contacts'],
  companyAdmin: ['users', 'audit', 'billing'],
  companyManager: ['dashboard', 'requirements', 'packages', 'trips', 'monitoring', 'fleet','companyWarehouses'],
  dispatcher: ['trips', 'monitoring', 'packages', 'requirements', 'fleet', 'dashboard'],
  warehouse: ['warehouse', 'packages', 'warehouseCustomers'],
  driver: ['driver'],
}

/** Mục điều hướng `role` thấy: danh sách của vai trò, bỏ mục vai trò không có quyền mở. */
export function navItemsFor(role: Role): readonly NavScreen[] {
  const ids = NAV_ITEMS[role] ?? []

  return ids
    .map((id): NavScreen => NAV_SCREENS[id])
    .filter((screen) => can(role, screen.permission))
}

/** Đích của logo: bảng điều khiển khi vai trò xem được, không thì màn chính của vai trò — không bao giờ là màn 403. */
export function logoPath(role: Role | undefined): string {
  return role === undefined || can(role, 'dashboard.view') ? '/tong-quan' : ROLE_HOME[role]
}
