import { Link2, Link2Off } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { RequirementStatusBadge } from '@/features/requirements/requirement-look'
import { useUnassignRequirementMutation } from '@/features/requirements/useRequirementsQuery'
import type { Trip } from '@/lib/mock-db'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useTripRequirementsQuery } from './useTripExtrasQuery'

/**
 * "Yêu cầu giao trên chuyến" (FE-4b-01, thay card đơn hàng của LM-104) — dưới bảng kiện của Chi tiết chuyến: yêu cầu đã vào chuyến kèm
 * điểm giao và số kiện. Chuyến còn lập kế hoạch và người xem sửa được chuyến thì có "Đưa yêu cầu vào chuyến" (hộp thoại chọn yêu cầu
 * chờ + điểm giao) và nút gỡ từng yêu cầu; gỡ thì các dòng kiện của yêu cầu rời chuyến. `onAssign` vắng là chỉ xem. *(tạm)* FE-4b-04
 * dựng lại thẻ này cùng điểm giao tự sinh.
 */
export function TripRequirementsCard({ trip, onAssign }: { trip: Trip; onAssign?: () => void }) {
  const t = useT()
  const can = useCan()
  const titleId = useId()
  const query = useTripRequirementsQuery(trip.id)
  const unassign = useUnassignRequirementMutation()
  const rows = query.data ?? []

  // Chỉ xem mà chuyến không có yêu cầu nào (chuyến nhập kiện tay, hoặc đã qua lập kế hoạch): không chiếm chỗ cột phải
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
          {rows.map(({ requirement, status }) => {
            const stopIndex = trip.stops.findIndex((stop) => stop.id === requirement.assignment?.stopId)
            const stop = trip.stops[stopIndex]
            return (
              <li key={requirement.id} className="flex items-start gap-2 px-4.5 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="font-mono text-caption font-medium text-ink-strong">{requirement.id}</span>
                    <span className="truncate text-small font-medium text-ink-1">{requirement.destinationName}</span>
                  </span>
                  <span className="text-note text-ink-3">
                    {stop ? `${t('requirements.stop', { number: stopIndex + 1 })} · ${stop.name} · ` : ''}
                    {t('requirements.packageCount', { count: requirement.packageIds.length })}
                  </span>
                  {status === 'ASSIGNED' ? null : <span className="mt-1"><RequirementStatusBadge status={status} /></span>}
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
