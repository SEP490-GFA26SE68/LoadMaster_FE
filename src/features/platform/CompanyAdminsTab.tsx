import {
  Building2,
  Calendar,
  Coins,
  CreditCard,
  Eye,
  Key,
  Lock,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Unlock,
  UserCheck,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type DataTableColumns } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { useFormat } from '@/lib/i18n'
import type { CompanyAdminUser } from './company-admins-api'
import {
  useCompanyAdminsQuery,
  useUpdateCompanyAdminMutation,
  useUpdateCompanyAdminStatusMutation,
} from './useCompanyAdminsQuery'

export function CompanyAdminsTab() {
  const format = useFormat()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL')

  const [viewingAdmin, setViewingAdmin] = useState<CompanyAdminUser | null>(null)
  const [editingAdmin, setEditingAdmin] = useState<CompanyAdminUser | null>(null)

  const query = useCompanyAdminsQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    size: pageSize,
  })

  const updateMutation = useUpdateCompanyAdminMutation()
  const statusMutation = useUpdateCompanyAdminStatusMutation()

  const rows = useMemo(() => query.data?.items ?? [], [query.data])
  const totalCount = useMemo(() => query.data?.totalElements ?? rows.length, [query.data, rows.length])

  const columns = useMemo<DataTableColumns<CompanyAdminUser>>(() => [
    {
      id: 'admin',
      header: 'Chủ tài khoản',
      meta: { width: '24%' },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
          <span className="line-clamp-1 font-semibold text-ink-strong">{row.original.fullName}</span>
          <span className="line-clamp-1 text-caption text-primary">{row.original.email}</span>
        </div>
      ),
    },
    {
      id: 'phone',
      header: 'Số điện thoại',
      meta: { width: '14%' },
      cell: ({ row }) => (
        <span className="text-small text-ink-2 font-mono">
          {row.original.phoneNumber || '—'}
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Doanh nghiệp đại diện',
      meta: { width: '22%' },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
          <span className="line-clamp-1 font-medium text-ink-strong">{row.original.companyName || '—'}</span>
          {row.original.companyCode && (
            <span className="font-mono text-caption text-ink-3">#{row.original.companyCode}</span>
          )}
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Gói hiện tại',
      meta: { width: '18%' },
      cell: ({ row }) => {
        if (!row.original.planName) {
          return <span className="text-caption text-ink-3">Chưa có gói</span>
        }
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-small font-medium text-ink-1">{row.original.planName}</span>
            {row.original.planTier && (
              <Badge tone="cyan" shape="tag">
                {row.original.planTier}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'credits',
      header: 'Số dư Credits',
      meta: { align: 'right', width: '14%' },
      cell: ({ row }) => (
        <span className="font-mono text-small font-bold text-amber-600 tabular-nums">
          {format.integer(row.original.creditBalance ?? 0)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: '12%' },
      cell: ({ row }) => {
        const isLocked = row.original.status === 'LOCKED'
        return (
          <Badge tone={isLocked ? 'danger' : 'success'} dot="solid">
            {isLocked ? 'Đã khóa' : 'Hoạt động'}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: 'Thao tác',
      meta: { align: 'right', width: '110px' },
      cell: ({ row }) => {
        const admin = row.original
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Xem chi tiết ${admin.fullName}`}
              onClick={() => setViewingAdmin(admin)}
            >
              <Eye strokeWidth={1.5} className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Chỉnh sửa ${admin.fullName}`}
              onClick={() => setEditingAdmin(admin)}
            >
              <Pencil strokeWidth={1.5} className="size-4" />
            </Button>
          </div>
        )
      },
    },
  ], [format])

  const isFiltering = Boolean(search || statusFilter !== 'ALL')

  return (
    <div className="flex flex-col gap-4">
      {query.isPending ? (
        <div role="status" aria-label="Đang tải danh sách..." className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : query.isError ? (
        <EmptyState
          mascot="error"
          title="Lỗi tải danh sách chủ tài khoản"
          description="Không thể kết nối đến máy chủ hoặc bạn chưa được phân quyền truy cập danh sách quản trị viên."
          action={{
            label: 'Thử lại',
            onClick: () => query.refetch(),
          }}
        />
      ) : rows.length === 0 && !isFiltering ? (
        <EmptyState
          mascot="empty"
          title="Chưa có tài khoản quản trị doanh nghiệp"
          description="Khi các công ty được kích hoạt và phân quyền Company Admin, thông tin tài khoản sẽ hiển thị tại đây."
        />
      ) : (
        <Card className="relative flex-none overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input
                  type="search"
                  placeholder="Tìm theo họ tên, email, công ty..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(0)
                  }}
                  className="pl-9"
                />
              </div>

              <div className="w-44">
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val as any)
                    setPage(0)
                  }}
                >
                  <SelectTrigger aria-label="Lọc trạng thái tài khoản">
                    <SelectValue placeholder="Tất cả trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                    <SelectItem value="ACTIVE">Hoạt động</SelectItem>
                    <SelectItem value="LOCKED">Đã khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isFiltering && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('ALL')
                    setPage(0)
                  }}
                >
                  Xóa lọc
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => query.refetch()}
                loading={query.isFetching}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                Làm mới
              </Button>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={rows}
            getRowId={(row) => String(row.id)}
            density="spacious"
            appearance="paper"
            pagination={{
              pageIndex: page,
              pageSize,
              onPageChange: setPage,
              onPageSizeChange: (s) => {
                setPageSize(s)
                setPage(0)
              },
            }}
            serverPagination
            totalRows={totalCount}
            isFiltering={isFiltering}
          />
        </Card>
      )}

      {/* View Details Dialog */}
      {viewingAdmin && (
        <ViewAdminDetailsDialog
          admin={viewingAdmin}
          open={Boolean(viewingAdmin)}
          onClose={() => setViewingAdmin(null)}
          onEdit={() => {
            const item = viewingAdmin
            setViewingAdmin(null)
            setEditingAdmin(item)
          }}
        />
      )}

      {/* Edit Admin Dialog */}
      {editingAdmin && (
        <EditAdminDialog
          admin={editingAdmin}
          open={Boolean(editingAdmin)}
          onClose={() => setEditingAdmin(null)}
          onSave={async (data) => {
            try {
              if (
                data.fullName !== editingAdmin.fullName ||
                data.phoneNumber !== editingAdmin.phoneNumber ||
                (data.companyId !== undefined && data.companyId !== editingAdmin.companyId)
              ) {
                await updateMutation.mutateAsync({
                  id: editingAdmin.id,
                  data: {
                    fullName: data.fullName,
                    phoneNumber: data.phoneNumber,
                    companyId: data.companyId,
                  },
                })
              }
              if (data.status !== editingAdmin.status) {
                await statusMutation.mutateAsync({
                  id: editingAdmin.id,
                  status: data.status,
                })
              }
              toast.success(`Cập nhật thông tin tài khoản ${data.fullName} thành công!`)
              setEditingAdmin(null)
            } catch (err: any) {
              toast.error(err.message || 'Lỗi khi cập nhật tài khoản')
            }
          }}
          isLoading={updateMutation.isPending || statusMutation.isPending}
        />
      )}
    </div>
  )
}

