import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Globe,
  Lock,
  Phone,
  ShieldCheck,
  User,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { useFormat } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'

export function ViewAgreementDialog({
  agreement,
  open,
  onClose,
}: {
  agreement: CompanyAgreement | null
  open: boolean
  onClose: () => void
}) {
  const format = useFormat()

  if (!agreement) return null

  const isSigned = agreement.status === 'SIGNED'
  const isExpired = agreement.status === 'EXPIRED' || agreement.isExpired

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-200 max-w-full overflow-y-auto rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/60 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`flex size-11 items-center justify-center rounded-xl ${
                  isSigned
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : isExpired
                      ? 'bg-red-500/10 text-red-600'
                      : 'bg-amber-500/10 text-amber-600'
                }`}
              >
                <FileSignature className="size-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-h3 font-bold text-ink-strong">{agreement.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-caption text-ink-3">
                  <span className="font-mono font-medium text-ink-1">Mã: #{agreement.agreementCode}</span>
                  <span>•</span>
                  <span>Doanh nghiệp: <strong>{agreement.companyName}</strong></span>
                </div>
              </div>
            </div>
            {isSigned ? (
              <Badge tone="success" dot="solid">Đã ký kết điện tử</Badge>
            ) : isExpired ? (
              <Badge tone="danger" dot="solid">Quá hạn (Đã khóa)</Badge>
            ) : (
              <Badge tone="warning" dot="ring">Chờ ký kết</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-6 py-5">
          {/* Trạng thái ký kết */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center justify-between border-b border-line-soft pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <span className="text-small font-bold text-ink-strong">Thông tin Ký kết & Pháp lý</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 text-small">
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Trạng thái thỏa thuận:</span>
                <span className="font-semibold text-ink-strong">
                  {isSigned ? 'Đã hoàn tất ký điện tử' : isExpired ? 'Đã quá hạn 3 ngày' : 'Đang chờ ký kết'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-caption text-ink-3">Thời hạn ký kết (Deadline):</span>
                <span className="flex items-center gap-1.5 font-medium text-ink-1">
                  <Clock className="size-3.5 text-ink-3" />
                  {agreement.deadlineAt ? format.date(agreement.deadlineAt) : '—'}
                  {!isSigned && !isExpired && (
                    <span className="text-caption text-amber-600 font-semibold">(Còn {agreement.hoursRemaining}h)</span>
                  )}
                </span>
              </div>
              {isSigned && (
                <>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Người đại diện ký kết:</span>
                    <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                      <CheckCircle2 className="size-3.5" />
                      {agreement.signerName || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Thời gian ký kết:</span>
                    <span className="flex items-center gap-1.5 text-ink-1">
                      <Calendar className="size-3.5 text-ink-3" />
                      {agreement.signedAt ? format.date(agreement.signedAt) : '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Số điện thoại người ký:</span>
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <Phone className="size-3.5 text-ink-3" />
                      {agreement.signerPhone || '—'}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-caption text-ink-3">Địa chỉ IP ký kết:</span>
                    <span className="flex items-center gap-1.5 font-mono text-ink-2">
                      <Globe className="size-3.5 text-ink-3" />
                      {agreement.ipAddress || '—'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Nội dung điều khoản */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-small font-bold text-ink-strong flex items-center gap-1.5">
                <FileText className="size-4 text-primary" />
                Văn bản thỏa thuận dịch vụ
              </label>
            </div>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-line-soft bg-surface/30 p-4 font-sans text-small leading-relaxed text-ink-2 shadow-inner whitespace-pre-wrap">
              {agreement.content}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-end border-t border-line-soft bg-surface/50 px-6 py-4">
          <DialogClose asChild>
            <Button variant="primary">Đóng</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
