import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { DataTable } from '@/components/DataTable'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { useListUrlState } from '@/components/useListUrlState'
import { useT } from '@/lib/i18n'
import { matchesQuery } from '@/lib/list-filter'
import { rolesInScope, userScopeOf } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { ROLES, USER_STATUSES, type User } from '@/types/user'
import { accountGuards } from './account-guards'
import { userColumns, userOpenButtonId } from './user-columns'
import { UserDetailPanel } from './UserDetailPanel'
import type { UserAction } from './UserRowMenu'
import { UsersSummary } from './UsersSummary'
import type { CompanyName } from './useUsersQuery'
import { UsersTableContext } from './users-table-context'

/** Bộ lọc trên URL (D-52), tiếng Việt không dấu. */
const ROLE_FILTER = 'vai-tro'
const STATUS_FILTER = 'trang-thai'
const COMPANY_FILTER = 'cong-ty'
const FILTERS = [ROLE_FILTER, STATUS_FILTER] as const
/** Quản trị hệ thống lọc thêm theo công ty (FE-0-08): mã công ty, hoặc `nen-tang` cho tài khoản không thuộc công ty nào. */
const PLATFORM_FILTERS = [...FILTERS, COMPANY_FILTER] as const
type UsersFilter = (typeof PLATFORM_FILTERS)[number]
const PLATFORM_ACCOUNTS = 'nen-tang'
const NO_COMPANIES: readonly CompanyName[] = []

/**
 * Tab "Tài khoản" (LM-092), bố cục V2: ba ô số liệu (hai ô trạng thái bấm để lọc), rồi một thẻ gồm thanh tìm/lọc và bảng.
 * Tìm theo tên, email, số điện thoại (có hay không có khoảng trắng), mã, kho; lọc vai trò và trạng thái; sắp xếp, phân trang —
 * trạng thái nằm trên URL. Mặc định sắp theo tên.
 *
 * Panel chi tiết (V2): bấm một dòng (hoặc nút ở tên) mở panel bên phải bảng, bấm dòng khác thì đổi người, bấm lại dòng đang chọn,
 * nút đóng hoặc Esc thì đóng — như panel kiện ở Chi tiết chuyến, lựa chọn là state tại chỗ, không lên URL. Panel bám theo mã người
 * dùng: lọc hay sắp xếp làm dòng đi đâu thì panel vẫn giữ (như panel kiện khi lọc theo điểm giao); người đó bị xoá thì panel đóng.
 *
 * Phạm vi (FE-0-08): `users` là danh sách kho trả cho `viewer`. Quản trị hệ thống thấy mọi tài khoản nên có thêm cột Công ty và bộ lọc
 * công ty (`cong-ty` trên URL, hàng lọc thứ hai); quản trị công ty chỉ thấy người của công ty mình, bộ lọc vai trò chỉ còn vai trò
 * công ty.
 */
