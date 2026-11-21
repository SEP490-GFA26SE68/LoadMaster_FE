import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { usesBackend } from '@/lib/backend-config'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PendingTripClaimRow } from './trip-claims-api'
import { TripClaimRejectDialog } from './TripClaimRejectDialog'
import { useApprovePendingTripClaimMutation, usePendingTripClaimsQuery, useRejectPendingTripClaimMutation } from './useTripClaimsQuery'

/** Hàng đợi phiếu chỉ có khi nhóm chuyến đã nối backend; bản kho mẫu không tạo dữ liệu giả. */
export function TripClaimsPage() {
  return usesBackend('trips') ? <BackendTripClaimsPage /> : <Navigate to="/chuyen" replace />
}

function BackendTripClaimsPage() {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const canDecide = can('trips.edit')
  const query = usePendingTripClaimsQuery()
  const approve = useApprovePendingTripClaimMutation()
  const reject = useRejectPendingTripClaimMutation()
  const [rejecting, setRejecting] = useState<PendingTripClaimRow | null>(null)
  const rows = query.data ?? []
  const busy = approve.isPending || reject.isPending

  function handleApprove(row: PendingTripClaimRow) {
    approve.mutate({ tripId: row.tripId, claimId: row.claimId }, {
      onSuccess: () => toast.success(t('tripClaims.approved', { name: row.driverName })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  async function handleReject(reason: string) {
    if (!rejecting) return
    const row = rejecting
    try {
      await reject.mutateAsync({ tripId: row.tripId, claimId: row.claimId, reason })
      toast.success(t('tripClaims.rejected', { name: row.driverName }))
      setRejecting(null)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('tripClaims.pageTitle')} />
      <div className="min-h-0 flex-1 overflow-auto px-shell py-6">
        {query.isPending ? (
          <div role="status" aria-label={t('tripClaims.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <Banner tone="danger" role="alert" action={(
            <Button variant="primary" size="sm" loading={query.isFetching} onClick={() => void query.refetch()}>
              {t('tripClaims.retry')}
            </Button>
          )}>
            {t('tripClaims.listLoadError')} {dataErrorMessage(query.error, t)}
          </Banner>
        ) : rows.length === 0 ? (
          <EmptyState mascot="empty" title={t('tripClaims.empty')} />
        ) : (
          <div className="flex flex-col gap-3">
            <ul className="flex flex-col gap-3">
              {rows.map((row) => (
                <li key={`${row.tripId}-${row.claimId}`}>
                  <Card>
                    <CardHeader>
                      <CardTitle>{row.tripName ?? t('tripClaims.unnamedTrip')}</CardTitle>
                      {row.tripCode ? <CardMeta className="font-mono">{row.tripCode}</CardMeta> : null}
                    </CardHeader>
                    <CardBody className="flex flex-wrap items-start gap-x-8 gap-y-4">
                      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                        <p className="text-small text-ink-1">
                          {row.departureTime
                            ? t('tripClaims.departureAt', { time: format.time(row.departureTime), date: format.dayMonth(row.departureTime) })
                            : t('tripClaims.departureUnknown')}
                        </p>
                        <p className="text-small text-ink-1">{t('tripClaims.origin', { name: row.originWarehouse ?? t('tripClaims.originUnknown') })}</p>
                        <p className="text-small text-ink-1">{t('tripClaims.stopCount', { count: row.stopCount })}</p>
                      </div>
                      <div className="flex min-w-64 flex-1 flex-col gap-1.5">
                        <span className="font-medium text-ink-strong">{row.driverName}</span>
                        <span className="text-small text-ink-2">{row.driverPhone ?? t('tripClaims.noPhone')}</span>
                        <span className="text-small text-ink-2">
                          {t('tripClaims.sentAt', { time: format.time(row.createdAt), date: format.dayMonth(row.createdAt) })}
                        </span>
                        {row.note ? <span className="text-small text-ink-1">{t('tripClaims.note', { note: row.note })}</span> : null}
                      </div>
                      <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
                        <Button variant="secondary" size="sm" asChild>
                          <Link to={`/chuyen/${encodeURIComponent(row.tripId)}`}>{t('tripClaims.viewTrip')}</Link>
                        </Button>
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
                      </div>
                    </CardBody>
                  </Card>
                </li>
              ))}
            </ul>
            {canDecide ? null : <p className="text-note text-ink-3">{t('tripClaims.readOnly')}</p>}
          </div>
        )}
      </div>
      {canDecide ? (
        <TripClaimRejectDialog
          row={rejecting}
          pending={reject.isPending}
          onOpenChange={(open) => { if (!open) setRejecting(null) }}
          onConfirm={(reason) => void handleReject(reason)}
        />
      ) : null}
    </div>
  )
}
