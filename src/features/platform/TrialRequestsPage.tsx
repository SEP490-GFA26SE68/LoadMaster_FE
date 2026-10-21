import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileCheck,
  Mail,
  Phone,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  User,
  UserX,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { parseFeatures } from '@/features/marketing/pricing-api'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { toast } from 'sonner'
import type {
  ApproveTrialAccountRequest,
  RejectTrialAccountRequest,
  TrialAccountRequestResponse,
} from './trial-requests-api'
import { useSubscriptionPlansQuery } from './useSubscriptionPlansQuery'
import {
  useApproveTrialRequestMutation,
  useRejectTrialRequestMutation,
  useTrialRequestsQuery,
} from './useTrialRequestsQuery'

const BUSINESS_REJECTION_RULES = [
  {
    id: 'INVALID_TAX',
    label: 'Thông tin doanh nghiệp hoặc Mã số thuế không hợp lệ / không thể xác minh',
    detail: 'Thông tin doanh nghiệp hoặc Mã số thuế bạn cung cấp không khớp với cơ sở dữ liệu đăng ký kinh doanh quốc gia hoặc không thể xác minh tính hợp lệ.',
  },
  {
    id: 'UNREACHABLE',
    label: 'Không thể liên hệ qua Email hoặc Số điện thoại đã cung cấp',
    detail: 'Bộ phận hỗ trợ đã cố gắng liên hệ theo số điện thoại và email được cung cấp trong đơn nhưng không nhận được phản hồi để hoàn tất thủ tục bàn giao.',
  },
  {
    id: 'DUPLICATE',
    label: 'Doanh nghiệp / Đơn vị đã từng được cấp tài khoản dùng thử trước đó',
    detail: 'Hệ thống ghi nhận doanh nghiệp hoặc người đại diện của bạn đã được cấp một tài khoản trải nghiệm dịch vụ trước đó. Xin vui lòng liên hệ tư vấn viên để đăng ký gói dịch vụ chính thức.',
  },
  {
    id: 'OUT_OF_SCOPE',
    label: 'Yêu cầu không nằm trong phạm vi dịch vụ hoặc đối tượng của LoadMaster',
    detail: 'Nhu cầu hoặc mô hình vận tải của bạn hiện chưa phù hợp với phạm vi thuật toán và đối tượng phục vụ hiện tại của nền tảng LoadMaster.',
  },
  {
    id: 'OTHER',
    label: 'Lý do khác (yêu cầu mô tả chi tiết)',
    detail: '',
  },
]

