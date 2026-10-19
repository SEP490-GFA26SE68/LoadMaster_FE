import { CheckCircle2, Clock, RotateCcw, Search, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { DataTable, type DataTableColumns } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type {
  ApproveTrialAccountRequest,
  RejectTrialAccountRequest,
  TrialAccountRequestResponse,
  TrialRequestStatus,
} from './trial-requests-api'
import {
  useApproveTrialRequestMutation,
  useRejectTrialRequestMutation,
  useTrialRequestsQuery,
} from './useTrialRequestsQuery'

export function TrialRequestsPage() {
  const t = useT()
  const format = useFormat()
  const [pageIndex, setPageIndex] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<TrialRequestStatus | 'ALL'>('ALL')

  const queryParams = useMemo(() => ({
    page: pageIndex,
    size: pageSize,
    search: search.trim() || undefined,
    status: statusFilter,
  }), [pageIndex, pageSize, search, statusFilter])

  const query = useTrialRequestsQuery(queryParams)
  const approveMutation = useApproveTrialRequestMutation()
  const rejectMutation = useRejectTrialRequestMutation()

  const [approvingItem, setApprovingItem] = useState<TrialAccountRequestResponse | null>(null)
  const [rejectingItem, setRejectingItem] = useState<TrialAccountRequestResponse | null>(null)

  const rows = useMemo(() => {
    if (!query.data) return []
    return query.data.data ?? []
  }, [query.data])

  const totalCount = useMemo(() => {
    if (!query.data) return 0
    return query.data.totalElements ?? rows.length
  }, [query.data, rows.length])

  const columns = useMemo<DataTableColumns<TrialAccountRequestResponse>>(() => [
    {
      id: 'id',
      header: 'Mã đơn',
      meta: { width: '80px' },
      cell: ({ row }) => <span className="font-mono text-caption text-ink-3">#{row.original.id}</span>,
    },
    {
      id: 'customer',
      header: 'Khách hàng',
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink-strong">{row.original.fullName}</span>
          <span className="text-caption text-ink-3">{row.original.companyName || 'Cá nhân'}</span>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Thông tin liên hệ',
      cell: ({ row }) => (
        <div className="flex flex-col text-small">
          <span className="text-primary">{row.original.email}</span>
          {row.original.phoneNumber && (
            <span className="font-mono text-caption text-ink-3">{row.original.phoneNumber}</span>
          )}
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Gói quan tâm',
      cell: ({ row }) => (
        <span className="text-small font-medium text-ink-1">
          {row.original.interestedPlanName || 'Chưa chọn gói'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => {
        const status = row.original.status
        if (status === 'APPROVED') {
          return <Badge variant="success">Đã duyệt</Badge>
        }
        if (status === 'REJECTED') {
          return <Badge variant="danger">Đã từ chối</Badge>
        }
        return <Badge variant="warning">Chờ duyệt</Badge>
      },
    },
    {
      id: 'createdAt',
      header: 'Ngày gửi',
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return <span className="text-caption text-ink-3">{format.date(date)} {format.time(date)}</span>
      },
    },
    {
      id: 'actions',
      header: 'Thao tác',
      meta: { align: 'right' },
      cell: ({ row }) => {
        const item = row.original
        if (item.status === 'PENDING') {
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setApprovingItem(item)}
              >
                <CheckCircle2 className="mr-1 size-3.5" />
                Duyệt
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger/10"
                onClick={() => setRejectingItem(item)}
              >
                <XCircle className="mr-1 size-3.5" />
                Từ chối
              </Button>
            </div>
          )
        }
        if (item.status === 'APPROVED') {
          return (
            <span className="text-caption text-success">
              Công ty: {item.createdCompanyName || 'Đã tạo'}
            </span>
          )
        }
        return <span className="text-caption text-ink-3">Đã đóng</span>
      },
    },
  ], [format])

  const showTable = query.isSuccess && (rows.length > 0 || search || statusFilter !== 'ALL')

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={showTable}
        title={t('titles.trialRequests')}
        meta={query.isSuccess ? `${totalCount} yêu cầu` : undefined}
        description="Quản lý và phê duyệt các đơn yêu cầu đăng ký dùng thử từ khách hàng. Phê duyệt sẽ tự động kích hoạt công ty và gửi email xác nhận cho khách."
      />

      <div className={showTable ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div role="status" aria-label="Đang tải dữ liệu..." className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={
              <Button variant="secondary" onClick={() => void query.refetch()}>
                <RotateCcw strokeWidth={1.5} />
                Thử lại
              </Button>
            }
          />
        ) : rows.length === 0 && !search && statusFilter === 'ALL' ? (
          <EmptyState
            mascot="empty"
            title="Chưa có yêu cầu dùng thử"
            description="Các đơn yêu cầu đăng ký tài khoản dùng thử chuyển từ đội hỗ trợ khách hàng sẽ hiển thị tại đây."
          />
        ) : (
          <Card className="relative flex-none overflow-hidden p-4">
            {/* Toolbar search & filter */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[200px] max-w-xs flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                <Input
                  placeholder="Tìm theo tên, email, công ty..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPageIndex(0)
                  }}
                />
              </div>

              <div className="w-48">
                <Select
                  value={statusFilter}
                  onValueChange={(val) => {
                    setStatusFilter(val as TrialRequestStatus | 'ALL')
                    setPageIndex(0)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                    <SelectItem value="PENDING">Chờ duyệt</SelectItem>
                    <SelectItem value="APPROVED">Đã duyệt</SelectItem>
                    <SelectItem value="REJECTED">Đã từ chối</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(search || statusFilter !== 'ALL') && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setStatusFilter('ALL')
                    setPageIndex(0)
                  }}
                >
                  Xóa lọc
                </Button>
              )}
            </div>

            <DataTable
              data={rows}
              columns={columns}
              getRowId={(row) => String(row.id)}
              density="spacious"
              appearance="paper"
              pagination={{
                pageIndex,
                pageSize,
                onPageChange: setPageIndex,
                onPageSizeChange: (newSize) => {
                  setPageSize(newSize)
                  setPageIndex(0)
                },
              }}
              serverPagination
              totalRows={totalCount}
              isFiltering={Boolean(search || statusFilter !== 'ALL')}
            />
          </Card>
        )}
      </div>

      {approvingItem && (
        <ApproveTrialDialog
          item={approvingItem}
          isSubmitting={approveMutation.isPending}
          onClose={() => setApprovingItem(null)}
          onConfirm={async (data) => {
            try {
              await approveMutation.mutateAsync({ id: approvingItem.id, data })
              toast.success(`Đã phê duyệt tài khoản dùng thử cho ${approvingItem.fullName}! Email xác nhận đã được gửi.`)
              setApprovingItem(null)
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
        />
      )}

      {rejectingItem && (
        <RejectTrialDialog
          item={rejectingItem}
          isSubmitting={rejectMutation.isPending}
          onClose={() => setRejectingItem(null)}
          onConfirm={async (data) => {
            try {
              await rejectMutation.mutateAsync({ id: rejectingItem.id, data })
              toast.success(`Đã từ chối yêu cầu dùng thử của ${rejectingItem.fullName}.`)
              setRejectingItem(null)
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
        />
      )}
    </div>
  )
}

function ApproveTrialDialog({
  item,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  item: TrialAccountRequestResponse
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (data: ApproveTrialAccountRequest) => Promise<void>
}) {
  const [companyName, setCompanyName] = useState(
    item.companyName || `Công ty dùng thử ${item.fullName}`
  )
  const [companyCode, setCompanyCode] = useState(
    item.companyCode || `COMP-TRIAL-${Math.floor(1000 + Math.random() * 9000)}`
  )
  const [taxCode, setTaxCode] = useState(
    item.taxCode || `TAX-TRIAL-${Math.floor(10000000 + Math.random() * 90000000)}`
  )
  const [note, setNote] = useState('')

  return (
    <Dialog open onOpenChange={(open) => (!open && !isSubmitting ? onClose() : undefined)}>
      <DialogContent className="w-140">
        <DialogHeader
          title="Duyệt đơn & Tạo công ty dùng thử"
          description={`Phê duyệt yêu cầu cấp tài khoản dùng thử cho khách hàng ${item.fullName} (${item.email}).`}
        />
        <div className="flex flex-col gap-4 py-4">
          <Input
            label="Tên công ty"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mã công ty"
              required
              value={companyCode}
              onChange={(e) => setCompanyCode(e.target.value)}
            />
            <Input
              label="Mã số thuế"
              required
              value={taxCode}
              onChange={(e) => setTaxCode(e.target.value)}
            />
          </div>
          <Textarea
            label="Ghi chú phê duyệt"
            placeholder="Ghi chú nội bộ cho yêu cầu này..."
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isSubmitting}>Hủy</Button>
          </DialogClose>
          <Button
            variant="primary"
            loading={isSubmitting}
            disabled={!companyName.trim() || !companyCode.trim() || !taxCode.trim()}
            onClick={() => onConfirm({ companyName, companyCode, taxCode, note: note.trim() || undefined })}
          >
            <CheckCircle2 className="mr-1.5 size-4" />
            Xác nhận duyệt & Tạo công ty
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RejectTrialDialog({
  item,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  item: TrialAccountRequestResponse
  isSubmitting: boolean
  onClose: () => void
  onConfirm: (data: RejectTrialAccountRequest) => Promise<void>
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open onOpenChange={(open) => (!open && !isSubmitting ? onClose() : undefined)}>
      <DialogContent className="w-120">
        <DialogHeader
          title="Từ chối yêu cầu dùng thử"
          description={`Từ chối yêu cầu đăng ký dùng thử của ${item.fullName}. Email thông báo kèm lý do sẽ được gửi đến khách hàng.`}
        />
        <div className="flex flex-col gap-3 py-4">
          <Textarea
            label="Lý do từ chối"
            required
            placeholder="Nhập lý do từ chối để thông báo tới khách hàng..."
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isSubmitting}>Hủy</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={isSubmitting}
            disabled={!reason.trim()}
            onClick={() => onConfirm({ reason: reason.trim() })}
          >
            <XCircle className="mr-1.5 size-4" />
            Xác nhận từ chối
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
