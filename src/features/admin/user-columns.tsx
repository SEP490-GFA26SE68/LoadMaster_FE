import { createColumnHelper, type CellContext } from '@tanstack/react-table'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useT, type TFunction } from '@/lib/i18n'
import type { User } from '@/types/user'
import { accountGuards } from './account-guards'
import { LastActive, RoleLabel, UserAvatar, UserCompany, UserDepot, UserStatusBadge } from './user-look'
import { UserRowMenu } from './UserRowMenu'
import { useUsersTable } from './users-table-context'

const helper = createColumnHelper<BaseTableFeatures, User>()
type Cell<TValue> = CellContext<BaseTableFeatures, User, TValue>

/** Mã phần tử của nút mở panel ở tên người dùng: đóng panel thì trả con trỏ về đây. */
export function userOpenButtonId(userId: string) {
  return `user-open-${userId}`
}

/*
 * Hàm `cell`/`header` khai ở mức module để giữ nguyên giữa các lần dựng cột: TanStack Table v9 dựng chúng như component, hàm mới là
 * gỡ và gắn lại ô (xem `users-table-context.ts`). Dữ liệu thay đổi (người đang chọn, danh sách, thao tác) đọc qua context.
 */

function NameCell({ user }: { user: User }) {
  const { selectedId, onSelect, panelId } = useUsersTable()
  const selected = user.id === selectedId
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <UserAvatar fullName={user.fullName} status={user.status} />
      <span className="flex min-w-0 flex-col items-start whitespace-normal">
        {/* Dòng mở panel bằng chuột; nút ở tên cho bàn phím (AGENTS mục 10). Chặn nổi bọt để dòng không bật/tắt lần hai. */}
        <button
          type="button"
          id={userOpenButtonId(user.id)}
          aria-pressed={selected}
          aria-controls={selected ? panelId : undefined}
          onClick={(event) => { event.stopPropagation(); onSelect(user) }}
          className="cursor-pointer rounded-sm text-left font-medium text-ink-strong hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span className="line-clamp-2">{user.fullName}</span>
        </button>
        {/* Khoảng trắng không hiện trong flex nhưng tách tên và email trong tên truy cập của dòng */}
        {' '}
        <span className="max-w-full font-mono text-caption text-ink-3 wrap-anywhere">{user.email}</span>
      </span>
    </span>
  )
}

function ActionsCell({ user }: { user: User }) {
  const { users, viewer, onAction } = useUsersTable()
  return <UserRowMenu user={user} guards={accountGuards(user, viewer, users)} onAction={onAction} />
}

function CompanyCell({ user }: { user: User }) {
  return <UserCompany companyId={user.companyId} companyName={user.companyName} className="line-clamp-2 whitespace-normal" />
}

function ActionsHeader() {
  const t = useT()
  return <span className="sr-only">{t('admin.users.columns.actions')}</span>
}

const nameCell = (info: Cell<string>) => <NameCell user={info.row.original} />
const phoneCell = (info: Cell<string>) => <span className="font-mono text-caption text-ink-1">{info.getValue()}</span>
const roleCell = (info: Cell<string>) => <RoleLabel role={info.row.original.role} />
const companyCell = (info: Cell<string | undefined>) => <CompanyCell user={info.row.original} />
const depotCell = (info: Cell<string | undefined>) => <UserDepot value={info.getValue()} className="line-clamp-2 whitespace-normal" />
const lastActiveCell = (info: Cell<string | null>) => <LastActive value={info.getValue()} />
const statusCell = (info: Cell<User['status']>) => <UserStatusBadge status={info.getValue()} />
const actionsCell = (info: Cell<unknown>) => <ActionsCell user={info.row.original} />

/**
 * Cột bảng người dùng (LM-092, V2): Người dùng (chữ viết tắt, tên, email) · Điện thoại · Vai trò · Kho / chi nhánh · Hoạt động gần
 * nhất · Trạng thái · menu. Vai trò sắp theo tên hiển thị của ngôn ngữ đang chọn; hoạt động gần nhất bấm lần đầu là mới nhất trước.
 * Cột cuối là menu thao tác, chặn trước thao tác kho sẽ từ chối (`accountGuards`).
 * Panel chi tiết (V2): bấm dòng để mở; tên là nút bật/tắt cho bàn phím (`aria-pressed`). Panel đang mở thì bỏ cột Điện thoại —
 * số điện thoại đã nằm trong panel — và cột kho hẹp lại, để bảng đủ chỗ cho tên và email ở 1.366 px.
 * Cột Công ty (FE-0-08) chỉ có khi người xem là quản trị hệ thống (`showCompany`), đứng sau Vai trò; panel mở thì cũng nhường chỗ —
 * công ty đã nằm trong panel. Tên công ty đọc qua context (về sau từ kho) nên cột không sắp xếp; lọc theo công ty ở thanh lọc.
 * Chỉ dựng lại khi đổi ngôn ngữ, đổi tập cột hoặc panel đóng/mở; hàm ô giữ nguyên nên các ô còn lại không bị gắn lại.
 */
export function userColumns(t: TFunction, { panelOpen, showCompany }: { panelOpen: boolean; showCompany: boolean }) {
  return helper.columns([
    helper.accessor('fullName', { header: t('admin.users.columns.user'), enableSorting: true, cell: nameCell }),
    ...(panelOpen ? [] : [helper.accessor('phone', {
      header: t('admin.users.columns.phone'),
      meta: { width: '136px' } satisfies ColumnMeta,
      cell: phoneCell,
    })]),
    helper.accessor((user) => t(`roles.${user.role}`), {
      id: 'role',
      header: t('admin.users.columns.role'),
      enableSorting: true,
      meta: { width: '172px' } satisfies ColumnMeta,
      cell: roleCell,
    }),
    ...(showCompany && !panelOpen ? [helper.accessor('companyId', {
      header: t('admin.users.columns.company'),
      meta: { width: '168px' } satisfies ColumnMeta,
      cell: companyCell,
    })] : []),
    helper.accessor('depot', {
      header: t('admin.users.columns.depot'),
      enableSorting: true,
      // Panel mở thì hẹp lại (kho dài xuống hai dòng) để email ở cột đầu không bị bẻ giữa chừng ở 1.366 px
      meta: { width: panelOpen ? '172px' : '196px' } satisfies ColumnMeta,
      cell: depotCell,
    }),
    helper.accessor('lastActiveAt', {
      header: t('admin.users.columns.lastActive'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { align: 'right', width: '176px' } satisfies ColumnMeta,
      cell: lastActiveCell,
    }),
    helper.accessor('status', {
      header: t('admin.users.columns.status'),
      meta: { width: '144px' } satisfies ColumnMeta,
      cell: statusCell,
    }),
    helper.display({
      id: 'actions',
      header: ActionsHeader,
      meta: { align: 'right', width: '64px' } satisfies ColumnMeta,
      cell: actionsCell,
    }),
  ])
}
