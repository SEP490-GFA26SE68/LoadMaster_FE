
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { ClipboardList } from 'lucide-react'
import { dataErrorMessage, useT } from '@/lib/i18n'

import { listDeliveryRequirements } from '@/features/requirements/requirements-api'
import { assignBackendRequirementToTrip } from './trips-api'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tripId: string
}

export function BackendRequirementAssignDialog({
  open,
  onOpenChange,
  tripId,
}: Props) {
  const t = useT()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const requirements = useQuery({
    queryKey: ['requirements'],
    queryFn: listDeliveryRequirements,
    enabled: open,
  })

  const assign = useMutation({
    mutationFn: (requirementId: string) =>
      assignBackendRequirementToTrip(tripId, requirementId),

    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['trips', tripId, 'backend-detail'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['requirements'],
        }),
        queryClient.invalidateQueries({
          queryKey: ['trips'],
        }),
      ])

      toast.success(t('trips.assign.success'))
      setSelectedId(null)
      onOpenChange(false)
    },
  })

  const pending = (requirements.data ?? []).filter(({ requirement }) =>
    requirement.status === 'PENDING' &&
    !requirement.tripId
  )

  function isReady(
    expected: number | undefined,
    received: number,
  ): boolean {
    return received > 0 &&
      (expected == null || received >= expected)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (assign.isPending) return
        if (!next) setSelectedId(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="flex max-h-[85dvh] w-[calc(100vw-24px)] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader
          icon={ClipboardList}
          title={t('trips.assign.title')}
          description={t('trips.assign.description')}
        />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {requirements.isPending ? (
            <div className="grid min-h-32 place-items-center">
              <Spinner />
            </div>
          ) : requirements.isError ? (
            <Banner tone="danger">
              {dataErrorMessage(requirements.error, t)}
            </Banner>
          ) : pending.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              {t('trips.assign.empty')}
            </div>
          ) : (
            pending.map(({ requirement }) => {
              const received =
                requirement.receivedPackageCount ??
                requirement.packageIds.length

              const expected = requirement.expectedPackageCount
              const ready = isReady(expected, received)
              const selected = selectedId === requirement.id

              return (
                <button
                  key={requirement.id}
                  type="button"
                  disabled={!ready || assign.isPending}
                  aria-pressed={selected}
                  onClick={() => setSelectedId(requirement.id)}
                  className={[
                    'w-full rounded-lg border p-4 text-left transition-colors',
                    selected
                      ? 'border-primary bg-primary/5'
                      : 'border-border',
                    ready
                      ? 'hover:border-primary'
                      : 'cursor-not-allowed opacity-60',
                  ].join(' ')}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        #{requirement.id} — {requirement.customerName ?? '—'}
                      </p>

                      <p className="mt-1 text-sm text-text-2">
                        {requirement.address}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-md border border-border px-2 py-1 text-xs">
                      {received}/{expected ?? '—'} {t('trips.assign.packages')}
                    </span>
                  </div>

                  <div className="mt-3 text-sm">
                    {ready
                      ? t('trips.assign.ready')
                      : t('trips.assign.notReady')}
                  </div>
                </button>
              )
            })
          )}

          {assign.isError ? (
            <Banner tone="danger">
              {dataErrorMessage(assign.error, t)}
            </Banner>
          ) : null}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="secondary"
            disabled={assign.isPending}
            onClick={() => onOpenChange(false)}
          >
            {t('requirements.form.cancel')}
          </Button>

          <Button
            type="button"
            disabled={!selectedId || assign.isPending}
            loading={assign.isPending}
            onClick={() => {
              if (selectedId) assign.mutate(selectedId)
            }}
          >
            {t('trips.assign.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