export function UsersTable({ users, viewer, companies = NO_COMPANIES, onAction }: {
  users: readonly User[]
  viewer: User | null
  /** Tên các công ty; chỉ truyền khi người xem là quản trị hệ thống. */
  companies?: readonly CompanyName[]
  onAction: (action: UserAction, user: User) => void
}) {
  const t = useT()
  const panelId = useId()
  const platform = viewer !== null && userScopeOf(viewer.role) === 'platform'
  const list = useListUrlState<UsersFilter>({
    filters: platform ? PLATFORM_FILTERS : FILTERS,
    defaultSort: { id: 'fullName', desc: false },
  })
  const { [ROLE_FILTER]: role, [STATUS_FILTER]: status } = list.filters
  const company = platform ? list.filters[COMPANY_FILTER] : ''
  const companyNames = useMemo(() => new Map(companies.map((item) => [item.id, item.name])), [companies])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = users.find((user) => user.id === selectedId) ?? null
  const openId = selected?.id ?? null
  // Đóng panel thì con trỏ về nút tên của dòng đó — sau khi React đã vẽ xong bảng có lại cột Điện thoại.
  const focusAfterClose = useRef<string | null>(null)
  useEffect(() => {
    if (openId !== null || focusAfterClose.current === null) return
    document.getElementById(userOpenButtonId(focusAfterClose.current))?.focus()
    focusAfterClose.current = null
  }, [openId])
  const close = useCallback((id: string) => {
    focusAfterClose.current = id
    setSelectedId(null)
  }, [])
  // Bấm lại dòng đang chọn thì đóng, như bảng kiện ở Chi tiết chuyến
  const toggle = useCallback((user: User) => (user.id === openId ? close(user.id) : setSelectedId(user.id)), [openId, close])

  // Cột chỉ theo ngôn ngữ và panel đóng/mở — không theo dữ liệu: dựng lại cột là gắn lại mọi ô (users-table-context.ts)
  const panelOpen = openId !== null
  const columns = useMemo(() => userColumns(t, { panelOpen, showCompany: platform }), [t, panelOpen, platform])
  const cellContext = useMemo(
    () => ({ users, viewer, companies: companyNames, onAction, selectedId: openId, onSelect: toggle, panelId }),
    [users, viewer, companyNames, onAction, openId, toggle, panelId],
  )
  const rows = useMemo(() => users.filter((user) =>
    matchesQuery([user.fullName, user.email, user.phone, user.phone.replace(/\s/g, ''), user.id, user.depot], list.query)
    && (role === '' || user.role === role)
    && (status === '' || user.status === status)
    && (company === '' || (company === PLATFORM_ACCOUNTS ? user.companyId === undefined : user.companyId === company))),
  [users, list.query, role, status, company])
  // Quản trị công ty chỉ có người mang vai trò công ty: ô lọc vai trò không mời chọn vai trò không bao giờ có dòng nào
  const fields: FilterField<UsersFilter>[] = [
    {
      kind: 'select', name: ROLE_FILTER, label: t('admin.users.filters.role'), allLabel: t('admin.users.filters.allRoles'),
      options: (platform ? ROLES : rolesInScope('company')).map((value) => ({ value, label: t(`roles.${value}`) })),
    },
    {
      kind: 'select', name: STATUS_FILTER, label: t('admin.users.filters.status'), allLabel: t('admin.users.filters.allStatuses'),
      options: USER_STATUSES.map((value) => ({ value, label: t(`admin.users.status.${value}`) })),
    },
  ]
  if (platform) {
    fields.push({
      kind: 'select', name: COMPANY_FILTER, label: t('admin.users.filters.company'), allLabel: t('admin.users.filters.allCompanies'),
      options: [...companies.map(({ id, name }) => ({ value: id, label: name })), { value: PLATFORM_ACCOUNTS, label: t('admin.users.platformAccount') }],
      secondary: true,
    })
  }

  /** Esc đóng panel, trừ khi một lớp nổi (menu, ô chọn) đã dùng phím đó để tự đóng, hoặc con trỏ đang ở ô nhập. */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.defaultPrevented || openId === null) return
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
    close(openId)
  }

  return (
    <div className="flex flex-col gap-4">
      <UsersSummary users={users} status={status} onStatusChange={(value) => list.setFilter(STATUS_FILTER, value)} />
      {/* items-start để panel dính (sticky) được trong vùng cuộn của tab. Panel 304 px: ở 1.366 px bảng còn ~990 px — đủ cho mọi cột
          trừ Điện thoại (ẩn khi panel mở) mà email seed không bị bẻ dòng. Dưới 1.280 px panel xuống dưới bảng. */}
      <div
        onKeyDown={handleKeyDown}
        className={cn('grid flex-none items-start gap-5', selected && 'xl:grid-cols-[minmax(0,1fr)_304px]')}
      >
        {/* Một thẻ: thanh tìm/lọc là đầu thẻ, bảng ngay dưới (V2). min-w-0: cột lưới không nở theo bảng; relative: ô ẩn định vị
            tuyệt đối của Radix Select không thoát khung. */}
        <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-bg">
          <FilterBar
            layout="toolbar"
            className="min-h-14 border-b border-border px-4 py-2"
            query={list.query}
            onQueryChange={list.setQuery}
            searchLabel={t('admin.users.search')}
            fields={fields}
            values={list.filters}
            onValueChange={list.setFilter}
            onClear={list.clearAll}
          />
          <UsersTableContext value={cellContext}>
            <DataTable
              data={rows}
              columns={columns}
              getRowId={(user) => user.id}
              density="spacious"
              appearance="paper"
              onRowClick={toggle}
              isRowSelected={(user) => user.id === openId}
              sorting={list.sorting}
              onSortingChange={list.setSorting}
              pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
              emptyMessage={t('admin.users.empty')}
              isFiltering={list.isFiltering}
              onClearFilters={list.clearAll}
              noMatchMessage={t('admin.users.noMatch')}
            />
          </UsersTableContext>
        </section>
        {selected ? (
          <UserDetailPanel
            key={selected.id}
            id={panelId}
            user={selected}
            guards={accountGuards(selected, viewer, users)}
            company={platform ? { id: selected.companyId, name: selected.companyId === undefined ? undefined : companyNames.get(selected.companyId) } : undefined}
            onAction={onAction}
            onClose={() => close(selected.id)}
          />
        ) : null}
      </div>
    </div>
  )
}
