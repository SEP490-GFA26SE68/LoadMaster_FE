import { Coins } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS } from '@/lib/mock-db'

/**
 * Nạp credit (FE-8-03, D-89): chọn gói 50 hoặc 500 credit, 1.000 đ mỗi credit. Xác nhận chỉ tạo thanh toán chờ và đưa sang trang thanh
 * toán — credit chỉ được cộng khi thanh toán thành công. Nội dung dựng lại mỗi lần mở (gói chọn sẵn là gói nhỏ nhất).
 */
export function TopUpDialog({ open, onOpenChange, pending, onConfirm }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: (credits: number) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">{open ? <TopUpForm pending={pending} onConfirm={onConfirm} /> : null}</DialogContent>
    </Dialog>
  )
}

function TopUpForm({ pending, onConfirm }: { pending: boolean; onConfirm: (credits: number) => void }) {
  const t = useT()
  const format = useFormat()
  const [credits, setCredits] = useState<number>(BILLING_CONSTANTS.topUpPacks[0])
  return (
    <>
      <DialogHeader
        icon={Coins}
        title={t('billing.topUpDialog.title')}
        description={t('billing.topUpDialog.description', { price: format.currency(BILLING_CONSTANTS.creditPriceVnd) })}
      />
      <RadioGroup className="px-7 py-5" value={String(credits)} onValueChange={(value) => setCredits(Number(value))} aria-label={t('billing.topUpDialog.title')}>
        {BILLING_CONSTANTS.topUpPacks.map((pack) => (
          <RadioGroupItem
            key={pack}
            value={String(pack)}
            label={
              <span className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-semibold text-ink-strong">{t('billing.topUpDialog.pack', { credits: format.integer(pack) })}</span>
                <span className="text-ink-2 tabular-nums">{format.currency(pack * BILLING_CONSTANTS.creditPriceVnd)}</span>
              </span>
            }
          />
        ))}
      </RadioGroup>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>{t('billing.topUpDialog.cancel')}</Button>
        </DialogClose>
        <Button type="button" variant="primary" loading={pending} onClick={() => onConfirm(credits)}>{t('billing.topUpDialog.confirm')}</Button>
      </DialogFooter>
    </>
  )
}
