import { Link2, Link2Off } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { RequirementPriorityTag, RequirementStatusBadge } from '@/features/requirements/requirement-look'
import { useUnassignRequirementMutation } from '@/features/requirements/useRequirementsQuery'
import type { Trip } from '@/lib/mock-db'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { useTripRequirementsQuery } from './useTripExtrasQuery'

/**
 * "Yêu cầu giao của chuyến" (FE-4b-04, D-73 — thay card đơn hàng của LM-104 và bản tạm của FE-4b-01) — dưới bảng kiện của Chi tiết
 * chuyến: mỗi yêu cầu đã vào chuyến một dòng, theo thứ tự điểm giao — mốc điểm giao (màu định danh kèm số) và tên điểm, mã và điểm
 * đến của yêu cầu, hạn giao, ưu tiên, số kiện. Yêu cầu cùng điểm giao nằm liền nhau: hạn của điểm là hạn sớm nhất trong nhóm. Chuyến
 * còn lập kế hoạch và người xem sửa được chuyến thì có "Đưa yêu cầu vào chuyến" (điểm giao tự sinh) và nút gỡ từng yêu cầu — gỡ thì
 * các dòng kiện của yêu cầu rời chuyến, điểm tự sinh hết kiện tự mất. `onAssign` vắng là chỉ xem.
 */
export function TripRequirementsCard({ trip, onAssign }: { trip: Trip; onAssign?: () => void }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const titleId = useId()
  const query = useTripRequirementsQuery(trip.id)
  const unassign = useUnassignRequirementMutation()
  const rows = query.data ?? []
  // Chỉ xem mà chuyến không có yêu cầu nào (chuyến nhập kiện tay, hoặc đã qua lập kế hoạch): không chiếm chỗ
  if (!onAssign && query.isSuccess && rows.length === 0) return null

  function handleUnassign(requirementId: string) {
    unassign.mutate(requirementId, {
      onSuccess: () => toast.success(t('requirements.assign.unassigned', { id: requirementId })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{t('requirements.trip.title')}</CardTitle>
        {query.isSuccess ? <CardMeta>{t('requirements.count', { count: rows.length })}</CardMeta> : null}
        {onAssign ? (
          <CardActions>
            <Button variant="secondary" size="sm" onClick={onAssign}>
              <Link2 strokeWidth={1.5} />
              {t('requirements.trip.assign')}
            </Button>
          </CardActions>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div className="grid place-items-center py-5"><Spinner /></div>
      ) : query.isError ? (
        <p role="alert" className="p-4.5 text-small text-danger">{dataErrorMessage(query.error, t)}</p>
      ) : rows.length === 0 ? (
        <p className="p-4.5 text-small text-ink-3">{t('requirements.trip.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft">
          {rows.map(({ requirement, status, stopNumber }) => {
            const stop = stopNumber === undefined ? undefined : trip.stops[stopNumber - 1]
            return (
              <li key={requirement.id} className="flex items-start gap-3 px-4.5 py-3">
                {stop && stopNumber !== undefined ? (
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-6.5 flex-none place-items-center rounded-sm font-mono text-small font-semibold"
                    style={{ background: stopColor(stopNumber), color: stopForeground(stopNumber) }}
                  >
                    {stopNumber}
                  </span>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-mono text-caption font-medium text-ink-strong">{requirement.id}</span>
                    <span className="min-w-0 truncate text-small font-medium text-ink-1">{requirement.destinationName}</span>
                    <RequirementPriorityTag priority={requirement.priority} />
                    {status === 'ASSIGNED' ? null : <RequirementStatusBadge status={status} />}
                  </span>
                  <span className="text-note text-ink-3">
                    {stop && stopNumber !== undefined ? `${t('requirements.trip.stop', { number: stopNumber, name: stop.name })} · ` : ''}
                    <span className="tabular-nums">{t('requirements.trip.deadline', { time: format.time(requirement.deadline), date: format.date(requirement.deadline) })}</span>
                    {' · '}
                    {t('requirements.packageCount', { count: requirement.packageIds.length })}
                  </span>
                </div>
                {onAssign && requirement.status === 'ASSIGNED' ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('requirements.trip.unassign', { id: requirement.id })}
                    title={t('requirements.trip.unassign', { id: requirement.id })}
                    disabled={unassign.isPending}
                    onClick={() => handleUnassign(requirement.id)}
                  >
                    <Link2Off strokeWidth={1.5} />
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      {onAssign && query.isSuccess ? <p className="border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('requirements.trip.note')}</p> : null}
      {can('requirements.view') ? (
        <div className="border-t border-line-soft px-4.5 py-2.5">
          <Link to="/yeu-cau-giao" className="rounded-sm text-small font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('requirements.trip.list')}
          </Link>
        </div>
      ) : null}
    </Card>
  )
}
