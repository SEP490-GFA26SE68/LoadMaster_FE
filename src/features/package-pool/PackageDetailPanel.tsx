import { FlagOff, Printer, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import type { PackageFlag } from '@/lib/mock-db'
import { PackageFlagTag, PackageStatusBadge } from './package-look'
import type { PackageHistoryLine } from './package-pool-api'
import { labelsPath } from './packages-list'
import { useClearPackageFlagMutation, usePackageDetailQuery } from './usePackagePoolQuery'

const LINK = 'rounded-sm font-mono text-caption text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/** Câu của một mốc lịch sử: mã của kho → nhãn theo ngôn ngữ. */
function eventText(entry: PackageHistoryLine, t: TFunction): string {
  switch (entry.kind) {
    case 'created':
      return t('sourcing.detail.events.created', { source: t(`sourcing.detail.sources.${entry.source}`) })
    case 'status': {
      const params = { from: t(`common.packageStatuses.${entry.from}`), to: t(`common.packageStatuses.${entry.to}`) }
      return entry.tripId === undefined ? t('sourcing.detail.events.status', params) : t('sourcing.detail.events.statusTrip', { ...params, tripId: entry.tripId })
    }
    case 'flagged':
      return t('sourcing.detail.events.flagged', { flag: t(`common.packageFlags.${entry.flag}`) })
    case 'flagCleared':
      return t('sourcing.detail.events.flagCleared', { flag: t(`common.packageFlags.${entry.flag}`) })
  }
}

/**
 * Panel chi tiết kiện (FE-3b-03), cột phải của bảng kho kiện: mã QR (kèm mã chữ), thông tin kiện, đơn và chuyến đang giữ kiện, cờ và
 * lịch sử. Lịch sử là `Package.history` kho ghi ở từng lần tạo, chuyển trạng thái, gắn và gỡ cờ — không suy ở màn. Điều phối viên
 * có nút In nhãn (`labels.print`) và Gỡ cờ (`packages.manage`); quản lý công ty chỉ đọc. Nền đặc, viền 1 px — bề mặt đọc lâu, không dùng kính.
 * Mở hoặc đổi kiện thì con trỏ về tiêu đề panel.
 */
export function PackageDetailPanel({ id, packageId, onClose }: {
  id: string
  packageId: string
  onClose: () => void
}) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const canManage = can('packages.manage')
  const canPrint = can('labels.print')
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const query = usePackageDetailQuery(packageId)
  const clear = useClearPackageFlagMutation()
  const detail = query.data
  const pkg = detail?.package
  const loaded = pkg !== undefined

  useEffect(() => {
    if (loaded) titleRef.current?.focus()
  }, [packageId, loaded])

  function handleClear(flag: PackageFlag) {
    if (!pkg) return
    clear.mutate({ id: pkg.id, flag }, {
      onSuccess: () => toast.success(t('sourcing.detail.flagCleared', { flag: t(`common.packageFlags.${flag}`), code: pkg.packageCode })),
    })
  }

  return (
    <aside
      id={id}
      aria-label={t('sourcing.detail.region', { code: pkg?.packageCode ?? packageId })}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-bg xl:sticky xl:top-0 xl:max-h-[calc(100dvh-236px)]"
    >
      <header className="flex flex-none items-start gap-3 border-b border-border py-4 pr-2 pl-4">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="max-w-full rounded-sm font-mono text-h3 font-semibold text-ink-strong outline-none wrap-anywhere">
            {pkg?.packageCode ?? packageId}
          </h2>
          {pkg ? <PackageStatusBadge status={pkg.status} /> : null}
        </div>
        <button
          type="button"
          aria-label={t('sourcing.detail.close')}
          onClick={onClose}
          className="grid size-9 flex-none cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </header>

      {query.isPending ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !detail || !pkg ? (
        <div className="p-4"><Banner tone="danger">{query.error ? dataErrorMessage(query.error, t) : t('sourcing.detail.loadError')}</Banner></div>
      ) : (
        <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-4">
          <div className="flex flex-col items-center gap-3">
            <QrCode token={pkg.qrToken} size={148} showToken />
            {canPrint ? (
              <Button variant="secondary" size="sm" asChild>
                <Link to={labelsPath([pkg.id])}><Printer strokeWidth={1.5} />{t('sourcing.detail.printLabel')}</Link>
              </Button>
            ) : null}
          </div>

          <section aria-labelledby={`${titleId}-info`} className="flex flex-col gap-3">
            <h3 id={`${titleId}-info`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.info')}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label={t('sourcing.detail.poolId')}><span className="font-mono text-caption">{pkg.id}</span></Field>
              <Field label={t('sourcing.form.handlingClass')}><HandlingClassChip handlingClass={pkg.handlingClass} /></Field>
              <Field label={t('sourcing.detail.dimensions')}><span className="font-mono text-caption tabular-nums">{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</span></Field>
              <Field label={t('sourcing.detail.weight')}><span className="font-mono text-caption tabular-nums">{format.weight(pkg.weightKg)}</span></Field>
              <Field label={t('sourcing.detail.destination')} wide>{pkg.destination}</Field>
              <Field label={t('sourcing.detail.packageType')} wide>{detail.type ? `${detail.type.name} · ${detail.type.id}` : t('sourcing.detail.packageTypeNone')}</Field>
              <Field label={t('sourcing.detail.source')}>{t(`sourcing.detail.sources.${pkg.source}`)}</Field>
              {pkg.orderId === undefined && pkg.requirementId === undefined && pkg.tripId === undefined ? (
                <Field label={t('sourcing.packages.filters.link')}>{t('sourcing.detail.notLinked')}</Field>
              ) : null}
              {pkg.orderId !== undefined ? (
                <Field label={t('sourcing.detail.order')}>
                  {can('orders.view') ? <Link to={`/don-hang?q=${encodeURIComponent(pkg.orderId)}`} className={LINK}>{pkg.orderId}</Link> : <span className="font-mono text-caption">{pkg.orderId}</span>}
                </Field>
              ) : null}
              {pkg.tripId !== undefined ? (
                <Field label={t('sourcing.detail.trip')}>
                  {can('trips.view') ? <Link to={`/chuyen/${encodeURIComponent(pkg.tripId)}`} className={LINK}>{pkg.tripId}</Link> : <span className="font-mono text-caption">{pkg.tripId}</span>}
                </Field>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby={`${titleId}-flags`} className="flex flex-col gap-2">
            <h3 id={`${titleId}-flags`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.flags')}</h3>
            {pkg.flags.length === 0 ? (
              <p className="text-small text-ink-2">{t('sourcing.detail.noFlags')}</p>
            ) : (
              <>
                <ul className="flex flex-col gap-2">
                  {pkg.flags.map((flag) => (
                    <li key={flag} className="flex items-center justify-between gap-2">
                      <PackageFlagTag flag={flag} />
                      {canManage ? (
                        <Button variant="secondary" size="sm" loading={clear.isPending && clear.variables?.flag === flag} aria-label={t('sourcing.detail.clearFlagLabel', { flag: t(`common.packageFlags.${flag}`) })} onClick={() => handleClear(flag)}>
                          <FlagOff strokeWidth={1.5} />
                          {t('sourcing.detail.clearFlag')}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="text-fine text-ink-3">{t('sourcing.detail.flagNote')}</p>
                {clear.error ? <Banner tone="danger">{dataErrorMessage(clear.error, t)}</Banner> : null}
              </>
            )}
          </section>

          <section aria-labelledby={`${titleId}-history`} className="flex flex-col gap-2">
            <h3 id={`${titleId}-history`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.history')}</h3>
            <ol aria-labelledby={`${titleId}-history`} className="flex flex-col">
              {detail.history.map((entry, index) => (
                <li key={`${entry.at}-${index}`} className="flex flex-col gap-0.5 border-l border-border py-1.5 pl-3">
                  <span className="text-small text-ink-1">{eventText(entry, t)}</span>
                  <span className="text-fine text-ink-3 tabular-nums">
                    {entry.actorName === null
                      ? t('sourcing.detail.historyAt', { time: format.time(entry.at), date: format.date(entry.at) })
                      : t('sourcing.detail.historyBy', { time: format.time(entry.at), date: format.date(entry.at), name: entry.actorName })}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </aside>
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
