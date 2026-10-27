import { Coins } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { FieldLabel } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { useFormat, useT } from '@/lib/i18n'
import { BILLING_CONSTANTS, type PlanTier } from '@/lib/mock-db'

export const TIER_CREDIT_PRICE_VND: Record<PlanTier, number> = {
  BASIC: 400,
  PRO: 326,
  ULTIMATE: 263,
}

export const TIER_MAX_CUMULATIVE_CREDITS: Record<PlanTier, number | null> = {
  BASIC: 3000,
  PRO: 10000,
  ULTIMATE: null,
}

/**
 * Nạp credit (FE-8-03, D-89): chọn nhanh gói 50 / 500 credit hoặc nhập số lượng tự do.
 * Đơn giá theo gói hiện tại: Basic 400 đ/credit (trần cộng dồn 3.000), Pro 326 đ/credit (trần cộng dồn 10.000), Ultimate 263 đ/credit (tự do).
 */
export function TopUpDialog({
  open,
  onOpenChange,
  pending,
  onConfirm,
  tier,
  currentBalance,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: (credits: number) => void
  tier?: PlanTier | null
  currentBalance?: number
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">
        {open ? (
          <TopUpForm
            pending={pending}
            onConfirm={onConfirm}
            tier={tier}
            currentBalance={currentBalance}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function TopUpForm({
  pending,
  onConfirm,
  tier,
  currentBalance,
}: {
  pending: boolean
  onConfirm: (credits: number) => void
  tier?: PlanTier | null
  currentBalance?: number
}) {
  const t = useT()
  const format = useFormat()
  const inputId = useId()
  const [credits, setCredits] = useState<number>(BILLING_CONSTANTS.topUpPacks[0])

  const unitPrice = tier ? TIER_CREDIT_PRICE_VND[tier] : BILLING_CONSTANTS.creditPriceVnd
  const maxCumulative = tier ? TIER_MAX_CUMULATIVE_CREDITS[tier] : null
  const balance = currentBalance ?? 0
  const maxTopUp = maxCumulative !== null ? Math.max(0, maxCumulative - balance) : null
  const overCap = maxCumulative !== null && balance + credits > maxCumulative
  const invalidAmount = !Number.isFinite(credits) || credits <= 0 || overCap

  return (
    <>
      <DialogHeader
        icon={Coins}
        title={t('billing.topUpDialog.title')}
        description={t('billing.topUpDialog.description', { price: format.currency(unitPrice) })}
      />
      <div className="flex flex-col gap-4 px-7 py-5">
        <RadioGroup
          value={String(credits)}
          onValueChange={(value) => setCredits(Number(value))}
          aria-label={t('billing.topUpDialog.title')}
        >
          {BILLING_CONSTANTS.topUpPacks.map((pack) => (
            <RadioGroupItem
              key={pack}
              value={String(pack)}
              label={
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="font-semibold text-ink-strong">{t('billing.topUpDialog.pack', { credits: format.integer(pack) })}</span>
                  <span className="text-ink-2 tabular-nums">{format.currency(pack * unitPrice)}</span>
                </span>
              }
            />
          ))}
        </RadioGroup>

        <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3.5">
          <FieldLabel htmlFor={inputId}>Số credit muốn mua thêm</FieldLabel>
          <Input
            id={inputId}
            type="number"
            min={1}
            max={maxTopUp ?? undefined}
            step={1}
            value={credits === 0 ? '' : String(credits)}
            onChange={(e) => {
              const raw = e.target.value.trim()
              setCredits(raw === '' ? 0 : Math.max(0, Math.floor(Number(raw) || 0)))
            }}
            placeholder="Nhập số credit tự do..."
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-small text-ink-2 tabular-nums">
            <span>
              Thành tiền: <strong className="text-ink-strong">{format.currency(Math.max(0, credits) * unitPrice)}</strong>
            </span>
            {maxCumulative !== null ? (
              <span>
                Trần gói {tier}: tối đa <strong>{format.integer(maxCumulative)}</strong> credit (còn mua được{' '}
                <strong>{format.integer(maxTopUp ?? 0)}</strong>)
              </span>
            ) : tier === 'ULTIMATE' ? (
              <span>Gói Ultimate: Mua tự do không giới hạn trần</span>
            ) : null}
          </div>
          {overCap && maxCumulative !== null ? (
            <p className="m-0 text-small font-medium text-danger">
              Tổng số dư cộng dồn ({format.integer(balance + credits)} credit) vượt mức trần {format.integer(maxCumulative)} credit của gói {tier}.
            </p>
          ) : null}
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary" disabled={pending}>{t('billing.topUpDialog.cancel')}</Button>
        </DialogClose>
        <Button
          type="button"
          variant="primary"
          loading={pending}
          disabled={pending || invalidAmount}
          onClick={() => onConfirm(credits)}
        >
          {t('billing.topUpDialog.confirm')}
        </Button>
      </DialogFooter>
    </>
  )
}
