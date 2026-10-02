import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { None, PackageFlagTag, PackageStatusBadge } from '@/features/package-pool/package-look'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { RequirementRow } from './requirements-api'
import { RequirementPriorityTag, RequirementStatusBadge } from './requirement-look'
import { useRequirementQuery } from './useRequirementsQuery'

const LINK = 'rounded-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * Chi tiết một yêu cầu giao (FE-4b-02), chỉ đọc — quản lý công ty và điều phối viên cùng xem: điểm đến, địa chỉ, toạ độ, hạn, ưu tiên,
 * ghi chú, người lập, chuyến đang chở và từng kiện kèm trạng thái, cờ. Đọc lại từ kho mỗi lần mở (trạng thái kiện đổi theo chuyến).
 */
export function RequirementDetailDialog({ requirementId, onClose }: { requirementId: string | null; onClose: () => void }) {
  return (
    <Dialog open={requirementId !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-200">
        {requirementId ? <Detail requirementId={requirementId} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function Detail({ requirementId, onClose }: { requirementId: string; onClose: () => void }) {
  const t = useT()
  const query = useRequirementQuery(requirementId)
  const row = query.data
  return (
    <>
      <DialogHeader title={t('requirements.detail.title', { id: requirementId })} description={row?.requirement.destinationName} className="pb-1" />
      {query.isPending ? (
        <div className="grid place-items-center py-12"><Spinner /></div>
      ) : !row ? (
        <div className="px-7 py-5"><Banner tone="danger">{query.error ? dataErrorMessage(query.error, t) : t('requirements.detail.loadError')}</Banner></div>
      ) : (
        <DetailBody row={row} />
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onClose}>{t('requirements.detail.close')}</Button>
      </DialogFooter>
    </>
  )
}

function DetailBody({ row }: { row: RequirementRow }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const { requirement, trip } = row
  const dateTime = (value: string) => t('requirements.detail.dateTime', { time: format.time(value), date: format.date(value) })

  return (
    <div className="flex max-h-[60dvh] flex-col gap-5 overflow-y-auto px-7 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <RequirementStatusBadge status={row.status} />
        <RequirementPriorityTag priority={requirement.priority} />
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3.5">
        <Field label={t('requirements.detail.address')} wide>{requirement.address}</Field>
        <Field label={t('requirements.detail.deadline')}><span className="font-mono text-caption tabular-nums">{dateTime(requirement.deadline)}</span></Field>
        <Field label={t('requirements.detail.coordinates')}>
          {requirement.lat === undefined || requirement.lng === undefined
            ? <span className="text-ink-3">{t('requirements.detail.noCoordinates')}</span>
            : <span className="font-mono text-caption tabular-nums">{requirement.lat.toFixed(4)}, {requirement.lng.toFixed(4)}</span>}
        </Field>
        <Field label={t('requirements.detail.trip')}>
          {!trip ? <span className="text-ink-3">{t('requirements.notAssigned')}</span> : (
            <span className="flex flex-col">
              {can('trips.view') ? <Link to={`/chuyen/${trip.id}`} className={LINK}>{trip.name}</Link> : trip.name}
              <span className="font-mono text-caption text-ink-3">
                {row.stopNumber === undefined ? trip.id : `${trip.id} · ${t('requirements.stop', { number: row.stopNumber })}`}
              </span>
            </span>
          )}
        </Field>
        <Field label={t('requirements.detail.createdBy')}>{row.createdByName ?? requirement.createdBy ?? <None />}</Field>
        <Field label={t('requirements.detail.note')} wide>
          {requirement.note ?? <span className="text-ink-3">{t('requirements.detail.noNote')}</span>}
        </Field>
        <Field label={t('requirements.detail.createdAt')}><span className="font-mono text-caption tabular-nums">{dateTime(requirement.createdAt)}</span></Field>
      </dl>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-body font-semibold text-ink-strong">{t('requirements.detail.packages')}</h3>
          <span className="text-small text-ink-2 tabular-nums">{t('requirements.detail.total', { count: row.packages.length, weight: format.weight(row.totalKg) })}</span>
        </div>
        <div className="relative overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-150 text-left text-small">
            <caption className="sr-only">{t('requirements.detail.packages')}</caption>
            <thead className="bg-table-head text-caption font-semibold text-ink-2">
              <tr>
                <th scope="col" className="px-3 py-2">{t('requirements.detail.packageColumns.code')}</th>
                <th scope="col" className="px-3 py-2">{t('requirements.detail.packageColumns.handlingClass')}</th>
                <th scope="col" className="px-3 py-2">{t('requirements.detail.packageColumns.measure')}</th>
                <th scope="col" className="px-3 py-2">{t('requirements.detail.packageColumns.destination')}</th>
                <th scope="col" className="px-3 py-2">{t('requirements.detail.packageColumns.status')}</th>
              </tr>
            </thead>
            <tbody>
              {row.packages.map(({ package: pkg }) => (
                <tr key={pkg.id} className="border-t border-line-soft align-top">
                  <th scope="row" className="px-3 py-2 font-normal">
                    <span className="flex flex-col">
                      <span className="font-mono text-caption font-medium text-ink-strong">{pkg.packageCode}</span>
                      <span className="font-mono text-note text-ink-3">{pkg.id}</span>
                    </span>
                  </th>
                  <td className="px-3 py-2"><HandlingClassChip handlingClass={pkg.handlingClass} /></td>
                  <td className="px-3 py-2 font-mono text-caption text-ink-1 tabular-nums">
                    {format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)} · {format.weight(pkg.weightKg)}
                  </td>
                  <td className="px-3 py-2 text-ink-1">{pkg.destination}</td>
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <PackageStatusBadge status={pkg.status} />
                      {pkg.flags.map((flag) => <PackageFlagTag key={flag} flag={flag} />)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={wide ? 'col-span-2 flex flex-col gap-0.5' : 'flex min-w-0 flex-col items-start gap-0.5'}>
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="text-body text-ink-1">{children}</dd>
    </div>
  )
}
