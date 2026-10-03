import { Check, X } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { ManualConfirmRow } from './manual-confirm-api'
import { ManualConfirmRejectDialog } from './ManualConfirmRejectDialog'
import { useApproveManualConfirmMutation, useManualConfirmationsQuery, useRejectManualConfirmMutation } from './useManualConfirmQuery'

/**
 * "Xác nhận tay chờ duyệt" ở Chi tiết chuyến (FE-6-04, D-83): các kiện kho hoặc tài xế xác nhận bằng tay vì nhãn không đọc được — kiện,
 * bước của chuyến, người gửi, lý do, thời điểm. Người có quyền `manualConfirm.approve` (điều phối viên) duyệt — kiện giữ kết quả như đã
 * đối chiếu — hoặc từ chối kèm lý do bắt buộc — kiện phải kiểm lại, người gửi được báo. Người chỉ xem (quản lý công ty) thấy danh sách
 * và một dòng lý do, không có nút. Còn dòng nào ở đây thì kho chưa xong xếp, tài xế chưa hoàn tất điểm được. Không còn xác nhận nào
 * chờ thì thẻ không hiện.
 *
 * Mỗi dòng một cặp nút phụ: màn đã có nút chính của nó, và các dòng ngang hàng nhau (mục 5: một nút chính mỗi màn).
 */
export function ManualConfirmCard({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const titleId = useId()
  const query = useManualConfirmationsQuery(tripId)
  const approve = useApproveManualConfirmMutation(tripId)
  const reject = useRejectManualConfirmMutation(tripId)
  const [rejecting, setRejecting] = useState<ManualConfirmRow | null>(null)
  const rows = query.data ?? []
  if (rows.length === 0) return null
  const canDecide = can('manualConfirm.approve')
  const busy = approve.isPending || reject.isPending

  function handleApprove(row: ManualConfirmRow) {
    approve.mutate(row.id, {
      onSuccess: () => toast.success(t('trips.manualConfirms.approved', { id: row.packageInstanceId })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  async function handleReject(reason: string) {
    if (!rejecting) return
    const row = rejecting
    try {
      await reject.mutateAsync({ confirmationId: row.id, reason })
      toast.success(t('trips.manualConfirms.rejected', { id: row.packageInstanceId }))
      setRejecting(null)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="border-amber-200">
      <CardHeader>
        <CardTitle id={titleId}>{t('trips.manualConfirms.title')}</CardTitle>
        <Badge tone="warning" dot="ring">{t('trips.manualConfirms.count', { count: rows.length })}</Badge>
        <CardMeta className="basis-full">{t('trips.manualConfirms.description')}</CardMeta>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3">
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-body font-semibold text-ink-strong">{row.packageInstanceId}</span>
                <span className="text-body text-ink-1">{row.packageName}</span>
                <span className="text-small text-ink-2">
                  {row.stopNumber === undefined
                    ? t(`common.verifyContexts.${row.context}`)
                    : t('trips.manualConfirms.atStop', { step: t(`common.verifyContexts.${row.context}`), stop: row.stopNumber })}
                </span>
              </span>
              <span className="text-small text-ink-2">
                {t('trips.manualConfirms.sentBy', {
                  name: row.senderName ?? t('trips.manualConfirms.unknownSender'),
                  time: format.time(row.at),
                  date: format.dayMonth(row.at),
                })}
              </span>
              <span className="text-small text-ink-1">
                {t('trips.manualConfirms.reason', { reason: t(`common.manualConfirmReasons.${row.reason}`) })}
                {row.note ? <span className="text-ink-2"> — {row.note}</span> : null}
              </span>
            </div>
            {canDecide ? (
              <div className="flex flex-none items-center gap-2">
                <Button variant="ghost" size="sm" disabled={busy} aria-label={t('trips.manualConfirms.rejectLabel', { id: row.packageInstanceId })} onClick={() => setRejecting(row)}>
                  <X strokeWidth={1.5} />
                  {t('trips.manualConfirms.reject')}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} aria-label={t('trips.manualConfirms.approveLabel', { id: row.packageInstanceId })} onClick={() => handleApprove(row)}>
                  <Check strokeWidth={1.5} />
                  {t('trips.manualConfirms.approve')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canDecide ? null : <p className="border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('trips.manualConfirms.readOnly')}</p>}
      <ManualConfirmRejectDialog
        row={rejecting}
        pending={reject.isPending}
        onOpenChange={(open) => { if (!open) setRejecting(null) }}
        onConfirm={(reason) => void handleReject(reason)}
      />
    </Card>
  )
}
