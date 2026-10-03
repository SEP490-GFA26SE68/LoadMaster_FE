import { Route } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { RerouteProposal } from '@/lib/mock-db'
import { useConfirmRerouteMutation, useRequestRerouteMutation } from './useMonitoringQuery'

/**
 * Hộp "Tìm tuyến khác" (FE-6-11, D-87): mock đưa ra 2–3 tuyến tới **điểm kế tiếp** từ vị trí xe — tên, quãng đường, thời gian và giờ
 * đến điểm đó — kèm nhãn **MOCK RESULT**. Chọn một tuyến thì xe mô phỏng thôi đứng chờ sự cố và giờ đến tính lại theo vị trí. Thứ tự
 * điểm giao không đổi và bản đồ vẫn vẽ đường nối thẳng: hộp nói rõ điều đó. Mỗi lần mở là một lần tìm mới.
 */
export function RerouteDialog({ tripId, stopName, open, onOpenChange }: {
  tripId: string
  /** Tên điểm giao theo số điểm (1-based) của chuyến. */
  stopName: (stopNumber: number) => string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogContent className="w-[min(36rem,calc(100vw-3rem))]">
          <RerouteBody tripId={tripId} stopName={stopName} onDone={() => onOpenChange(false)} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RerouteBody({ tripId, stopName, onDone }: { tripId: string; stopName: (stopNumber: number) => string; onDone: () => void }) {
  const t = useT()
  const format = useFormat()
  const { mutate: search, data: proposal, error, isPending } = useRequestRerouteMutation(tripId)
  const confirm = useConfirmRerouteMutation(tripId)
  const [chosen, setChosen] = useState<number | null>(null)

  // Tìm tuyến một lần khi hộp mở
  useEffect(() => {
    search()
  }, [search])

  function handleConfirm(found: RerouteProposal) {
    const option = found.options.find((item) => item.index === chosen)
    if (!option) return
    confirm.mutate(option.index, {
      onSuccess: () => {
        toast.success(t('monitoring.reroute.done', { id: tripId, route: t(`monitoring.reroute.routes.${option.route}`) }))
        onDone()
      },
      onError: (failure) => toast.error(dataErrorMessage(failure, t)),
    })
  }

  return (
    <>
      <DialogHeader
        icon={Route}
        title={t('monitoring.reroute.title', { id: tripId })}
        description={proposal
          ? t('monitoring.reroute.description', { number: proposal.stopNumber, name: stopName(proposal.stopNumber), time: format.time(proposal.requestedAt) })
          : t('monitoring.reroute.note')}
      />
      <div className="flex flex-col gap-3 px-7 py-5 max-sm:px-5">
        {error ? (
          <Banner tone="warning">{dataErrorMessage(error, t)}</Banner>
        ) : isPending || !proposal ? (
          <div role="status" aria-label={t('monitoring.reroute.loading')} className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-small font-semibold text-ink-2">{t('monitoring.reroute.options')}</span>
              <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
            </div>
            <div role="radiogroup" aria-label={t('monitoring.reroute.options')} className="flex flex-col gap-2">
              {proposal.options.map((option) => (
                <label
                  key={option.index}
                  className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-checked:border-primary has-checked:bg-primary-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
                >
                  <input
                    type="radio"
                    name="reroute"
                    className="size-4.5 flex-none accent-primary outline-none"
                    checked={chosen === option.index}
                    onChange={() => setChosen(option.index)}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="font-semibold text-ink-strong">{t(`monitoring.reroute.routes.${option.route}`)}</span>
                    <span className="text-small text-ink-2 tabular-nums">
                      {t('monitoring.reroute.measure', { km: format.decimal(option.distanceKm), minutes: format.integer(option.durationMinutes) })}
                      {' · '}
                      {t('monitoring.reroute.eta', { number: proposal.stopNumber, time: format.time(option.eta) })}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <p className="text-note text-ink-3">{t('monitoring.reroute.note')}</p>
          </>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="secondary">{t('monitoring.reroute.close')}</Button>
        </DialogClose>
        {proposal && !error ? (
          <Button type="button" disabled={chosen === null} loading={confirm.isPending} onClick={() => handleConfirm(proposal)}>
            {t('monitoring.reroute.confirm')}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  )
}
