import { Coins } from 'lucide-react'
import { useState } from 'react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS, type PlanTier } from '@/lib/mock-db'
import { BILLING_CAPABILITIES, type TopUpTerms } from './billing-api'
import { useTopUpTermsQuery } from './useBillingQuery'

type TopUpProps = {
  pending: boolean
  /** Số credit và thành tiền theo giá đang hiện. */
  onConfirm: (credits: number, amountVnd: number) => void
  /** Hạng gói đang dùng; `null` khi chưa có gói. Nối backend thì hạng tính giá là hạng máy chủ trả. */
  tier: PlanTier | null
  /** Số dư hiện tại — trần nạp tính trên số dư sau khi nạp. */
  balance: number
}

/**
 * Nạp credit (FE-8-03, D-89): chọn gói 50 hoặc 500 credit; nối backend thì nhập được số tuỳ ý (`customTopUp`) và giá theo hạng gói đọc
 * từ bảng giá của máy chủ (`useTopUpTermsQuery`); gói đã hết hạn thì không nạp được, hộp nói lý do. Xác nhận chỉ tạo thanh toán chờ và đưa sang trang thanh toán — credit chỉ được cộng khi thanh toán thành công.
 * Nội dung dựng lại mỗi lần mở (gói chọn sẵn là gói nhỏ nhất).
 */
export function TopUpDialog({ open, onOpenChange, ...props }: TopUpProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">{open ? <TopUpForm {...props} /> : null}</DialogContent>
    </Dialog>
  )
}

function TopUpForm(props: TopUpProps) {
  const t = useT()
  const terms = useTopUpTermsQuery()
  if (terms.data === undefined) {
    return (
      <>
        <DialogHeader icon={Coins} title={t('billing.topUpDialog.title')} />
        <div className="flex justify-center px-7 py-8">
          {terms.isError ? <Banner tone="danger" className="w-full">{dataErrorMessage(terms.error, t)}</Banner> : <Spinner label={t('billing.topUpDialog.loading')} />}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">{t('billing.topUpDialog.cancel')}</Button>
          </DialogClose>
        </DialogFooter>
      </>
    )
  }
  return <TopUpChoice {...props} terms={terms.data} />
}

function TopUpChoice({ pending, onConfirm, tier, balance, terms }: TopUpProps & { terms: TopUpTerms }) {
  const t = useT()
  const format = useFormat()
  const [credits, setCredits] = useState<number>(BILLING_CONSTANTS.topUpPacks[0])
  const { priceVnd, maxBalance, minCredits } = terms
  const left = maxBalance === null ? null : Math.max(0, maxBalance - balance)
  const overCap = left !== null && credits > left
  const tierName = t(`common.planTiers.${terms.tier ?? tier ?? 'BASIC'}`)
  const pack = BILLING_CONSTANTS.topUpPacks.find((item) => item === credits)
  return (
    <>
      <DialogHeader icon={Coins} title={t('billing.topUpDialog.title')} description={t('billing.topUpDialog.description', { price: format.currency(priceVnd) })} />
      <div className="flex flex-col gap-4 px-7 py-5">
        {terms.allowed ? null : <Banner tone="warning">{t('billing.topUpDialog.notAllowed')}</Banner>}
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-small text-amber-900">
          {t('billing.topUpDialog.monthlyResetWarning')}
        </p>
        <RadioGroup value={pack === undefined ? '' : String(pack)} onValueChange={(value) => setCredits(Number(value))} aria-label={t('billing.topUpDialog.title')}>
          {BILLING_CONSTANTS.topUpPacks.map((item) => (
            <RadioGroupItem
              key={item}
              value={String(item)}
              label={
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold text-ink-strong">{t('billing.topUpDialog.pack', { credits: format.integer(item) })}</span>
                  <span className="text-ink-2 tabular-nums">{format.currency(item * priceVnd)}</span>
                </span>
              }
            />
          ))}
        </RadioGroup>
        {BILLING_CAPABILITIES.customTopUp ? (
          <div className="flex flex-col gap-2 border-t border-line-soft pt-3.5">
            <Input
              label={t('billing.topUpDialog.custom')}
              type="number"
              inputMode="numeric"
              min={minCredits}
              max={left ?? undefined}
              step={1}
              numeric
              value={credits === 0 ? '' : String(credits)}
              onChange={(event) => setCredits(Math.max(0, Math.floor(Number(event.target.value) || 0)))}
              error={overCap ? t('billing.topUpDialog.overCap', { total: format.integer(balance + credits), max: format.integer(maxBalance ?? 0), tier: tierName }) : undefined}
              hint={left === null ? t('billing.topUpDialog.noCap', { tier: tierName }) : t('billing.topUpDialog.cap', { tier: tierName, max: format.integer(maxBalance ?? 0), left: format.integer(left) })}
            />
            <p className="m-0 text-small text-ink-2 tabular-nums">{t('billing.topUpDialog.total', { amount: format.currency(credits * priceVnd) })}</p>
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>{t('billing.topUpDialog.cancel')}</Button>
        </DialogClose>
        <Button type="button" variant="primary" loading={pending} disabled={!terms.allowed || credits < minCredits || overCap} onClick={() => onConfirm(credits, credits * priceVnd)}>{t('billing.topUpDialog.confirm')}</Button>
      </DialogFooter>
    </>
  )
}
