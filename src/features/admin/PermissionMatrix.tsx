import {
  Check,
  ClipboardList,
  Info,
  LayoutDashboard,
  LifeBuoy,
  Minus,
  Navigation,
  PackagePlus,
  QrCode,
  Radar,
  Route,
  TriangleAlert,
  Truck,
  UserCog,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import { Fragment } from 'react'
import { ROLE_ICON } from '@/components/RoleBadge'
import { can, PERMISSIONS } from '@/features/auth/permissions'
import { useFormat, useT } from '@/lib/i18n'
import { rolesInScope, type UserScope } from '@/lib/mock-db'
import { ROLES, type Role, type User } from '@/types/user'
import { PERMISSION_GROUPS, type PermissionGroupId } from './permission-groups'

const GROUP_ICON: Readonly<Record<PermissionGroupId, LucideIcon>> = {
  administration: UserCog,
  billing: Wallet,
  support: LifeBuoy,
  dashboard: LayoutDashboard,
  requirements: ClipboardList,
  packages: QrCode,
  trips: Route,
  monitoring: Radar,
  fleet: Truck,
  exceptions: TriangleAlert,
  pickups: PackagePlus,
  warehouse: Warehouse,
  driver: Navigation,
}

/**
 * Phần bề rộng bảng (%) chia đều cho các cột vai trò; cột tên quyền nhận phần còn lại. Theo tỷ lệ chứ không px cố định (AGENTS mục 5,
 * LM-095): các cột vai trò vừa 1.366 px không cuộn ngang (FE-0-01, quyết định G13; tám vai trò từ FE-0-06), tên vai trò xuống tối đa
 * hai dòng, và cột tên quyền còn khoảng 370 px cho nhãn dài nhất trong hai dòng.
 */
const ROLE_COLUMNS_SHARE = 72
const ROLE_COLUMN_WIDTH = `${ROLE_COLUMNS_SHARE / ROLES.length}%`

const HEAD_CELL = 'sticky top-0 z-10 h-20 border-b border-border bg-table-head px-2.5 py-2 align-middle text-caption font-semibold text-ink-2'

/**
 * Tab "Ma trận quyền" (LM-092, D-41): chỉ đọc, dựng thẳng từ `ROLE_PERMISSIONS` — cùng hằng số chặn route, nav và nút, nên bảng
 * luôn đúng với những gì giao diện cho phép. V2.3 (`MaTranQuyen.jpg`): đầu thẻ có tiêu đề, kích thước đếm từ `PERMISSIONS` × `ROLES`
 * và chú giải; quyền xếp theo khu vực (`PERMISSION_GROUPS`, giữ nguyên thứ tự của `PERMISSIONS`); ô "có" là ô vuông cyan có dấu tích,
 * ô "không" là gạch xám — cả hai kèm chữ cho trình đọc màn hình; dòng cuối đếm số quyền của từng vai trò.
 *
 * Bảng tự dựng bằng `<table>` chứ không qua `DataTable`: ma trận có dòng nhóm và dòng tổng nằm giữa các dòng dữ liệu, `DataTable` chỉ
 * nhận danh sách dòng phẳng. Tiêu đề cột dính khi cuộn: thẻ cắt góc bằng `overflow-clip` chứ không `overflow-hidden` — cái sau biến
 * thẻ thành khung cuộn và giữ tiêu đề lại trong thẻ (AGENTS mục 5).
 *
 * `users` (danh sách tab Tài khoản đã đọc, theo phạm vi của người xem) cho số tài khoản dưới tên vai trò. Quản trị hệ thống liệt kê được
 * mọi tài khoản nên mọi vai trò có số; quản trị công ty không liệt kê được tài khoản nền tảng — hiện "0" ở ba vai trò đó sẽ như nói
 * chúng không có ai, nên chỉ vai trò công ty có số.
 */
export function PermissionMatrix({ users, scope = 'company' }: { users?: readonly User[]; scope?: UserScope }) {
  const t = useT()
  const format = useFormat()
  const counted = new Set<Role>(users === undefined ? [] : scope === 'platform' ? ROLES : rolesInScope('company'))
  const accountsOf = (role: Role) => (users ?? []).filter((user) => user.role === role).length
  const total = PERMISSIONS.length

  return (
    <section className="relative flex-none overflow-clip rounded-lg border border-border bg-bg">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-3.5 py-3">
        <h2 className="font-display text-h3 font-bold text-ink-strong">{t('admin.permissions.title')}</h2>
        <span className="font-mono text-caption text-ink-3">
          {t('admin.permissions.size', { permissions: format.integer(total), roles: format.integer(ROLES.length) })}
        </span>
        {/* Chú giải: hai kiểu ô của bảng, chữ đúng như chữ thay thế của ô */}
        <span aria-hidden className="ml-auto flex items-center gap-4 text-caption text-ink-2">
          <span className="flex items-center gap-2"><Granted />{t('admin.permissions.granted')}</span>
          <span className="flex items-center gap-2"><Denied />{t('admin.permissions.denied')}</span>
        </span>
      </header>
      <p className="flex items-center gap-2.5 border-b border-border bg-surface px-3.5 py-2.5 text-body text-ink-2">
        <Info aria-hidden className="size-4 flex-none text-ink-3" strokeWidth={1.5} />
        {t('admin.permissions.description')}
      </p>

      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            <th scope="col" className={`${HEAD_CELL} text-left`}>{t('admin.permissions.permission')}</th>
            {ROLES.map((role) => {
              const Icon = ROLE_ICON[role]
              return (
                <th key={role} scope="col" style={{ width: ROLE_COLUMN_WIDTH }} className={`${HEAD_CELL} text-center`}>
                  <span className="flex flex-col items-center gap-0.5 leading-4">
                    <Icon aria-hidden className="size-4 flex-none text-ink-3" strokeWidth={1.5} />
                    <span className="text-balance wrap-break-word">{t(`roles.${role}`)}</span>
                    {counted.has(role) ? (
                      <span className="text-note font-normal text-ink-3">{t('admin.permissions.accountCount', { count: accountsOf(role) })}</span>
                    ) : null}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {PERMISSION_GROUPS.map((group) => {
            const GroupIcon = GROUP_ICON[group.id]
            return (
              <Fragment key={group.id}>
                <tr>
                  <td colSpan={ROLES.length + 1} className="border-b border-border bg-surface px-3.5 py-2">
                    <span className="flex items-center gap-2 text-caption font-semibold text-ink-2">
                      <GroupIcon aria-hidden className="size-3.5 flex-none" strokeWidth={1.5} />
                      {t(`admin.permissions.groups.${group.id}`)}
                    </span>
                  </td>
                </tr>
                {group.permissions.map((permission) => (
                  <tr key={permission} className="h-14 hover:bg-surface">
                    <td className="border-b border-border px-3.5 py-1.5 align-middle">
                      <span className="flex min-w-0 flex-col">
                        <span className="line-clamp-2 text-body font-medium text-ink-strong">{t(`admin.permissions.labels.${permission}`)}</span>
                        <span className="font-mono text-caption text-ink-3">{permission}</span>
                      </span>
                    </td>
                    {ROLES.map((role) => (
                      <td key={role} className="border-b border-border px-2.5 text-center align-middle">
                        {can(role, permission) ? <Granted label={t('admin.permissions.granted')} /> : <Denied label={t('admin.permissions.denied')} />}
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="h-12 bg-surface">
            <th scope="row" className="px-3.5 text-left text-body font-semibold text-ink-strong">{t('admin.permissions.total')}</th>
            {ROLES.map((role) => {
              const count = PERMISSIONS.filter((permission) => can(role, permission)).length
              return (
                <td key={role} className="px-2.5 text-center font-mono text-caption text-ink-3">
                  <span aria-hidden><strong className="text-body font-semibold text-ink-strong">{format.integer(count)}</strong> / {format.integer(total)}</span>
                  <span className="sr-only">{t('admin.permissions.totalOf', { count: format.integer(count), total: format.integer(total) })}</span>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

/** Ô "có": ô vuông nền cyan-50, viền cyan, dấu tích. `label` vắng khi dùng làm chú giải (đã có chữ bên cạnh). */
function Granted({ label }: { label?: string }) {
  return (
    <span className="inline-grid size-5.5 place-items-center rounded-sm border border-cyan-300 bg-cyan-50 text-cyan-700">
      <Check aria-hidden className="size-3.5" strokeWidth={2} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

/** Ô "không": gạch xám nhạt. */
function Denied({ label }: { label?: string }) {
  return (
    <span className="inline-grid size-5.5 place-items-center text-n-400">
      <Minus aria-hidden className="size-4" strokeWidth={1.5} />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}
