import { ChevronLeft, CircleCheck, ExternalLink, FlagOff, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { HandlingClassChip } from '@/components/HandlingClassChip'
import { QrCode } from '@/components/QrCode'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { PackageFlag } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { PackageFlagTag, PackageStatusBadge } from './package-look'
import { lookupActions } from './package-lookup'
import type { PackageLookup } from './package-pool-api'
import { labelsPath } from './packages-list'
import { useClearPackageFlagMutation, useReportPackageFoundMutation } from './usePackagePoolQuery'

/** Chip và nhãn cỡ cảm ứng: chữ 16 px như phần còn lại của màn kho (AGENTS mục 10). */
const TOUCH_CHIP = 'h-8 px-3 text-body-lg'

/**
 * Thẻ một kiện của màn Tra cứu kiện (FE-3b-06): mã, kích thước, khối lượng, loại hàng, điểm đến, trạng thái, cờ, chuyến và điểm giao.
 * Hành động theo vai trò (`lookupActions`): ai có `labels.print` in lại nhãn; điều phối viên gỡ cờ, mở kiện ở Kho kiện và mở chuyến;
 * nhân viên kho xác nhận đã tìm thấy kiện mang cờ "Không tìm thấy" (D-92). Nền đặc, viền 1 px — bề mặt đọc lâu. `touch`: máy tính bảng
 * của kho — nút 56 px, chữ từ 16 px.
 */
export function PackageLookupCard({ item, touch, justFound, onFound, onBack }: {
  item: PackageLookup
  touch: boolean
  /** Kiện vừa được gỡ cờ "Không tìm thấy" trong lần tra này: hiện dòng xác nhận. */
  justFound: boolean
  onFound: (packageId: string) => void
  /** Về danh sách kiện trùng mã; vắng khi mã chỉ khớp một kiện. */
  onBack?: () => void
}) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const { package: pkg, trip, stop } = item
  const actions = lookupActions(pkg, can)
  const clear = useClearPackageFlagMutation()
  const found = useReportPackageFoundMutation()
  const size = touch ? 'touch' : 'md'
  const chip = touch ? TOUCH_CHIP : undefined
  const mono = cn('font-mono tabular-nums', touch ? 'text-body-lg' : 'text-body')

  function handleClear(flag: PackageFlag) {
    clear.mutate({ id: pkg.id, flag }, {
      onSuccess: () => toast.success(t('lookup.flagCleared', { flag: t(`common.packageFlags.${flag}`), code: pkg.packageCode })),
    })
  }

  return (
    <Card role="region" aria-label={t('lookup.result', { code: pkg.packageCode })} className={cn('flex flex-col gap-5 p-5', touch && 'text-body-lg')}>
      {onBack ? (
        <Button variant="ghost" size={touch ? 'touch' : 'sm'} className="self-start" onClick={onBack}>
          <ChevronLeft strokeWidth={1.5} />{t('lookup.many.back')}
        </Button>
      ) : null}

      <header className="flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h2 className="max-w-full font-mono text-[22px] leading-7 font-semibold text-ink-strong wrap-anywhere">{pkg.packageCode}</h2>
          <span className="flex flex-wrap items-center gap-2">
            <PackageStatusBadge status={pkg.status} className={chip} />
            {pkg.flags.map((flag) => <PackageFlagTag key={flag} flag={flag} className={touch ? 'h-8 px-2.5 text-body-lg' : undefined} />)}
          </span>
        </div>
        <QrCode token={pkg.qrToken} size={96} className="flex-none" />
      </header>

      {justFound ? <Banner tone="info" icon={CircleCheck} className={touch ? 'text-body-lg' : undefined}>{t('lookup.found.done', { code: pkg.packageCode })}</Banner> : null}

      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
        <Fact label={t('lookup.fields.poolId')} touch={touch}><span className={mono}>{pkg.id}</span></Fact>
        <Fact label={t('lookup.fields.senderCode')} touch={touch}><span className={cn(mono, 'wrap-anywhere')}>{pkg.packageCode}</span></Fact>
        <Fact label={t('lookup.fields.qrToken')} touch={touch}><span className={mono}>{pkg.qrToken}</span></Fact>
        <Fact label={t('lookup.fields.dimensions')} touch={touch}><span className={mono}>{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</span></Fact>
        <Fact label={t('lookup.fields.weight')} touch={touch}><span className={mono}>{format.weight(pkg.weightKg)}</span></Fact>
        <Fact label={t('lookup.fields.handlingClass')} touch={touch}><HandlingClassChip handlingClass={pkg.handlingClass} className={chip} /></Fact>
        <Fact label={t('lookup.fields.destination')} touch={touch} wide>{pkg.destination}</Fact>
        <Fact label={t('lookup.fields.trip')} touch={touch}>
          {pkg.tripId === undefined ? t('lookup.fields.notInTrip') : (
            <span className="flex flex-col">
              {actions.openTrip
                ? <Link to={`/chuyen/${encodeURIComponent(pkg.tripId)}`} className={cn(mono, 'self-start rounded-sm text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary')}>{pkg.tripId}</Link>
                : <span className={mono}>{pkg.tripId}</span>}
              {trip ? <span>{trip.name}</span> : null}
            </span>
          )}
        </Fact>
        {stop ? <Fact label={t('lookup.fields.stop')} touch={touch} wide>{t('lookup.fields.stopValue', { number: stop.number, name: stop.name })}</Fact> : null}
        {pkg.flags.length === 0 ? <Fact label={t('lookup.fields.flags')} touch={touch}>{t('lookup.fields.noFlags')}</Fact> : null}
      </dl>

      {pkg.flags.length > 0 ? (
        <section aria-label={t('lookup.fields.flags')} className="flex flex-col gap-3 border-t border-line-soft pt-4">
          {actions.confirmFound ? <p className="m-0 text-ink-1">{t('lookup.found.prompt')}</p> : <p className="m-0 text-ink-2">{t('lookup.flagNote')}</p>}
          <div className="flex flex-wrap gap-2">
            {actions.confirmFound ? (
              <Button variant="secondary" size={size} loading={found.isPending} onClick={() => found.mutate(pkg.qrToken, { onSuccess: () => onFound(pkg.id) })}>
                <CircleCheck strokeWidth={1.5} />{t('lookup.found.confirm')}
              </Button>
            ) : null}
            {actions.clearFlags.map((flag) => (
              <Button key={flag} variant="secondary" size={size} loading={clear.isPending && clear.variables?.flag === flag} onClick={() => handleClear(flag)}>
                <FlagOff strokeWidth={1.5} />{t('sourcing.detail.clearFlagLabel', { flag: t(`common.packageFlags.${flag}`) })}
              </Button>
            ))}
          </div>
          {clear.error ?? found.error ? <Banner tone="danger">{dataErrorMessage(clear.error ?? found.error, t)}</Banner> : null}
        </section>
      ) : null}

      {actions.reprint || actions.openInPool ? (
        <footer className="flex flex-wrap gap-2 border-t border-line-soft pt-4">
          {actions.reprint ? (
            <Button variant="secondary" size={size} asChild>
              <Link to={labelsPath([pkg.id], true)}><Printer strokeWidth={1.5} />{t('lookup.reprint')}</Link>
            </Button>
          ) : null}
          {actions.openInPool ? (
            <Button variant="ghost" size={size} asChild>
              <Link to={`/kien-hang?q=${encodeURIComponent(pkg.id)}`}><ExternalLink strokeWidth={1.5} />{t('lookup.openInPool')}</Link>
            </Button>
          ) : null}
        </footer>
      ) : null}
    </Card>
  )
}

function Fact({ label, touch, wide = false, children }: { label: string; touch: boolean; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-1', wide && 'col-span-2 sm:col-span-3')}>
      <dt className={touch ? 'text-body-lg text-ink-3' : 'text-caption text-ink-3'}>{label}</dt>
      <dd className="m-0 text-ink-1">{children}</dd>
    </div>
  )
}
