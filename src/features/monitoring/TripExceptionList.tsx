import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { ESCALATE_AFTER_MINUTES, isActiveException, type TripException } from '@/lib/mock-db'
import { ExceptionStatusChip } from './monitoring-chips'
import { useEscalateExceptionMutation, useResolveExceptionMutation } from './useMonitoringQuery'
import { useMoment } from './useMoment'

/** Các dòng đọc được của một sự cố: ai báo lúc nào, vì sao lên quản lý, quản lý đã làm gì, ai xử lý. Dùng ở panel chuyến và tab của quản lý. */
export function ExceptionFacts({ exception, userNames }: { exception: TripException; userNames: Readonly<Record<string, string>> }) {
  const t = useT()
  const format = useFormat()
  const moment = useMoment()
  const nameOf = (userId: string | null) => (userId === null ? t('audit.log.system') : (userNames[userId] ?? t('monitoring.exceptions.unknownUser')))
  const { escalation, renegotiation, resolution } = exception
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-small text-ink-2">
      <li>
        {t('monitoring.exceptions.reported', { time: moment(exception.reportedAt), name: nameOf(exception.reportedBy) })}
        {' · '}
        {t('monitoring.exceptions.delay', { count: exception.delayMinutes })}
        {exception.stopNumber === undefined ? null : <>{' · '}{t('monitoring.exceptions.atStop', { number: format.integer(exception.stopNumber) })}</>}
      </li>
      {escalation ? <li>{t(`monitoring.exceptions.escalations.${escalation.reason}`, { time: moment(escalation.at), minutes: ESCALATE_AFTER_MINUTES })}</li> : null}
      {renegotiation ? (
        <>
          <li>{t('monitoring.exceptions.contacted', { time: moment(renegotiation.at), note: renegotiation.contactNote })}</li>
          <li>{t('monitoring.exceptions.newDeadline', { requirementId: renegotiation.requirementId, deadline: moment(renegotiation.deadline), previous: moment(renegotiation.previousDeadline) })}</li>
        </>
      ) : null}
      {resolution ? <li>{t('monitoring.exceptions.resolved', { time: moment(resolution.at), name: nameOf(resolution.by) })}</li> : null}
    </ul>
  )
}

/**
 * Sự cố của chuyến đang chọn ở màn Giám sát (FE-6-11), mới nhất trước. Người có `exceptions.resolve` (điều phối viên) xử lý sự cố còn
 * mở: "Tìm tuyến khác", "Không có tuyến khả thi — chuyển quản lý" (chỉ khi chưa chuyển), "Đã xử lý". Các nút đều là nút phụ: nút chính
 * của màn là "Báo sự cố". Người chỉ xem (quản lý công ty) thấy một dòng lý do.
 */
export function TripExceptionList({ tripId, exceptions, userNames, canResolve, onReroute }: {
  tripId: string
  exceptions: readonly TripException[]
  userNames: Readonly<Record<string, string>>
  canResolve: boolean
  onReroute: () => void
}) {
  const t = useT()
  const escalate = useEscalateExceptionMutation(tripId)
  const resolve = useResolveExceptionMutation(tripId)
  const busy = escalate.isPending || resolve.isPending
  if (exceptions.length === 0) return <p className="m-0 text-small text-ink-3">{t('monitoring.exceptions.none')}</p>

  const run = (mutation: typeof escalate, id: string, done: 'escalated' | 'resolved') =>
    mutation.mutate(id, {
      onSuccess: () => toast.success(t(`monitoring.exceptions.done.${done}`, { id })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })

  return (
    <div className="flex flex-col gap-2.5">
      {!canResolve && exceptions.some(isActiveException) ? <p className="m-0 text-small text-ink-3">{t('monitoring.exceptions.readOnly')}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {exceptions.toReversed().map((exception) => (
          <li key={exception.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <span className="font-mono text-small text-ink-3 tabular-nums">{exception.id}</span>
              <span className="font-semibold text-ink-strong">{t(`common.tripExceptionTypes.${exception.type}`)}</span>
              <ExceptionStatusChip status={exception.status} />
            </div>
            <p className="m-0 text-body text-ink-1">{exception.description}</p>
            <ExceptionFacts exception={exception} userNames={userNames} />
            {canResolve && isActiveException(exception) ? (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" disabled={busy} onClick={onReroute}>{t('monitoring.exceptions.actions.reroute')}</Button>
                {exception.status === 'OPEN' ? (
                  <Button variant="secondary" size="sm" className="h-auto min-h-8 py-1 whitespace-normal" disabled={busy} onClick={() => run(escalate, exception.id, 'escalated')}>
                    {t('monitoring.exceptions.actions.escalate')}
                  </Button>
                ) : null}
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => run(resolve, exception.id, 'resolved')}>{t('monitoring.exceptions.actions.resolve')}</Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