export function TrialRequestsPage() {
  const t = useT()
  const format = useFormat()

  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')

  const [processingItem, setProcessingItem] = useState<TrialAccountRequestResponse | null>(null)
  const [viewingItem, setViewingItem] = useState<TrialAccountRequestResponse | null>(null)

  const query = useTrialRequestsQuery({
    search: search.trim() || undefined,
    status: statusFilter === 'ALL' ? undefined : statusFilter,
    page,
    size: pageSize,
  })

  const approveMutation = useApproveTrialRequestMutation()
  const rejectMutation = useRejectTrialRequestMutation()

  const rows = useMemo(() => {
    if (!query.data) return []
    return query.data.data ?? []
  }, [query.data])

  // Point 3: Sort requests so PENDING items are on top, then APPROVED, then REJECTED, secondary sort createdAt desc
  const sortedRows = useMemo(() => {
    const statusWeight = (status: string) => {
      if (status === 'PENDING') return 1
      if (status === 'APPROVED') return 2
      if (status === 'REJECTED') return 3
      return 4
    }
    return [...rows].sort((a, b) => {
      const wA = statusWeight(a.status)
      const wB = statusWeight(b.status)
      if (wA !== wB) return wA - wB
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [rows])

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
      meta: { width: '22%' },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
          <span className="line-clamp-1 font-semibold text-ink-strong">{row.original.fullName}</span>
          <span className="line-clamp-1 text-caption text-ink-3">{row.original.companyName || 'Cá nhân'}</span>
        </div>
      ),
    },
    {
      id: 'contact',
      header: 'Thông tin liên hệ',
      meta: { width: '22%' },
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
          <span className="line-clamp-1 text-caption text-primary">{row.original.email}</span>
          {row.original.phoneNumber && (
            <span className="font-mono text-caption text-ink-3">{row.original.phoneNumber}</span>
          )}
        </div>
      ),
    },
    {
      id: 'plan',
      header: 'Gói quan tâm',
      meta: { width: '18%' },
      cell: ({ row }) => (
        <span className="text-small font-medium text-ink-1">
          {row.original.interestedPlanName || 'Chưa chọn gói'}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Trạng thái',
      meta: { width: '14%' },
      cell: ({ row }) => {
        const status = row.original.status
        // Point 2: Specific status colors with dot indicator and outline
        if (status === 'APPROVED') {
          return <Badge tone="success" dot="solid" outlined>Đã duyệt</Badge>
        }
        if (status === 'REJECTED') {
          return <Badge tone="danger" dot="solid" outlined>Đã từ chối</Badge>
        }
        return <Badge tone="warning" dot="ring" outlined>Chờ duyệt</Badge>
      },
    },
    {
      id: 'createdAt',
      header: 'Ngày gửi',
      meta: { width: '140px' },
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return <span className="text-caption text-ink-3">{format.date(date)} {format.time(date)}</span>
      },
    },
    {
      id: 'actions',
      header: 'Thao tác',
      meta: { align: 'right', width: '140px' },
      cell: ({ row }) => {
        const item = row.original
        // Point 5: Standalone "Từ chối" removed from table row. Pending items have "Xử lý đơn" (or "Duyệt")
        if (item.status === 'PENDING') {
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setProcessingItem(item)}
              >
                <FileCheck className="mr-1 size-3.5" />
                Xử lý đơn
              </Button>
            </div>
          )
        }
        // Point 4: Approved/Rejected items have "Xem chi tiết" button
        return (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setViewingItem(item)}
            >
              <Eye className="mr-1 size-3.5" />
              Xem chi tiết
            </Button>
          </div>
        )
      },
    },
  ], [format])

  const showTable = query.isSuccess && (rows.length > 0 || search || statusFilter !== 'ALL')

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('titles.trialRequests')}
        meta={query.isSuccess ? `${totalCount} yêu cầu` : undefined}
        description="Quản lý và phê duyệt các đơn yêu cầu đăng ký dùng thử từ khách hàng. Phê duyệt sẽ tự động kích hoạt công ty và gửi email xác nhận cho khách."
      />

      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div role="status" aria-label="Đang tải dữ liệu..." className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title="Lỗi tải danh sách yêu cầu dùng thử"
            description="Không thể kết nối đến máy chủ hoặc máy chủ gặp sự cố khi xử lý dữ liệu."
            action={{
              label: 'Thử lại',
              onClick: () => query.refetch(),
            }}
          />
        ) : showTable ? (
          <Card className="relative flex-none overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[220px] max-w-xs flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
                  <Input
                    type="search"
                    placeholder="Tìm theo tên, email, công ty..."
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
                    <SelectTrigger aria-label="Lọc trạng thái">
                      <SelectValue placeholder="Tất cả trạng thái" />
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
              data={sortedRows}
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
              isFiltering={Boolean(search || statusFilter !== 'ALL')}
            />
          </Card>
        ) : (
          <EmptyState
            mascot="inbox"
            title="Chưa có yêu cầu dùng thử"
            description="Khi khách hàng hoặc nhân viên hỗ trợ gửi đơn đăng ký trải nghiệm, các yêu cầu sẽ xuất hiện tại đây để Quản lý nền tảng xem xét."
          />
        )}
      </div>

      {/* Point 1, 5, 6: Unified ProcessTrialDialog (Approval with Double Check & Rejection with Business Rules) */}
      {processingItem && (
        <ProcessTrialDialog
          item={processingItem}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
          onClose={() => setProcessingItem(null)}
          onApprove={async (data) => {
            try {
              await approveMutation.mutateAsync({ id: processingItem.id, data })
              toast.success(`Đã phê duyệt tài khoản dùng thử cho ${processingItem.fullName}! Email xác nhận đã được gửi.`)
              setProcessingItem(null)
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
          onReject={async (data) => {
            try {
              await rejectMutation.mutateAsync({ id: processingItem.id, data })
              toast.success(`Đã từ chối yêu cầu dùng thử của ${processingItem.fullName}. Email thông báo đã được gửi.`)
              setProcessingItem(null)
            } catch (err) {
              toast.error(dataErrorMessage(err, t))
            }
          }}
        />
      )}

      {/* Point 4: ViewTrialDetailsDialog for already processed requests */}
      {viewingItem && (
        <ViewTrialDetailsDialog
          item={viewingItem}
          onClose={() => setViewingItem(null)}
        />
      )}
    </div>
  )
}

/**
 * Dialog xử lý đơn dùng thử:
 * - Tab 1: Phê duyệt & Cấp tài khoản (Hiển thị chức năng từ SubscriptionPlan, thời hạn chỉnh theo nhu cầu, có bước Double Check trước khi lưu)
 * - Tab 2: Từ chối yêu cầu (Option lý do chuẩn theo business rules, giải thích chi tiết và gửi email tới khách)
 */
function ProcessTrialDialog({
  item,
  isApproving,
  isRejecting,
  onClose,
  onApprove,
  onReject,
}: {
  item: TrialAccountRequestResponse
  isApproving: boolean
  isRejecting: boolean
  onClose: () => void
  onApprove: (data: ApproveTrialAccountRequest) => Promise<void>
  onReject: (data: RejectTrialAccountRequest) => Promise<void>
}) {
  const [activeTab, setActiveTab] = useState<'APPROVE' | 'REJECT'>('APPROVE')
  const [step, setStep] = useState<'FORM' | 'CONFIRM'>('FORM')

  // Form Approval State
  const [companyName, setCompanyName] = useState(
    item.companyName || `Công ty ${item.fullName}`
  )
  const [taxCode, setTaxCode] = useState(
    item.taxCode || `TAX-TRIAL-${Math.floor(10000000 + Math.random() * 90000000)}`
  )
  const [trialDays, setTrialDays] = useState<number>(14)
  const [customDays, setCustomDays] = useState<string>('')
  const [isCustomDays, setIsCustomDays] = useState(false)
  const [selectedPlanId, setSelectedPlanId] = useState<number | undefined>(
    item.interestedPlanId ? Number(item.interestedPlanId) : undefined
  )
  const [note, setNote] = useState('')

  // Form Rejection State
  const [selectedRuleId, setSelectedRuleId] = useState<string>('INVALID_TAX')
  const [rejectionReason, setRejectionReason] = useState<string>(BUSINESS_REJECTION_RULES[0]?.detail || '')

  const format = useFormat()
  const plansQuery = useSubscriptionPlansQuery({ active: true })
  const planRows = useMemo(() => {
    if (!plansQuery.data) return []
    if (Array.isArray(plansQuery.data)) return plansQuery.data
    return plansQuery.data.rows ?? []
  }, [plansQuery.data])
  const plans = useMemo(() => planRows.map((r) => r.plan), [planRows])

  // Point 4: Find customer's interested plan in subscription plans catalog
  const interestedPlan = useMemo(() => {
    if (item.interestedPlanId) {
      const match = plans.find((p) => String(p.id) === String(item.interestedPlanId))
      if (match) return match
    }
    if (item.interestedPlanName) {
      const match = plans.find(
        (p) =>
          p.name.toLowerCase() === item.interestedPlanName?.toLowerCase() ||
          p.tier.toLowerCase() === item.interestedPlanName?.toLowerCase()
      )
      if (match) return match
    }
    return null
  }, [item.interestedPlanId, item.interestedPlanName, plans])

  useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      if (interestedPlan) {
        setSelectedPlanId(Number(interestedPlan.id))
      } else {
        setSelectedPlanId(Number(plans[0].id))
      }
    }
  }, [plans, interestedPlan, selectedPlanId])

  const selectedPlan = useMemo(() => {
    if (!selectedPlanId) return plans[0]
    return plans.find((p) => String(p.id) === String(selectedPlanId)) ?? plans[0]
  }, [plans, selectedPlanId])

  // Point 1: Extract features list from selected SubscriptionPlan entity
  const planFeatures = useMemo(() => {
    if (!selectedPlan) return []
    return parseFeatures(selectedPlan.features, selectedPlan.tier)
  }, [selectedPlan])

  const DURATION_OPTIONS = [
    { label: '3 ngày', value: 3 },
    { label: '7 ngày', value: 7 },
    { label: '14 ngày (Khuyến nghị)', value: 14 },
    { label: '30 ngày', value: 30 },
  ]

  const effectiveTrialDays = isCustomDays ? (parseInt(customDays, 10) || trialDays) : trialDays
  const isSubmitting = isApproving || isRejecting

  return (
    <Dialog open onOpenChange={(open) => (!open && !isSubmitting ? onClose() : undefined)}>
      <DialogContent className="w-168 max-w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader
          title="Xử lý đơn đăng ký dùng thử"
          description={`Yêu cầu #${item.id} từ khách hàng ${item.fullName} (${item.email}).`}
        />

        {/* Tab switch between Approve & Reject */}
        <div className="flex border-b border-line-soft px-7">
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-2.5 text-small font-semibold transition-colors ${
              activeTab === 'APPROVE'
                ? 'border-primary text-primary'
                : 'border-transparent text-ink-3 hover:text-ink-strong'
            }`}
            onClick={() => {
              setActiveTab('APPROVE')
              setStep('FORM')
            }}
          >
            <CheckCircle2 className="size-4" />
            Phê duyệt & Cấp tài khoản
          </button>
          <button
            type="button"
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-2.5 text-small font-semibold transition-colors ${
              activeTab === 'REJECT'
                ? 'border-danger text-danger'
                : 'border-transparent text-ink-3 hover:text-ink-strong'
            }`}
            onClick={() => {
              setActiveTab('REJECT')
              setStep('FORM')
            }}
          >
            <UserX className="size-4" />
            Từ chối yêu cầu
          </button>
        </div>

        {activeTab === 'APPROVE' && (
          <>
            {step === 'FORM' ? (
              <div className="flex flex-col gap-4.5 px-7 py-5">
                {/* Khối 1: Thông tin khách hàng & Tài khoản quản trị */}
                <div className="rounded-xl border border-line-soft bg-surface/50 p-4 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-primary" />
                      <span className="text-small font-bold text-ink-strong">Thông tin khách hàng & Tài khoản quản trị</span>
                    </div>
                    <Badge tone="cyan" dot="solid" outlined className="font-semibold">Company Admin</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-small">
                    <div className="flex items-center gap-2">
                      <span className="text-ink-3">Họ và tên:</span>
                      <span className="font-semibold text-ink-strong">{item.fullName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="size-3.5 text-ink-3 shrink-0" />
                      <span className="text-ink-3">Email:</span>
                      <span className="font-medium text-primary truncate">{item.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="size-3.5 text-ink-3 shrink-0" />
                      <span className="text-ink-3">Điện thoại:</span>
                      <span className="font-mono text-ink-1">{item.phoneNumber || 'Chưa cung cấp'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Building2 className="size-3.5 text-ink-3 shrink-0" />
                      <span className="text-ink-3">Đơn vị đăng ký:</span>
                      <span className="text-ink-1 truncate">{item.companyName || 'Cá nhân / Đang khởi tạo'}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-caption text-ink-2">
                    <ShieldCheck className="size-4 shrink-0 text-primary" />
                    <span>
                      Khách hàng sẽ nhận thông tin đăng nhập và mật khẩu tạm thời qua email với vai trò <strong>Quản trị viên Doanh nghiệp (Company Admin)</strong>.
                    </span>
                  </div>
                </div>

                {/* Khối 2: Thông tin doanh nghiệp */}
                <div className="rounded-xl border border-line-soft bg-surface/50 p-4 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
                    <div className="flex items-center gap-2">
                      <Building2 className="size-4 text-primary" />
                      <span className="text-small font-bold text-ink-strong">Thông tin doanh nghiệp sẽ khởi tạo</span>
                    </div>
                    <span className="text-caption text-ink-3 font-mono">
                      Mã công ty: Hệ thống tự sinh
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <Input
                        label="Tên doanh nghiệp"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Input
                        label="Mã số thuế"
                        required
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Khối 3: Gói dịch vụ khách hàng quan tâm (Point 4) */}
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-primary/15 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Eye className="size-4 text-primary" />
                      <span className="text-small font-bold text-ink-strong">Nguyện vọng khách hàng: Gói quan tâm</span>
                    </div>
                    {interestedPlan ? (
                      <Badge tone="cyan" shape="tag">Hạng {interestedPlan.tier}</Badge>
                    ) : item.interestedPlanName ? (
                      <Badge tone="neutral" shape="tag">{item.interestedPlanName}</Badge>
                    ) : (
                      <span className="text-caption text-ink-3">Chưa ghi nhận</span>
                    )}
                  </div>

                  {interestedPlan ? (
                    <div className="flex flex-col gap-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold text-ink-strong">{interestedPlan.name}</span>
                        <span className="font-mono text-small font-semibold text-primary">
                          {format.currency(interestedPlan.priceVnd)}/tháng
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-caption">
                        <div className="flex items-center gap-1.5 text-ink-2">
                          <Zap className="size-3.5 text-amber-500 shrink-0" />
                          <span>Hạn mức: <strong>{interestedPlan.monthlyCredits?.toLocaleString() ?? '—'} credits</strong>/tháng</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-ink-2">
                          <Sparkles className="size-3.5 text-primary shrink-0" />
                          <span>Thuật toán: <strong>{interestedPlan.algorithmTier}</strong></span>
                        </div>
                      </div>

                      {parseFeatures(interestedPlan.features, interestedPlan.tier).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {parseFeatures(interestedPlan.features, interestedPlan.tier).slice(0, 4).map((f, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded bg-surface px-2 py-0.5 text-caption text-ink-2 border border-line-soft">
                              <Check className="size-3 text-success shrink-0" />
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      {selectedPlanId !== Number(interestedPlan.id) && (
                        <div className="mt-1 pt-2 border-t border-primary/10 flex justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            type="button"
                            onClick={() => setSelectedPlanId(Number(interestedPlan.id))}
                          >
                            <Sparkles className="mr-1.5 size-3.5 text-primary" />
                            Áp dụng gói này ({interestedPlan.name})
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-1 text-small text-ink-2">
                      Khách hàng ghi chú gói quan tâm: <strong>{item.interestedPlanName || 'Gói dùng thử tiêu chuẩn'}</strong>.
                    </div>
                  )}
                </div>

                {/* Khối 4: Gói dịch vụ kích hoạt & Khả năng của gói (Point 1 & 4) */}
                <div className="rounded-xl border border-line-soft bg-surface/50 p-4 shadow-xs">
                  <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <span className="text-small font-bold text-ink-strong">Gói dịch vụ kích hoạt & Hạn mức</span>
                    </div>
                    {selectedPlan && (
                      <span className="text-caption font-medium text-cyan-600 bg-cyan-50 dark:bg-cyan-950/40 px-2.5 py-0.5 rounded-full border border-cyan-200 dark:border-cyan-800">
                        🎁 {selectedPlan.monthlyCredits != null ? `${selectedPlan.monthlyCredits.toLocaleString()} Credits tối ưu` : '1,000 Credits tối ưu'}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-small font-semibold text-ink-2">Chọn gói dịch vụ kích hoạt</label>
                      <Select
                        value={selectedPlanId ? String(selectedPlanId) : (item.interestedPlanId ? String(item.interestedPlanId) : (plans[0] ? String(plans[0].id) : '1'))}
                        onValueChange={(val) => setSelectedPlanId(Number(val))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Chọn gói dịch vụ" />
                        </SelectTrigger>
                        <SelectContent>
                          {plans.length > 0 ? (
                            plans.map((plan) => (
                              <SelectItem key={plan.id} value={String(plan.id)}>
                                {plan.name} ({plan.tier}) — {plan.monthlyCredits ? `${plan.monthlyCredits.toLocaleString()} credits` : 'Theo định mức'}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value={String(item.interestedPlanId || 1)}>
                              {item.interestedPlanName || 'Gói dùng thử Pro (1,000 credits)'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Point 1: Features & Capabilities of selected SubscriptionPlan entity */}
                    {selectedPlan && (
                      <div className="rounded-lg border border-line-soft bg-surface-raised/40 p-3 text-small">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-caption font-semibold text-ink-3">Khả năng gói:</span>
                          <span className="inline-flex items-center gap-1 rounded bg-azure-50 px-2 py-0.5 text-caption font-medium text-azure-700 dark:bg-azure-950/40 dark:text-azure-300">
                            <Zap className="size-3" />
                            Thuật toán: {selectedPlan.algorithmTier || 'EP_DBLF (Tiêu chuẩn)'}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-caption font-medium text-green-700 dark:bg-green-950/40 dark:text-green-300">
                            Hạn mức: {selectedPlan.monthlyCredits ? `${selectedPlan.monthlyCredits.toLocaleString()} credits/tháng` : '1,000 credits'}
                          </span>
                        </div>

                        {planFeatures.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {planFeatures.map((feat, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-caption text-ink-1 border border-line-soft shadow-2xs"
                              >
                                <Check className="size-3 text-success shrink-0" />
                                {feat}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-caption text-ink-3 italic">
                            Bao gồm tính năng xếp hàng 3D, phân bổ lộ trình xe tối ưu theo định mức gói {selectedPlan.name}.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Thời hạn trải nghiệm (Chỉnh theo nhu cầu) */}
                    <div className="flex flex-col gap-2 pt-1">
                      <div className="flex items-center justify-between">
                        <label className="text-small font-semibold text-ink-2">Thời hạn trải nghiệm (Ngày)</label>
                        <span className="text-caption font-mono text-primary font-semibold">
                          Hiệu lực: {effectiveTrialDays} ngày
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {DURATION_OPTIONS.map((opt) => (
                          <Button
                            key={opt.value}
                            type="button"
                            size="sm"
                            variant={!isCustomDays && trialDays === opt.value ? 'primary' : 'secondary'}
                            onClick={() => {
                              setIsCustomDays(false)
                              setTrialDays(opt.value)
                            }}
                          >
                            {opt.label}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant={isCustomDays ? 'primary' : 'secondary'}
                          onClick={() => {
                            setIsCustomDays(true)
                            if (!customDays) setCustomDays(String(trialDays))
                          }}
                        >
                          Tùy chỉnh
                        </Button>
                      </div>

                      {isCustomDays && (
                        <div className="mt-1 flex items-center gap-2">
                          <Input
                            type="number"
                            min={1}
                            max={365}
                            placeholder="Số ngày (1-365)"
                            value={customDays}
                            onChange={(e) => {
                              setCustomDays(e.target.value)
                              const val = parseInt(e.target.value, 10)
                              if (!isNaN(val) && val > 0) {
                                setTrialDays(val)
                              }
                            }}
                            className="w-36"
                          />
                          <span className="text-small text-ink-3">ngày trải nghiệm</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Khối 4: Ghi chú nội bộ */}
                <div className="rounded-xl border border-line-soft bg-surface/50 p-4 shadow-xs">
                  <Textarea
                    label="Ghi chú phê duyệt nội bộ"
                    placeholder="Nhập ghi chú hoặc yêu cầu lưu ý nội bộ (không gửi cho khách)..."
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              /* Point 6: Double-Check Confirmation Step */
              <div className="flex flex-col gap-4.5 px-7 py-5">
                <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-ink-strong">Xác nhận lại thông tin bàn giao (Double Check)</h4>
                      <p className="mt-1 text-small text-ink-2">
                        Vui lòng rà soát kỹ các thông tin trước khi kích hoạt. Hệ thống sẽ khởi tạo công ty và gửi tài khoản quản trị trực tiếp đến khách hàng qua email.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="divide-y divide-line-soft rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Doanh nghiệp khởi tạo:</span>
                    <span className="font-semibold text-ink-strong">{companyName}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Mã số thuế:</span>
                    <span className="font-mono font-medium text-ink-1">{taxCode}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Quản trị viên (Admin):</span>
                    <span className="font-medium text-ink-strong">{item.fullName}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Email nhận tài khoản:</span>
                    <span className="font-medium text-primary">{item.email}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Vai trò cấp:</span>
                    <Badge tone="cyan" dot="solid" outlined>Company Admin</Badge>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Gói dịch vụ trải nghiệm:</span>
                    <span className="font-semibold text-ink-strong">{selectedPlan?.name || 'Gói dùng thử'}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Thời hạn hiệu lực:</span>
                    <span className="font-semibold text-azure-600">{effectiveTrialDays} ngày</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="text-small text-ink-3">Hạn mức Credits cấp:</span>
                    <span className="font-semibold text-green-600">
                      {selectedPlan?.monthlyCredits ? `${selectedPlan.monthlyCredits.toLocaleString()} Credits` : '1,000 Credits'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              {step === 'FORM' ? (
                <>
                  <DialogClose asChild>
                    <Button variant="ghost" disabled={isSubmitting}>Hủy</Button>
                  </DialogClose>
                  <Button
                    variant="primary"
                    disabled={!companyName.trim() || !taxCode.trim()}
                    onClick={() => setStep('CONFIRM')}
                  >
                    Tiếp tục kiểm tra thông tin
                    <ChevronRight className="ml-1 size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    disabled={isSubmitting}
                    onClick={() => setStep('FORM')}
                  >
                    <ArrowLeft className="mr-1 size-4" />
                    Quay lại chỉnh sửa
                  </Button>
                  <Button
                    variant="primary"
                    loading={isApproving}
                    onClick={() => {
                      onApprove({
                        companyName: companyName.trim(),
                        taxCode: taxCode.trim(),
                        planId: selectedPlanId,
                        trialDays: effectiveTrialDays,
                        note: note.trim() || undefined,
                      })
                    }}
                  >
                    <CheckCircle2 className="mr-1.5 size-4" />
                    Xác nhận duyệt & Tạo công ty
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}

        {/* Point 5: Reject tab with Business Rules & Email explanation */}
        {activeTab === 'REJECT' && (
          <div className="flex flex-col gap-4.5 px-7 py-5">
            <div className="rounded-xl border border-danger/30 bg-danger/10 p-3.5">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="size-4.5 text-danger shrink-0 mt-0.5" />
                <div className="text-small text-ink-2">
                  <p className="font-semibold text-danger">Quy định từ chối yêu cầu dùng thử:</p>
                  <p className="mt-0.5">
                    Hệ thống yêu cầu chọn đúng quy tắc nghiệp vụ (Business Rule). Lý do từ chối sẽ được định dạng trang trọng và gửi email trực tiếp tới <strong>{item.email}</strong>.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="text-small font-semibold text-ink-2">Chọn lý do theo Quy định nghiệp vụ (Business Rules):</label>
              <div className="flex flex-col gap-2">
                {BUSINESS_REJECTION_RULES.map((rule) => (
                  <label
                    key={rule.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedRuleId === rule.id
                        ? 'border-danger/60 bg-danger/5 shadow-xs'
                        : 'border-line-soft bg-surface hover:bg-surface-raised'
                    }`}
                  >
                    <input
                      type="radio"
                      name="rejectionRule"
                      value={rule.id}
                      checked={selectedRuleId === rule.id}
                      onChange={() => {
                        setSelectedRuleId(rule.id)
                        if (rule.detail) {
                          setRejectionReason(rule.detail)
                        } else if (rule.id === 'OTHER') {
                          setRejectionReason('')
                        }
                      }}
                      className="mt-1 size-4 accent-danger"
                    />
                    <div className="flex flex-col">
                      <span className="text-small font-medium text-ink-strong">{rule.label}</span>
                      {rule.detail && (
                        <span className="text-caption text-ink-3 mt-0.5">{rule.detail}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-small font-semibold text-ink-2">
                Nội dung giải thích cụ thể gửi đến khách hàng <span className="text-danger">*</span>
              </label>
              <Textarea
                placeholder="Nhập nội dung giải thích lý do từ chối sẽ hiển thị trong email gửi cho khách..."
                rows={4}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                required
              />
              <p className="text-caption text-ink-3">
                Nội dung này sẽ được chuyển thành email thông báo lịch sự từ ban quản trị nền tảng LoadMaster.
              </p>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost" disabled={isSubmitting}>Hủy</Button>
              </DialogClose>
              <Button
                variant="danger"
                loading={isRejecting}
                disabled={!rejectionReason.trim()}
                onClick={() => {
                  onReject({
                    reason: rejectionReason.trim(),
                  })
                }}
              >
                <UserX className="mr-1.5 size-4" />
                Xác nhận từ chối & Gửi email cho khách
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Point 4: Dialog Xem chi tiết đơn dùng thử (đã duyệt hoặc từ chối)
 */
function ViewTrialDetailsDialog({
  item,
  onClose,
}: {
  item: TrialAccountRequestResponse
  onClose: () => void
}) {
  const format = useFormat()
  const isApproved = item.status === 'APPROVED'
  const isRejected = item.status === 'REJECTED'

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="w-160 max-w-full max-h-[92vh] overflow-y-auto">
        <DialogHeader
          title={`Chi tiết đơn dùng thử #${item.id}`}
          description={`Gửi lúc ${format.date(new Date(item.createdAt))} ${format.time(new Date(item.createdAt))}`}
        />

        <div className="flex flex-col gap-4.5 px-7 py-5">
          {/* Status banner */}
          <div className="flex items-center justify-between rounded-xl border border-line-soft bg-surface/50 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              {isApproved && <CheckCircle2 className="size-6 text-success shrink-0" />}
              {isRejected && <AlertCircle className="size-6 text-danger shrink-0" />}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink-strong">Trạng thái hồ sơ:</span>
                  {isApproved && <Badge tone="success" dot="solid" outlined>Đã duyệt thành công</Badge>}
                  {isRejected && <Badge tone="danger" dot="solid" outlined>Đã từ chối</Badge>}
                  {!isApproved && !isRejected && <Badge tone="warning" dot="ring" outlined>Chờ duyệt</Badge>}
                </div>
                {item.resolvedAt && (
                  <p className="text-caption text-ink-3 mt-1">
                    Xử lý ngày {format.date(new Date(item.resolvedAt))} bởi{' '}
                    <strong>{item.approvedByName || 'Quản lý nền tảng'}</strong>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Customer info */}
          <div className="rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
            <h4 className="mb-2.5 flex items-center gap-2 font-bold text-ink-strong border-b border-line-soft pb-2">
              <User className="size-4 text-primary" />
              Thông tin người đăng ký
            </h4>
            <div className="grid grid-cols-2 gap-3 text-small">
              <div>
                <span className="text-ink-3">Họ và tên:</span>{' '}
                <span className="font-semibold text-ink-strong">{item.fullName}</span>
              </div>
              <div>
                <span className="text-ink-3">Email:</span>{' '}
                <span className="font-medium text-primary">{item.email}</span>
              </div>
              <div>
                <span className="text-ink-3">Điện thoại:</span>{' '}
                <span className="font-mono text-ink-1">{item.phoneNumber || 'Chưa cung cấp'}</span>
              </div>
              <div>
                <span className="text-ink-3">Đơn vị công tác:</span>{' '}
                <span className="text-ink-1">{item.companyName || 'Cá nhân'}</span>
              </div>
            </div>
          </div>

          {/* Company & Subscription Info */}
          <div className="rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
            <h4 className="mb-2.5 flex items-center gap-2 font-bold text-ink-strong border-b border-line-soft pb-2">
              <Building2 className="size-4 text-primary" />
              Thông tin doanh nghiệp & Gói dịch vụ
            </h4>
            <div className="grid grid-cols-2 gap-3 text-small">
              <div>
                <span className="text-ink-3">Doanh nghiệp khởi tạo:</span>{' '}
                <span className="font-semibold text-ink-strong">
                  {item.createdCompanyName || item.companyName || 'Chưa khởi tạo'}
                </span>
              </div>
              <div>
                <span className="text-ink-3">Mã công ty:</span>{' '}
                <span className="font-mono font-medium text-ink-1">{item.companyCode || 'COMP-TRIAL'}</span>
              </div>
              <div>
                <span className="text-ink-3">Mã số thuế:</span>{' '}
                <span className="font-mono text-ink-1">{item.taxCode || 'Chưa cấp'}</span>
              </div>
              <div>
                <span className="text-ink-3">Gói quan tâm:</span>{' '}
                <span className="font-medium text-ink-strong">{item.interestedPlanName || 'Gói dùng thử'}</span>
              </div>
            </div>
          </div>

          {/* Notes / Reason */}
          {item.note && (
            <div className="rounded-xl border border-line-soft bg-surface p-4 shadow-xs">
              <h4 className="mb-1.5 font-bold text-ink-strong">Ghi chú & Lý do xử lý</h4>
              <p className="whitespace-pre-wrap rounded-lg bg-surface-raised p-3 font-mono text-caption text-ink-2">
                {item.note}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Đóng</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
