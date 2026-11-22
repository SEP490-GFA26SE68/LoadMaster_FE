import { Check, X } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { TripClaimRow } from './trip-claims-api'
import { TripClaimRejectDialog } from './TripClaimRejectDialog'
import { useApproveTripClaimMutation, useRejectTripClaimMutation, useTripClaimsQuery } from './useTripClaimsQuery'

/** Phiếu xin chuyến trên Chi tiết chuyến máy chủ; quản lý chỉ xem, điều phối viên có thể duyệt hoặc từ chối. */
export function TripClaimsCard({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const titleId = useId()
  const query = useTripClaimsQuery(tripId)
  const approve = useApproveTripClaimMutation(tripId)
  const reject = useRejectTripClaimMutation(tripId)
  const [rejecting, setRejecting] = useState<TripClaimRow | null>(null)
  const rows = (query.data ?? []).filter((row) => row.status === 'PENDING')
  if (rows.length === 0) return null
  const canDecide = can('trips.edit')
  const busy = approve.isPending || reject.isPending

  function handleApprove(row: TripClaimRow) {
    approve.mutate(row.id, {
      onSuccess: () => toast.success(t('tripClaims.approved', { name: row.driverName })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  async function handleReject(reason: string) {
    if (!rejecting) return
    const row = rejecting
    try {
      await reject.mutateAsync({ claimId: row.id, reason })
      toast.success(t('tripClaims.rejected', { name: row.driverName }))
      setRejecting(null)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="border-amber-200">
      <CardHeader>
        <CardTitle id={titleId}>{t('tripClaims.title', { count: rows.length })}</CardTitle>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3">
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-0.5">
              <span className="font-medium text-ink-strong">{row.driverName}</span>
              <span className="text-small text-ink-2">{row.driverPhone ?? t('tripClaims.noPhone')}</span>
              <span className="text-small text-ink-2">{t('tripClaims.sentAt', { time: format.time(row.createdAt), date: format.dayMonth(row.createdAt) })}</span>
              {row.note ? <span className="text-small text-ink-1">{t('tripClaims.note', { note: row.note })}</span> : null}
            </div>
            {canDecide ? (
              <div className="flex flex-none items-center gap-2">
                <Button variant="ghost" size="sm" disabled={busy} aria-label={t('tripClaims.rejectLabel', { name: row.driverName })} onClick={() => setRejecting(row)}>
                  <X strokeWidth={1.5} />
                  {t('tripClaims.reject')}
                </Button>
                <Button variant="secondary" size="sm" disabled={busy} aria-label={t('tripClaims.approveLabel', { name: row.driverName })} onClick={() => handleApprove(row)}>
                  <Check strokeWidth={1.5} />
                  {t('tripClaims.approve')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canDecide ? null : <p className="border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('tripClaims.readOnly')}</p>}
      <TripClaimRejectDialog
        row={rejecting}
        pending={reject.isPending}
        onOpenChange={(open) => { if (!open) setRejecting(null) }}
        onConfirm={(reason) => void handleReject(reason)}
      />
    </Card>
  )
}