function ViewAdminDetailsDialog({
  admin,
  open,
  onClose,
  onEdit,
}: {
  admin: CompanyAdminUser
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const format = useFormat()
  const isLocked = admin.status === 'LOCKED'

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-170 max-w-full overflow-y-auto rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck className="size-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-h3 font-bold text-ink-strong">{admin.fullName}</h2>
                  <Badge tone={isLocked ? 'danger' : 'success'} dot="solid">
                    {isLocked ? 'Đã khóa' : 'Hoạt động'}
                  </Badge>
                </div>
                <span className="text-small text-ink-3">Chủ tài khoản Quản trị Doanh nghiệp (Company Admin)</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Section 1: Thông tin cá nhân & Tài khoản */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center gap-2 border-b border-line-soft pb-2.5">
              <UserCheck className="size-4 text-primary" />
              <span className="text-small font-bold text-ink-strong">1. Thông tin Chủ tài khoản</span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Họ và tên:</span>
                <span className="font-semibold text-ink-strong">{admin.fullName}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Email đăng nhập:</span>
                <span className="flex items-center gap-1.5 text-primary">
                  <Mail className="size-3.5" />
                  {admin.email}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Số điện thoại:</span>
                <span className="flex items-center gap-1.5 font-mono text-ink-1">
                  <Phone className="size-3.5" />
                  {admin.phoneNumber || 'Chưa cung cấp'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Ngày tạo tài khoản:</span>
                <span className="flex items-center gap-1.5 text-ink-2">
                  <Calendar className="size-3.5" />
                  {admin.createdAt ? format.date(admin.createdAt) : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Doanh nghiệp đứng tên */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center gap-2 border-b border-line-soft pb-2.5">
              <Building2 className="size-4 text-primary" />
              <span className="text-small font-bold text-ink-strong">2. Doanh nghiệp đứng tên đại diện</span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Tên công ty:</span>
                <span className="font-semibold text-ink-strong">{admin.companyName || 'Chưa liên kết'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Mã công ty:</span>
                <span className="font-mono text-ink-1">{admin.companyCode || '—'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Mã số thuế:</span>
                <span className="font-mono text-ink-1">{admin.taxCode || 'Chưa cập nhật'}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Gói cước hiện tại & Credits */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <span className="text-small font-bold text-ink-strong">3. Gói cước & Credits khả dụng</span>
              </div>
              {admin.planTier && <Badge tone="cyan" shape="tag">{admin.planTier}</Badge>}
            </div>
            {admin.planName ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Tên gói dịch vụ:</span>
                  <span className="font-semibold text-ink-strong">{admin.planName}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Số dư Credits khả dụng:</span>
                  <span className="flex items-center gap-1.5 font-mono text-base font-bold text-amber-600">
                    <Coins className="size-4 text-amber-500" />
                    {format.integer(admin.creditBalance ?? 0)} credits
                  </span>
                </div>
                {admin.subscriptionExpiresAt && (
                  <div className="col-span-full flex items-center gap-1.5 text-caption text-ink-2">
                    <Calendar className="size-3.5 text-ink-3" />
                    <span>Hạn sử dụng gói: {format.date(admin.subscriptionExpiresAt)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-2 text-center text-caption text-ink-3">
                Doanh nghiệp hiện chưa đăng ký gói cước dịch vụ.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-line-soft bg-surface/50 px-6 py-4">
          <Button variant="secondary" onClick={onEdit}>
            <Pencil className="mr-1.5 size-4" />
            Chỉnh sửa tài khoản
          </Button>
          <DialogClose asChild>
            <Button variant="primary">Đóng</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditAdminDialog({
  admin,
  open,
  onClose,
  onSave,
  isLoading,
}: {
  admin: CompanyAdminUser
  open: boolean
  onClose: () => void
  onSave: (data: { fullName: string; phoneNumber?: string; status: 'ACTIVE' | 'LOCKED'; companyId?: number }) => Promise<void>
  isLoading: boolean
}) {
  const [fullName, setFullName] = useState(admin.fullName)
  const [phoneNumber, setPhoneNumber] = useState(admin.phoneNumber || '')
  const [status, setStatus] = useState<'ACTIVE' | 'LOCKED'>(admin.status)
  const [companyId, setCompanyId] = useState<number | undefined>(admin.companyId ?? undefined)

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-130 max-w-full rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Pencil className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-h3 font-bold text-ink-strong">Chỉnh sửa Chủ tài khoản</h2>
              <span className="text-small text-ink-3">Tài khoản: {admin.email}</span>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            await onSave({ fullName: fullName.trim(), phoneNumber: phoneNumber.trim() || undefined, status, companyId })
          }}
          className="flex flex-col gap-4 px-6 py-5"
        >
          <div className="flex flex-col gap-1.5">
            <label className="text-small font-semibold text-ink-strong">Họ và tên *</label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nhập họ và tên đầy đủ..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-small font-semibold text-ink-strong">Số điện thoại</label>
            <Input
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Nhập số điện thoại liên hệ..."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-small font-semibold text-ink-strong">Doanh nghiệp đại diện</label>
            <div className="rounded-lg border border-line-soft bg-surface/50 px-3 py-2 text-small text-ink-1">
              <span className="font-medium text-ink-strong">{admin.companyName || 'Chưa gán doanh nghiệp'}</span>
              {admin.companyCode && (
                <span className="ml-2 font-mono text-caption text-ink-3">#{admin.companyCode}</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-small font-semibold text-ink-strong">Trạng thái tài khoản</label>
            <Select value={status} onValueChange={(val) => setStatus(val as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">
                  <span className="flex items-center gap-2 text-success">
                    <Unlock className="size-4" />
                    Hoạt động (Active)
                  </span>
                </SelectItem>
                <SelectItem value="LOCKED">
                  <span className="flex items-center gap-2 text-danger">
                    <Lock className="size-4" />
                    Đã khóa (Locked)
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <span className="text-fine text-ink-3">
              Khóa tài khoản sẽ ngăn người dùng này đăng nhập vào hệ thống quản trị công ty.
            </span>
          </div>

          <DialogFooter className="mt-4 flex items-center justify-end gap-2 border-t border-line-soft pt-4">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
              Hủy
            </Button>
            <Button variant="primary" type="submit" loading={isLoading}>
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
