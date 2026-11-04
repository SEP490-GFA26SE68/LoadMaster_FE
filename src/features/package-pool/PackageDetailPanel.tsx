import { Printer, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { None, PackageStatusBadge } from './package-look'
import type { PackageDetail } from './package-pool-api'
import { PackageDeleteAction } from './PackageDeleteAction'
import { PackageFlagsSection, PackageHistorySection } from './PackageDetailSections'
import { labelsPath } from './packages-list'
import { PACKAGE_POOL_SUPPORT, usePackageDetailQuery } from './usePackagePoolQuery'

const LINK = 'rounded-sm font-mono text-caption text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/**
 * Panel chi tiết kiện (FE-3b-03), cột phải của bảng kho kiện: mã QR (kèm mã chữ), thông tin kiện, yêu cầu giao và chuyến đang giữ kiện, cờ và
 * lịch sử. Lịch sử là `Package.history` kho ghi ở từng lần tạo, chuyển trạng thái, gắn và gỡ cờ — không suy ở màn. Điều phối viên
 * có nút In nhãn (`labels.print`) và Gỡ cờ (`packages.manage`); quản lý công ty chỉ đọc. Nền đặc, viền 1 px — bề mặt đọc lâu, không dùng kính.
 * Mở hoặc đổi kiện thì con trỏ về tiêu đề panel. Nối backend thì phần không có nguồn bị bỏ (`PACKAGE_POOL_SUPPORT`) và điều phối viên xoá
 * được kiện Đã nhập.
 */
export function PackageDetailPanel({ id, packageId, onClose }: {
  id: string
  packageId: string
  onClose: () => void
}) {
  const t = useT()
  const can = useCan()
  const canPrint = can('labels.print')
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const query = usePackageDetailQuery(packageId)
  const detail = query.data
  const pkg = detail?.package
  const loaded = pkg !== undefined

  useEffect(() => {
    if (loaded) titleRef.current?.focus()
  }, [packageId, loaded])

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
            <PackageFacts detail={detail} />
          </section>

          {PACKAGE_POOL_SUPPORT.flags ? <PackageFlagsSection titleId={titleId} pkg={pkg} /> : null}
          {PACKAGE_POOL_SUPPORT.history ? <PackageHistorySection titleId={titleId} history={detail.history} /> : null}
          {PACKAGE_POOL_SUPPORT.deletePackage && can('packages.manage') ? <PackageDeleteAction pkg={pkg} onDeleted={onClose} /> : null}
        </div>
      )}
    </aside>
  )
}

/** Thông tin kiện: chỉ trường nguồn dữ liệu có — backend chỉ trả chiều dài, không có loại kiện hay yêu cầu giao. */
function PackageFacts({ detail }: { detail: PackageDetail }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const { package: pkg, type, trip } = detail
  const tripId = trip?.id ?? pkg.tripId
  const canOpenTrip = can('trips.view') && PACKAGE_POOL_SUPPORT.tripLinks
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      <Field label={t('sourcing.detail.poolId')}><span className="font-mono text-caption">{pkg.id}</span></Field>
      <Field label={t('sourcing.form.handlingClass')}><HandlingClassChip handlingClass={pkg.handlingClass} /></Field>
      {PACKAGE_POOL_SUPPORT.fullSize ? (
        <Field label={t('sourcing.detail.dimensions')}><span className="font-mono text-caption tabular-nums">{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</span></Field>
      ) : (
        <Field label={t('sourcing.detail.length')}><span className="font-mono text-caption tabular-nums">{format.length(pkg.lengthCm)}</span></Field>
      )}
      <Field label={t('sourcing.detail.weight')}><span className="font-mono text-caption tabular-nums">{format.weight(pkg.weightKg)}</span></Field>
      <Field label={t('sourcing.detail.destination')} wide>{pkg.destination === '' ? <None /> : pkg.destination}</Field>
      {PACKAGE_POOL_SUPPORT.packageTypes ? (
        <Field label={t('sourcing.detail.packageType')} wide>{type ? `${type.name} · ${type.id}` : t('sourcing.detail.packageTypeNone')}</Field>
      ) : null}
      <Field label={t('sourcing.detail.source')}>{t(`sourcing.detail.sources.${pkg.source}`)}</Field>
      {PACKAGE_POOL_SUPPORT.links && pkg.requirementId === undefined && pkg.tripId === undefined ? (
        <Field label={t('sourcing.packages.filters.link')}>{t('sourcing.detail.notLinked')}</Field>
      ) : null}
      {pkg.requirementId !== undefined ? (
        <Field label={t('sourcing.detail.requirement')}>
          {can('requirements.view') ? <Link to={`/yeu-cau-giao?q=${encodeURIComponent(pkg.requirementId)}`} className={LINK}>{pkg.requirementId}</Link> : <span className="font-mono text-caption">{pkg.requirementId}</span>}
        </Field>
      ) : null}
      {tripId !== undefined ? (
        <Field label={t('sourcing.detail.trip')}>
          {canOpenTrip ? <Link to={`/chuyen/${encodeURIComponent(tripId)}`} className={LINK}>{trip?.name ?? tripId}</Link> : <span className="font-mono text-caption">{trip?.name ?? tripId}</span>}
        </Field>
      ) : null}
    </dl>
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
