import { TriangleAlert } from 'lucide-react'
import { useId } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { CargoPackage } from '@/domain/models'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { SegregationOverrideDialog } from './SegregationOverrideDialog'
import { useOverrideSegregationMutation, useSegregationGuard, useTripSegregationQuery } from './useSegregationQuery'

/**
 * "Phân nhóm hàng" ở cột phải Chi tiết chuyến (FE-4b-06, D-74): loại hàng đang khoá chuyến (loại của kiện đầu tiên), số kiện theo
 * từng loại, các dòng kiện khác loại, lý do điều phối viên đã ghi để chở chung, và cảnh báo về xe (hàng nguy hiểm; hàng lạnh khi xe
 * không có thiết bị làm lạnh). Còn kiện khác loại mà chưa có lý do thì thẻ nói rõ và — khi chuyến còn sửa được — có nút ghi lý do;
 * đã có lý do thì sửa được. Mọi số lấy từ `getTripSegregation` của kho.
 */
export function SegregationCard({ tripId, packages, editable }: {
  tripId: string
  /** Dòng kiện của chuyến: để gọi tên dòng kiện khác loại. */
  packages: readonly CargoPackage[]
  editable: boolean
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const query = useTripSegregationQuery(tripId)
  const override = useOverrideSegregationMutation(tripId)
  const guard = useSegregationGuard()
  const state = query.data
  const nameOf = new Map(packages.map((pkg) => [pkg.id, pkg.name]))
  const conflictCount = state?.conflicts.reduce((sum, conflict) => sum + conflict.count, 0) ?? 0
  const unresolved = state !== undefined && state.conflicts.length > 0 && state.overrideReason === undefined

  function openOverride() {
    if (!state || state.lockedClass === null) return
    guard.open({
      lockedClass: state.lockedClass,
      packages: state.conflicts.map((conflict) => conflict.packageId),
      initialReason: state.overrideReason,
      retry: (reason) => override.mutateAsync(reason),
    })
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="overflow-hidden">
      <CardHeader>
        <CardTitle id={titleId}>{t('trips.segregation.title')}</CardTitle>
        {state && state.conflicts.length > 0 ? (
          <Badge tone="warning" dot={unresolved ? 'ring' : 'solid'} outlined={unresolved}>
            {t('trips.segregation.conflictBadge', { count: format.integer(conflictCount) })}
          </Badge>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div role="status" aria-label={t('trips.segregation.loading')} className="grid place-items-center py-6"><Spinner /></div>
      ) : query.isError || !state ? (
        <p role="alert" className="p-4.5 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : state.lockedClass === null ? (
        <p className="p-4.5 text-small text-ink-3">{t('trips.segregation.empty')}</p>
      ) : (
        <div className="flex flex-col gap-3.5 px-4.5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-small text-ink-2">{t('trips.segregation.locked')}</span>
            <HandlingClassChip handlingClass={state.lockedClass} />
          </div>
          <ul aria-label={t('trips.segregation.groups')} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {state.groups.map((group) => (
              <li key={group.handlingClass} className="flex items-center justify-between gap-2 text-small">
                <span className={group.handlingClass === state.lockedClass ? 'text-ink-2' : 'font-semibold text-amber-700'}>
                  {t(`common.handlingClasses.${group.handlingClass}`)}
                </span>
                <span className="text-ink-2 tabular-nums">{t('common.packageCount', { count: group.count })}</span>
              </li>
            ))}
          </ul>
          {state.conflicts.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
              <h4 className="text-small font-semibold text-ink-strong">{t('trips.segregation.conflictsTitle')}</h4>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {state.conflicts.map((conflict) => (
                  <li key={conflict.packageId} className="flex items-baseline gap-2 text-small">
                    <span className="font-mono text-caption font-medium text-ink-strong">{conflict.packageId}</span>
                    <span className="line-clamp-2 min-w-0 flex-1 text-ink-2">{nameOf.get(conflict.packageId) ?? ''}</span>
                    <span className="flex-none text-ink-3 tabular-nums">
                      {t('trips.segregation.conflictLine', { className: t(`common.handlingClasses.${conflict.handlingClass}`), count: format.integer(conflict.count) })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {state.overrideReason !== undefined ? (
            <div className="flex flex-col gap-1 border-t border-line-soft pt-3">
              <h4 className="text-small font-semibold text-ink-strong">{t('trips.segregation.overrideReason')}</h4>
              <p className="text-small break-words whitespace-pre-line text-ink-2">{state.overrideReason}</p>
              {editable ? <div><Button variant="secondary" size="sm" onClick={openOverride}>{t('trips.segregation.editOverride')}</Button></div> : null}
            </div>
          ) : unresolved ? (
            <Banner tone="warning" className="text-small">
              {t('trips.segregation.overrideMissing')}
              {editable ? <div className="mt-2"><Button variant="secondary" size="sm" onClick={openOverride}>{t('trips.segregation.override')}</Button></div> : null}
            </Banner>
          ) : null}
          {state.vehicleWarnings.map((warning) => (
            <p key={warning.code} className="flex items-start gap-2 text-small text-ink-2">
              <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none text-warning" strokeWidth={1.75} />
              <span>{t(`trips.segregation.warnings.${warning.code}`, { count: warning.params.count })}</span>
            </p>
          ))}
        </div>
      )}
      <SegregationOverrideDialog pending={guard.pending} onClose={guard.close} onDone={() => toast.success(t('trips.segregation.dialog.saved'))} />
    </Card>
  )
}
