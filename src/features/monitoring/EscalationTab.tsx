import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import { ESCALATE_AFTER_MINUTES } from '@/lib/mock-db'
import type { MonitoringBoard } from './monitoring-api'
import { DeadlineChip, ExceptionStatusChip } from './monitoring-chips'
import { escalationRows, type EscalationRow } from './monitoring-view'
import { RenegotiateDialog } from './RenegotiateDialog'
import { ExceptionFacts } from './TripExceptionList'
import { useMoment } from './useMoment'
import { useFleetMonitoringQuery } from './useTrackingQuery'

/**
 * Tab "Sự cố cần xử lý" của quản lý công ty (FE-6-12, D-66): sự cố điều phối viên đã chuyển lên hoặc kho tự chuyển sau 30 phút — sự cố,
 * chuyến, các điểm chưa giao có hạn kèm giờ đến dự kiến, hạn và mức hạn. Mỗi dòng một nút phụ "Nhập hạn mới" mở hộp liên hệ khách; các
 * dòng ngang hàng nhau nên tab không có nút chính. Sự cố đã nhập hạn mới ở lại danh sách, kèm câu chờ điều phối viên xử lý tiếp, tới
 * khi điều phối viên đánh dấu đã xử lý.
 */
export function EscalationTab({ board }: { board: MonitoringBoard }) {
  const t = useT()
  const fleet = useFleetMonitoringQuery(true).data
  const [target, setTarget] = useState<EscalationRow | null>(null)
  const rows = escalationRows(board, fleet ?? [])
  if (fleet !== undefined && rows.length === 0) {
    return (
      <Card className="py-6">
        <EmptyState icon={CircleCheck} title={t('monitoring.escalations.empty.title')} description={t('monitoring.escalations.empty.description', { minutes: ESCALATE_AFTER_MINUTES })} />
      </Card>
    )
  }
  return (
    <>
      <ul aria-label={t('monitoring.escalations.label')} className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => (
          <EscalationItem key={row.exception.id} row={row} userNames={board.userNames} onRenegotiate={setTarget} />
        ))}
      </ul>
      <RenegotiateDialog row={target} onOpenChange={(open) => { if (!open) setTarget(null) }} />
    </>
  )
}

function EscalationItem({ row, userNames, onRenegotiate }: { row: EscalationRow; userNames: Readonly<Record<string, string>>; onRenegotiate: (row: EscalationRow) => void }) {
  const t = useT()
  const format = useFormat()
  const moment = useMoment()
  const { exception, trip, stops } = row
  return (
    <li>
      <Card className="flex flex-col gap-3 p-4.5">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="font-mono text-small text-ink-3 tabular-nums">{exception.id}</span>
          <h2 className="m-0 font-display text-h3 font-[650] text-ink-strong">{t(`common.tripExceptionTypes.${exception.type}`)}</h2>
          <ExceptionStatusChip status={exception.status} />
        </div>
        <p className="m-0 text-body text-ink-1">{exception.description}</p>
        <ExceptionFacts exception={exception} userNames={userNames} />
        <p className="m-0 text-small text-ink-2">
          <Link to={`/chuyen/${encodeURIComponent(trip.tripId)}`} className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline">
            {t('monitoring.escalations.trip', { id: trip.tripId })}
          </Link>
          {' · '}{trip.name}{' · '}<VehicleName name={trip.vehicleName} />
        </p>
        {stops.length === 0 ? (
          <p className="m-0 text-small text-ink-3">{t('monitoring.escalations.noStop')}</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {stops.map((stop) => (
              <li key={stop.stopId} className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-small text-ink-1">
                <span className="font-medium">{t('monitoring.escalations.stop', { number: format.integer(stop.number), name: stop.name })}</span>
                <span className="tabular-nums">{t(stop.arrived ? 'monitoring.list.arrived' : 'monitoring.escalations.eta', { time: moment(stop.eta) })}</span>
                {stop.deadline === undefined ? null : <span className="tabular-nums">{t('monitoring.escalations.deadline', { time: moment(stop.deadline) })}</span>}
                <DeadlineChip status={stop.deadlineStatus} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => onRenegotiate(row)}>{t('monitoring.escalations.renegotiate')}</Button>
          {exception.renegotiation ? <span className="text-small text-ink-2">{t('monitoring.escalations.waiting')}</span> : null}
        </div>
      </Card>
    </li>
  )
}
