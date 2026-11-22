import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

export type PayrollVersionStatus = 'DRAFT' | 'LOCKED' | null | undefined

export function payrollVersionMonth(effectiveFrom: string) {
  return effectiveFrom.slice(0, 7)
}

export function lockedPayrollMonth(
  rates: readonly { readonly effectiveFrom: string; readonly periodStatus?: PayrollVersionStatus }[],
  selectedPeriod: string,
  selectedStatus: PayrollVersionStatus,
): string | null {
  if (selectedStatus === 'LOCKED') return selectedPeriod
  const locked = rates.find((rate) => rate.periodStatus === 'LOCKED')
  return locked ? payrollVersionMonth(locked.effectiveFrom) : null
}

export function PayrollVersionStatusBadge({ status }: { status: PayrollVersionStatus }) {
  const t = useT()
  const locked = status === 'LOCKED'
  return (
    <span
      className={
        locked
          ? 'shrink-0 rounded-full bg-cyan-50 px-2.5 py-0.5 text-caption font-semibold text-cyan-800'
          : 'shrink-0 rounded-full bg-amber-50 px-2.5 py-0.5 text-caption font-semibold text-amber-800'
      }
    >
      {t(locked ? 'payroll.statusLocked' : 'payroll.statusDraft')}
    </span>
  )
}

export function PayrollVersionLockButton({
  period,
  status,
  pending,
  onLock,
  onUnlock,
}: {
  period: string
  status: PayrollVersionStatus
  pending?: boolean
  onLock: (period: string) => void
  onUnlock: (period: string) => void
}) {
  const t = useT()
  const locked = status === 'LOCKED'
  return locked ? (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      loading={pending}
      disabled={pending}
      aria-label={t('payroll.rate.unlockVersionOf', { period })}
      onClick={() => onUnlock(period)}
    >
      {t('payroll.rate.unlockVersion')}
    </Button>
  ) : (
    <Button
      type="button"
      variant="primary"
      size="sm"
      loading={pending}
      disabled={pending}
      aria-label={t('payroll.rate.lockVersionOf', { period })}
      onClick={() => onLock(period)}
    >
      {t('payroll.rate.lockVersion')}
    </Button>
  )
}
