import {
  Calendar,
  CreditCard,
  Eye,
  FileText,
  RotateCcw,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataTable, type DataTableColumns } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
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
import type { SubscriptionContract } from './contracts-api'
import { useContractsQuery } from './useContractsQuery'

export function SubscriptionHistoryPage() {
  const format = useFormat()
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED'>('ALL')

  const [viewingContract, setViewingContract] = useState<SubscriptionContract | null>(null)

  const query = useContractsQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    size: pageSize,
  })

  const rows = useMemo(() => query.data?.items ?? [], [query.data])
  const totalCount = useMemo(() => query.data?.totalElements ?? rows.length, [query.data, rows.length])

  const columns = useMemo<DataTableColumns<SubscriptionContract>>(() => [
    {
      id: 'contractNumber',
      header: 'Mã hợp đồng',
      meta: { width: '15%' },
      cell: ({ row }) => (
        <span className="font-mono text-small font-bold text-primary">
          {row.original.contractNumber}
        </span>
      ),
    },
    {
      id: 'company',
      header: 'Doanh nghiệp',
      meta: { width: '22%' },
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium text-ink-strong">{row.original.companyName}</span>
          {row.original.companyCode && (
            <span className="font-mono text-caption text-ink-3">#{row.original.companyCode}</span>
          )}
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Gói cước',
      meta: { width: '20%' },
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-ink-1">{row.original.planName}</span>
            <Badge tone="cyan" shape="tag">
              {row.original.planTier}
            </Badge>
          </div>
          <span className="text-caption text-ink-3">
            +{format.integer(row.original.creditsGranted)} credits / chu kỳ
          </span>
        </div>
      ),
    },
    {
      id: 'price',
      header: 'Đơn giá',
      meta: { align: 'right', width: '13%' },
      cell: ({ row }) => (
        <div className="flex flex-col items-end">
          <span className="font-mono text-small font-semibold text-ink-strong tabular-nums">
            {format.currency(row.original.priceVnd)}
          </span>
          <span className="text-caption text-ink-3">
            {row.original.billingCycle === 'ANNUAL' ? '/ năm' : '/ tháng'}
          </span>
        </div>
      ),
    },
    {
      id: 'duration',
      header: 'Thời hạn',
      meta: { width: '18%' },
      cell: ({ row }) => (
        <div className="flex flex-col text-caption">
          <span className="text-ink-2">Từ: {format.date(new Date(row.original.startDate))}</span>
          <span className="text-ink-3">Đến: {format.date(new Date(row.original.endDate))}</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: '12%' },
      cell: ({ row }) => {
        const s = row.original.status
        const tone = s === 'ACTIVE' ? 'success' : s === 'EXPIRED' ? 'neutral' : 'danger'
        const label = s === 'ACTIVE' ? 'Đang hiệu lực' : s === 'EXPIRED' ? 'Hết hạn' : 'Đã hủy'
        return <Badge tone={tone} dot="solid">{label}</Badge>
      },
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Thao tác</span>,
      meta: { align: 'right', width: '60px' },
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Xem chi tiết hợp đồng ${row.original.contractNumber}`}
          onClick={() => setViewingContract(row.original)}
        >
          <Eye strokeWidth={1.5} className="size-4" />
        </Button>
      ),
    },
  ], [format])

  const isFiltering = Boolean(search || statusFilter !== 'ALL')

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title="Lịch sử Gói cước"
        meta={query.isSuccess ? `${totalCount} hợp đồng` : undefined}
        description="Tra cứu toàn bộ lịch sử kích hoạt, nâng cấp và gia hạn các gói cước cho doanh nghiệp trên nền tảng LoadMaster."
        actions={
          <Button variant="secondary" onClick={() => void query.refetch()}>
            <RotateCcw className="mr-1.5 size-4" />
            Làm mới
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div role="status" aria-label="Đang tải dữ liệu..." className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title="Lỗi tải lịch sử hợp đồng"
            description="Không thể kết nối đến máy chủ hoặc bạn chưa được phân quyền xem lịch sử gói cước."
            action={
              <Button variant="secondary" onClick={() => void query.refetch()}>
                <RotateCcw className="mr-1.5 size-4" />
                Thử lại
              </Button>
            }
          />
        ) : rows.length === 0 && !isFiltering ? (
          <EmptyState
            mascot="empty"
            title="Chưa có lịch sử hợp đồng nào"
            description="Các gói cước được duyệt và kích hoạt cho doanh nghiệp sẽ xuất hiện tại đây."
          />
        ) : (
          /* Bảng dữ liệu theo thiết kế chuẩn LoadMaster V2 */
          <Card className="relative flex-none overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[240px] max-w-sm flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <Input
                    type="search"
                    placeholder="Tìm theo mã HĐ, tên công ty, tên gói..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value)
                      setPage(0)
                    }}
                    className="pl-9"
                  />
                </div>

                <div className="w-48">
                  <Select
                    value={statusFilter}
                    onValueChange={(val) => {
                      setStatusFilter(val as any)
                      setPage(0)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Trạng thái hợp đồng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Tất cả trạng thái</SelectItem>
                      <SelectItem value="ACTIVE">Đang hiệu lực</SelectItem>
                      <SelectItem value="EXPIRED">Đã hết hạn</SelectItem>
                      <SelectItem value="CANCELLED">Đã hủy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => void query.refetch()}>
                  <RotateCcw className="mr-1.5 size-3.5" />
                  Làm mới
                </Button>
              </div>
            </div>

            <DataTable
              data={rows}
              columns={columns}
              getRowId={(row) => String(row.id)}
              density="spacious"
              appearance="paper"
              pagination={{
                pageIndex: page,
                pageSize,
                totalCount,
                onPageChange: setPage,
                onPageSizeChange: (newSize) => {
                  setPageSize(newSize)
                  setPage(0)
                },
              }}
            />
          </Card>
        )}
      </div>

      {viewingContract && (
        <ViewContractDetailsDialog
          contract={viewingContract}
          open={Boolean(viewingContract)}
          onClose={() => setViewingContract(null)}
        />
      )}
    </div>
  )
}

function ViewContractDetailsDialog({
  contract,
  open,
  onClose,
}: {
  contract: SubscriptionContract
  open: boolean
  onClose: () => void
}) {
  const format = useFormat()

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-160 max-w-full rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/50 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-h3 font-bold text-ink-strong">Chi tiết Hợp đồng Gói cước</h2>
                <Badge tone={contract.status === 'ACTIVE' ? 'success' : 'neutral'} dot="solid">
                  {contract.status === 'ACTIVE' ? 'Đang hiệu lực' : contract.status}
                </Badge>
              </div>
              <span className="font-mono text-small text-ink-3">Mã HĐ: {contract.contractNumber}</span>
            </div>
          </div>
        </DialogHeader>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-6 py-5">
          {/* Khối Gói cước */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <span className="text-small font-semibold text-ink-strong">Gói dịch vụ đã gán</span>
              </div>
              <Badge tone="cyan" shape="tag">{contract.planTier}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-small">
              <div>
                <span className="text-caption text-ink-3">Tên gói cước:</span>
                <p className="font-medium text-ink-strong">{contract.planName}</p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Giá thanh toán:</span>
                <p className="font-mono font-bold text-ink-strong">
                  {format.currency(contract.priceVnd)}
                  <span className="text-caption font-normal text-ink-3">
                    {contract.billingCycle === 'ANNUAL' ? ' / năm' : ' / tháng'}
                  </span>
                </p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Số credit được cấp:</span>
                <p className="font-mono font-semibold text-amber-600">
                  +{format.integer(contract.creditsGranted)} credits
                </p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Chu kỳ gia hạn:</span>
                <p className="font-medium text-ink-strong">
                  {contract.billingCycle === 'ANNUAL' ? 'Hàng năm (Annual)' : 'Hàng tháng (Monthly)'}
                </p>
              </div>
            </div>
          </div>

          {/* Khối Doanh nghiệp */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <span className="text-small font-semibold text-ink-strong">Doanh nghiệp áp dụng</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-small">
              <div>
                <span className="text-caption text-ink-3">Tên công ty:</span>
                <p className="font-medium text-ink-strong">{contract.companyName}</p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Mã doanh nghiệp:</span>
                <p className="font-mono font-medium text-ink-2">#{contract.companyCode || '—'}</p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Người đại diện (Admin):</span>
                <p className="font-medium text-ink-strong">{contract.adminName || '—'}</p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Email liên hệ:</span>
                <p className="font-mono text-primary">{contract.adminEmail || '—'}</p>
              </div>
            </div>
          </div>

          {/* Khối Thời hạn */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              <span className="text-small font-semibold text-ink-strong">Hiệu lực hợp đồng</span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-small">
              <div>
                <span className="text-caption text-ink-3">Ngày bắt đầu hiệu lực:</span>
                <p className="font-medium text-ink-strong">
                  {format.date(new Date(contract.startDate))}
                </p>
              </div>
              <div>
                <span className="text-caption text-ink-3">Ngày kết thúc / hết hạn:</span>
                <p className="font-medium text-ink-strong">
                  {format.date(new Date(contract.endDate))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end border-t border-line-soft px-6 py-4">
          <DialogClose asChild>
            <Button variant="secondary" onClick={onClose}>
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
