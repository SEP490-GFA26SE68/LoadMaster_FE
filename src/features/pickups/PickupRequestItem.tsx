import { Check, Printer, RefreshCw, X } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { labelsPath } from '@/features/package-pool/packages-list'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { PICKUP_STATUS_LOOK } from './pickup-look'
import { PickupRulesList } from './PickupRulesList'
import type { PickupRow } from './pickups-api'
import { useValidatePickupMutation } from './usePickupsQuery'

/**
 * Một yêu cầu nhận hàng dọc đường trong thẻ của chuyến (FE-7-03): mã, trạng thái, điểm nhận → điểm giao, số kiện và khối lượng, hạn,
 * người gửi; số luật đạt kèm danh sách mười luật mở ra được; lý do vượt luật hoặc từ chối nếu có. Yêu cầu còn chờ duyệt kiểm lại luật
 * được (theo `pickups.create`) — xe đã đi tiếp nên kết quả có thể khác lúc gửi. Điều phối viên (`pickups.approve`) có cặp nút phụ Từ chối /
 * Duyệt ở yêu cầu còn chờ; yêu cầu đã duyệt có lối in nhãn gửi bên gửi (`labels.print`).
 */
export function PickupRequestItem({ tripId, row, stopLabel, onApprove, onReject }: {
  tripId: string
  row: PickupRow
  stopLabel: (stopId: string) => string
  /** Có mặt khi người xem có `pickups.approve`: Duyệt, Từ chối cho yêu cầu còn chờ. */
  onApprove?: (row: PickupRow) => void
  onReject?: (row: PickupRow) => void
}) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const validate = useValidatePickupMutation(tripId)
  const { request } = row
  const look = PICKUP_STATUS_LOOK[request.status]
  const results = request.validationResults
  const passed = results.filter((result) => result.passed).length
  const weightKg = request.packages.reduce((sum, pkg) => sum + pkg.weightKg, 0)
  const waiting = request.status === 'PENDING' || request.status === 'VALIDATED'
  const printable = request.packageIds !== undefined && request.packageIds.length > 0 && can('labels.print')
  const moment = { time: format.time(request.createdAt), date: format.dayMonth(request.createdAt) }

  function handleRecheck() {
    validate.mutate(request.id, { onError: (error) => toast.error(dataErrorMessage(error, t)) })
  }

  return (
    <li data-pickup-id={request.id} data-status={request.status} className="flex flex-col gap-2 px-4.5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-body font-semibold text-ink-strong">{request.id}</span>
        <Badge tone={look.tone} dot={look.dot}>{t(`pickups.status.${request.status}`)}</Badge>
        <span className="min-w-0 text-body text-ink-1">
          {t('pickups.card.from', { name: request.pickup.name })} → {t('pickups.card.to', { name: request.delivery.name })}
        </span>
      </div>
      <p className="m-0 text-small text-ink-2">
        {t('pickups.card.packages', { count: request.packages.length, weight: format.weight(weightKg) })}
        {request.deadline === undefined ? '' : ` · ${t('pickups.card.deadline', { time: format.time(request.deadline), date: format.dayMonth(request.deadline) })}`}
        {' · '}
        {row.createdByName === null ? t('pickups.card.sentBy', moment) : t('pickups.card.sentByName', { ...moment, name: row.createdByName })}
      </p>
      {request.overrideReason === undefined ? null : <p className="m-0 text-small text-ink-1">{t('pickups.card.override', { reason: request.overrideReason })}</p>}
      {request.rejectReason === undefined ? null : <p className="m-0 text-small text-ink-1">{t('pickups.card.rejected', { reason: request.rejectReason })}</p>}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-small font-medium text-ink-2">
          {results.length === 0 ? t('pickups.card.rulesNotChecked') : t('pickups.card.rulesPassed', { passed, total: results.length })}
        </span>
        {waiting && can('pickups.create') ? (
          <Button variant="ghost" size="sm" loading={validate.isPending} aria-label={t('pickups.card.recheckLabel', { id: request.id })} onClick={handleRecheck}>
            <RefreshCw strokeWidth={1.5} />
            {t('pickups.card.recheck')}
          </Button>
        ) : null}
        {waiting && onApprove && onReject ? (
          <div className="ml-auto flex flex-none items-center gap-2">
            <Button variant="ghost" size="sm" aria-label={t('pickups.actions.rejectLabel', { id: request.id })} onClick={() => onReject(row)}>
              <X strokeWidth={1.5} />
              {t('pickups.actions.reject')}
            </Button>
            <Button variant="secondary" size="sm" aria-label={t('pickups.actions.approveLabel', { id: request.id })} onClick={() => onApprove(row)}>
              <Check strokeWidth={1.5} />
              {t('pickups.actions.approve')}
            </Button>
          </div>
        ) : null}
        {printable ? (
          <Button asChild variant="secondary" size="sm" className="ml-auto">
            <Link to={labelsPath(request.packageIds ?? [])} aria-label={t('pickups.actions.printLabelsLabel', { id: request.id })}>
              <Printer strokeWidth={1.5} />
              {t('pickups.actions.printLabels')}
            </Link>
          </Button>
        ) : null}
      </div>
      {results.length > 0 ? (
        <details className="group">
          <summary className="w-fit cursor-pointer rounded-sm text-small font-semibold text-primary outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {t('pickups.card.showRules')}
          </summary>
          <PickupRulesList results={results} stopLabel={stopLabel} className="mt-2" />
        </details>
      ) : null}
    </li>
  )
}
