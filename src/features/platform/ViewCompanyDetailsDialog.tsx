import {
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  CreditCard,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from 'lucide-react'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import type { CompanyOverview, SubscriptionStatus } from '@/lib/mock-db'

const STATUS_LOOK: Record<SubscriptionStatus, { tone: BadgeTone; dot: BadgeDot; label: string }> = {
  ACTIVE: { tone: 'success', dot: 'solid', label: 'Đang hoạt động' },
  CANCELLED: { tone: 'warning', dot: 'ring', label: 'Đã hủy' },
  EXPIRED: { tone: 'danger', dot: 'solid', label: 'Đã hết hạn' },
}

export function ViewCompanyDetailsDialog({
  overview,
  open,
  onClose,
  onEditCompany,
}: {
  overview: CompanyOverview | null
  open: boolean
  onClose: () => void
  onEditCompany?: () => void
}) {
  const t = useT()
  const format = useFormat()

  if (!overview) return null

  const { company, current, adminUser, userCount, planStatus, creditBalance } = overview
  const planLook = planStatus ? STATUS_LOOK[planStatus] : null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] w-180 max-w-full overflow-y-auto rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/50 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-h3 font-bold text-ink-strong">{company.name}</h2>
                  <span className="font-mono text-fine text-ink-3">#{company.id}</span>
                </div>
                <span className="text-small text-ink-3">
                  Thông tin hồ sơ doanh nghiệp & Quản trị tài khoản
                </span>
              </div>
            </div>
            {planLook && (
              <Badge tone={planLook.tone} dot={planLook.dot}>
                {planLook.label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-6 px-6 py-5">
          {/* Section 1: Thông tin Doanh nghiệp */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center gap-2 border-b border-line-soft pb-2.5">
              <Building2 className="size-4 text-primary" />
              <span className="text-small font-bold text-ink-strong">1. Thông tin Doanh nghiệp</span>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Tên đầy đủ:</span>
                <span className="font-semibold text-ink-strong">{company.name}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Mã doanh nghiệp:</span>
                <span className="font-mono font-medium text-ink-1">{company.id}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Mã số thuế:</span>
                <span className="font-mono font-medium text-ink-1">{company.taxId || 'Chưa cập nhật'}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Email nhận hóa đơn:</span>
                <span className="text-primary">{company.billingEmail || 'Chưa cập nhật'}</span>
              </div>
              {company.depot && (
                <div className="col-span-full flex items-start gap-2 rounded-lg bg-surface-2/60 p-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" />
                  <div className="flex flex-col text-caption">
                    <span className="font-semibold text-ink-strong">Kho xuất phát: {company.depot.name}</span>
                    <span className="text-ink-3">
                      Tọa độ: {company.depot.lat.toFixed(4)}, {company.depot.lng.toFixed(4)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Chủ tài khoản Doanh nghiệp (Company Admin) */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <User className="size-4 text-primary" />
                <span className="text-small font-bold text-ink-strong">2. Chủ tài khoản Doanh nghiệp (Company Admin)</span>
              </div>
              <Badge tone="cyan" shape="pill">Chủ tài khoản</Badge>
            </div>
            {adminUser ? (
              <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Họ và tên người đại diện:</span>
                  <span className="font-semibold text-ink-strong">{adminUser.fullName}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Vai trò:</span>
                  <span className="flex items-center gap-1.5 font-medium text-primary">
                    <ShieldCheck className="size-4" />
                    Quản trị viên Công ty (Company Admin)
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Email quản trị:</span>
                  <span className="flex items-center gap-1.5 text-primary">
                    <Mail className="size-3.5" />
                    {adminUser.email}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-caption text-ink-3">Số điện thoại liên hệ:</span>
                  <span className="flex items-center gap-1.5 text-ink-1">
                    <Phone className="size-3.5" />
                    {adminUser.phone || 'Chưa cung cấp'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-caption text-ink-3">
                Chưa có thông tin chủ tài khoản quản trị cho doanh nghiệp này.
              </div>
            )}
          </div>

          {/* Section 3: Gói cước & Tài nguyên hiện tại */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <span className="text-small font-bold text-ink-strong">3. Gói cước & Tài nguyên hệ thống</span>
              </div>
              <div className="flex items-center gap-1.5 text-caption text-ink-3">
                <Users className="size-3.5" />
                <span>Quy mô: <strong>{userCount}</strong> nhân sự</span>
              </div>
            </div>
            {current ? (
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary/5 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Sparkles className="size-4.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-ink-strong">{current.plan.name}</span>
                      <span className="text-fine text-ink-3">Mã gói: {current.plan.id}</span>
                    </div>
                  </div>
                  <Badge tone="cyan" shape="tag">
                    {t(`common.planTiers.${current.plan.tier}`)}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Số dư Credit hiện khả dụng:</span>
                    <span className="flex items-center gap-1.5 font-mono text-base font-bold text-amber-600">
                      <Coins className="size-4 text-amber-500" />
                      {format.integer(creditBalance ?? current.plan.monthlyCredits ?? 0)} credits
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Thời hạn gói cước:</span>
                    <span className="flex items-center gap-1.5 font-medium text-ink-1">
                      <Calendar className="size-3.5 text-ink-3" />
                      {current.startedAt ? format.date(current.startedAt) : '—'}
                      {current.expiresAt ? ` - ${format.date(current.expiresAt)}` : ' (Vô thời hạn)'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-2 text-center text-caption text-ink-3">
                Doanh nghiệp hiện chưa đăng ký gói cước trả phí.
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between border-t border-line-soft bg-surface/50 px-6 py-4">
          <div>
            {onEditCompany && (
              <Button
                variant="secondary"
                onClick={() => {
                  onClose()
                  onEditCompany()
                }}
              >
                <Pencil className="mr-1.5 size-4" />
                Chỉnh sửa công ty
              </Button>
            )}
          </div>
          <DialogClose asChild>
            <Button variant="primary">Đóng</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
