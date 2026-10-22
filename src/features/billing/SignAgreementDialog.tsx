import {
  Building2,
  Calendar,
  FileCheck2,
  FileSignature,
  FileText,
  ShieldAlert,
  User,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useFormat } from '@/lib/i18n'
import type { CompanyAgreement } from './agreements-api'

export function SignAgreementDialog({
  agreement,
  open,
  onClose,
  onSign,
  defaultSignerName = '',
  defaultSignerPhone = '',
  isSigning = false,
}: {
  agreement: CompanyAgreement | null
  open: boolean
  onClose: () => void
  onSign: (data: { signerName: string; signerPhone: string; confirmTerms: boolean }) => Promise<void>
  defaultSignerName?: string
  defaultSignerPhone?: string
  isSigning?: boolean
}) {
  const format = useFormat()
  const [signerName, setSignerName] = useState(defaultSignerName)
  const [signerPhone, setSignerPhone] = useState(defaultSignerPhone)
  const [confirmTerms, setConfirmTerms] = useState(false)

  useEffect(() => {
    if (open) {
      if (defaultSignerName) setSignerName(defaultSignerName)
      if (defaultSignerPhone) setSignerPhone(defaultSignerPhone)
      setConfirmTerms(false)
    }
  }, [open, defaultSignerName, defaultSignerPhone])

  if (!agreement) return null

  const canSubmit = confirmTerms && signerName.trim().length > 0 && signerPhone.trim().length > 0 && !isSigning

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[92vh] w-200 max-w-full overflow-y-auto rounded-2xl bg-bg p-0 shadow-2xl">
        <DialogHeader className="border-b border-line-soft bg-surface/60 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <FileSignature className="size-6" />
              </div>
              <div className="flex flex-col">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-h3 font-bold text-ink-strong">{agreement.title}</h2>
                </div>
                <div className="flex items-center gap-2 text-caption text-ink-3">
                  <span className="font-mono font-medium text-amber-700">Mã: #{agreement.agreementCode}</span>
                  <span>•</span>
                  <span>Doanh nghiệp: <strong>{agreement.companyName}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!canSubmit) return
            await onSign({
              signerName: signerName.trim(),
              signerPhone: signerPhone.trim(),
              confirmTerms,
            })
          }}
          className="flex flex-col gap-5 px-6 py-5"
        >
          {/* Thông tin quy định 3 ngày */}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-small text-amber-900">
            <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold">Lưu ý bắt buộc về thời hạn ký kết:</span>
              <span>
                Thỏa thuận này có hiệu lực tối đa <strong>3 ngày (72 giờ)</strong> kể từ thời điểm cấp tài khoản. Nếu không hoàn tất ký kết trước{' '}
                <strong>{agreement.deadlineAt ? format.date(agreement.deadlineAt) : 'thời hạn'}</strong>, tài khoản công ty sẽ bị tự động khóa.
              </span>
            </div>
          </div>

          {/* Hộp xem điều khoản thỏa thuận */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-small font-bold text-ink-strong flex items-center gap-1.5">
                <FileText className="size-4 text-primary" />
                Nội dung thỏa thuận sử dụng dịch vụ
              </label>
              <span className="text-fine text-ink-3">Cuộn xuống để xem toàn bộ nội dung</span>
            </div>
            <div className="max-h-60 overflow-y-auto rounded-xl border border-line-soft bg-surface/30 p-4 font-sans text-small leading-relaxed text-ink-2 shadow-inner whitespace-pre-wrap">
              {agreement.content}
            </div>
          </div>

          {/* Thông tin người đại diện ký kết */}
          <div className="rounded-xl border border-line-soft bg-surface/40 p-4 shadow-2xs">
            <div className="mb-3 flex items-center gap-2 border-b border-line-soft pb-2.5">
              <User className="size-4 text-primary" />
              <span className="text-small font-bold text-ink-strong">Thông tin Người đại diện ký xác nhận</span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-small font-semibold text-ink-strong">Họ và tên người ký *</label>
                <Input
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  placeholder="Nhập họ và tên người đại diện..."
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-small font-semibold text-ink-strong">Số điện thoại liên hệ *</label>
                <Input
                  value={signerPhone}
                  onChange={(e) => setSignerPhone(e.target.value)}
                  placeholder="Nhập số điện thoại người ký..."
                  required
                />
              </div>
            </div>
          </div>

          {/* Cam kết đồng ý */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <Checkbox
              id="confirm-terms"
              checked={confirmTerms}
              onCheckedChange={(checked) => setConfirmTerms(!!checked)}
              label={
                <span className="text-small font-medium text-ink-strong">
                  Tôi đã đọc, hiểu rõ và đồng ý với tất cả điều khoản và điều kiện sử dụng dịch vụ thử nghiệm của LoadMaster. Tôi xác nhận có thẩm quyền đại diện cho doanh nghiệp thực hiện ký kết thỏa thuận này.
                </span>
              }
            />
          </div>

          <DialogFooter className="mt-2 flex items-center justify-end gap-2 border-t border-line-soft pt-4">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isSigning}>
              Hủy
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!canSubmit}
              loading={isSigning}
              className="bg-primary hover:bg-primary-hover"
            >
              <FileCheck2 className="mr-1.5 size-4" />
              Xác nhận ký thỏa thuận
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
