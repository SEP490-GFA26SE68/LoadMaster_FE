import { CircleCheck, CircleX, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import type { ReadinessCheck, ReadinessStatus } from '@/domain/constraints'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Formatter } from '@/lib/format'
import { useTripReadinessQuery } from './useTripExtrasQuery'

const ICON: Record<ReadinessStatus, { icon: LucideIcon; className: string }> = {
  pass: { icon: CircleCheck, className: 'text-success' },
  warn: { icon: TriangleAlert, className: 'text-warning' },
  fail: { icon: CircleX, className: 'text-danger' },
}

/** Câu của một mục kiểm tra, số đã format theo ngôn ngữ (từ điển `readiness.checks`). */
function checkSentence(check: ReadinessCheck, t: TFunction, format: Formatter): string {
  const p = check.params
  const n = (key: string) => format.integer(p[key] ?? 0)
  switch (check.code) {
    case 'VEHICLE_ASSIGNED':
      return t(`readiness.checks.VEHICLE_ASSIGNED.${check.status === 'pass' ? 'pass' : 'fail'}`)
    case 'PACKAGES_PRESENT':
      return check.status === 'pass' ? t('readiness.checks.PACKAGES_PRESENT.pass', { count: n('count') }) : t('readiness.checks.PACKAGES_PRESENT.fail')
    case 'PACKAGES_VALID':
      return check.status === 'pass' ? t('readiness.checks.PACKAGES_VALID.pass') : t('readiness.checks.PACKAGES_VALID.fail', { invalid: n('invalid') })
    case 'STOPS_VALID':
      if (check.status === 'pass') return t('readiness.checks.STOPS_VALID.pass', { stops: n('stops') })
      return check.status === 'warn' ? t('readiness.checks.STOPS_VALID.warn', { empty: n('empty') }) : t('readiness.checks.STOPS_VALID.fail', { outside: n('outside') })
    case 'WEIGHT_WITHIN_PAYLOAD': {
      const values = { total: format.weight(p.totalKg ?? 0), payload: format.weight(p.payloadKg ?? 0) }
      return t(`readiness.checks.WEIGHT_WITHIN_PAYLOAD.${check.status === 'fail' ? 'fail' : 'pass'}`, values)
    }
    case 'VOLUME_WITHIN_CARGO': {
      const values = { total: format.volumeM3(p.totalCm3 ?? 0), cargo: format.volumeM3(p.cargoCm3 ?? 0) }
      return t(`readiness.checks.VOLUME_WITHIN_CARGO.${check.status === 'fail' ? 'fail' : 'pass'}`, values)
    }
  }
}

/**
 * "Kiểm tra trước khi tối ưu" (luồng 2, LM-104) — card đầu cột phải của Chi tiết chuyến khi chuyến còn lập kế hoạch. Mỗi mục của
 * `getTripReadiness` một dòng (đạt / cảnh báo / chưa đạt, câu ở nhánh `readiness`); chip tổng "Sẵn sàng tối ưu". Mục chưa đạt có lối
 * sửa ngay tại chỗ theo quyền: sửa chuyến (xe, điểm giao, tải), đưa yêu cầu giao vào chuyến (chưa có kiện, điểm giao trống), xem kiện lỗi ở Thiết
 * lập tối ưu. Kiểm tra chỉ là tổng; xếp được hay không vẫn do tối ưu quyết định.
 */
export function TripReadinessCard({ tripId, onAssignRequirement }: { tripId: string; onAssignRequirement?: () => void }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const titleId = useId()
  const query = useTripReadinessQuery(tripId)
  const readiness = query.data
  const blocking = readiness?.checks.filter((check) => check.status === 'fail').length ?? 0

  function fixFor(check: ReadinessCheck): ReactNode {
    const editTrip = can('trips.edit') ? (
      <Button variant="secondary" size="sm" asChild><Link to={`/chuyen/${tripId}/sua`}>{t('readiness.fix.editTrip')}</Link></Button>
    ) : null
    const assign = onAssignRequirement ? <Button variant="secondary" size="sm" onClick={onAssignRequirement}>{t('readiness.fix.assignRequirement')}</Button> : null
    if (check.status === 'pass') return null
    switch (check.code) {
      case 'PACKAGES_PRESENT':
        return assign
      case 'STOPS_VALID':
        return check.status === 'warn' ? assign : editTrip
      case 'PACKAGES_VALID':
        return can('optimization.run') ? (
          <Button variant="secondary" size="sm" asChild><Link to={`/chuyen/${tripId}/toi-uu`}>{t('readiness.fix.reviewPackages')}</Link></Button>
        ) : null
      default:
        return editTrip
    }
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="overflow-hidden">
      <CardHeader>
        <CardTitle id={titleId}>{t('readiness.title')}</CardTitle>
        {readiness ? (
          <Badge tone={readiness.ready ? 'success' : 'warning'} dot={readiness.ready ? 'solid' : 'ring'} outlined={!readiness.ready}>
            {readiness.ready ? t('readiness.ready') : t('readiness.notReady')}
          </Badge>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div role="status" aria-label={t('readiness.loading')} className="grid place-items-center py-6"><Spinner /></div>
      ) : query.isError || !readiness ? (
        <p role="alert" className="p-4.5 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line-soft">
            {readiness.checks.map((check) => {
              const look = ICON[check.status]
              const Icon = look.icon
              const fix = fixFor(check)
              return (
                <li key={check.code} className="flex items-start gap-2.5 px-4.5 py-2.5">
                  <Icon aria-hidden className={`mt-0.5 size-4 flex-none ${look.className}`} strokeWidth={1.75} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <p className="flex flex-col text-small">
                      <span className="font-semibold text-ink-strong">
                        {t(`readiness.checks.${check.code}.label`)}
                        <span className="sr-only">{` — ${t(`readiness.status.${check.status}`)}`}</span>
                      </span>
                      <span className={check.status === 'fail' ? 'text-danger' : 'text-ink-2'}>{checkSentence(check, t, format)}</span>
                    </p>
                    {fix ? <div className="flex flex-wrap gap-2">{fix}</div> : null}
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="border-t border-line-soft bg-n-25 px-4.5 py-3 text-note text-ink-3">
            {readiness.ready ? t('readiness.readyNote') : t('readiness.blocked', { count: blocking })}
          </p>
        </>
      )}
    </Card>
  )
}
