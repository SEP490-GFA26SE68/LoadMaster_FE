import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PackageFlagTag, PackageStatusBadge } from './package-look'
import type { PackageLookup } from './package-pool-api'

/**
 * Nhiều kiện trùng mã của bên gửi (FE-3b-06): mỗi kiện một dòng bấm được — mã của kho, điểm đến, trạng thái, cờ và chuyến — để chọn
 * đúng kiện. Kho trả mới nhất trước. `touch`: dòng cao từ 56 px, chữ 16 px.
 */
export function PackageLookupList({ code, items, touch, onPick }: {
  code: string
  items: readonly PackageLookup[]
  touch: boolean
  onPick: (packageId: string) => void
}) {
  const t = useT()
  const chip = touch ? 'h-8 px-3 text-body-lg' : undefined
  return (
    <Card role="region" aria-labelledby="lookup-many-title" className="flex flex-col gap-3 p-5">
      <div className="flex flex-col gap-1">
        <h2 id="lookup-many-title" className="font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">
          {t('lookup.many.title', { count: items.length, code })}
        </h2>
        <p className={cn('m-0 text-ink-2', touch ? 'text-body-lg' : 'text-small')}>{t('lookup.many.hint')}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {items.map(({ package: pkg, trip }) => (
          <li key={pkg.id}>
            <button
              type="button"
              aria-label={t('lookup.many.choose', { id: pkg.id })}
              onClick={() => onPick(pkg.id)}
              className={cn(
                'flex w-full cursor-pointer flex-wrap items-center gap-x-4 gap-y-1.5 rounded-md border border-border bg-bg px-4 py-2.5 text-left',
                'hover:border-cyan-300 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
                touch ? 'min-h-14 text-body-lg' : 'min-h-11 text-body',
              )}
            >
              <span className="font-mono font-semibold text-ink-strong tabular-nums">{pkg.id}</span>
              <span className="min-w-40 flex-1 text-ink-1">{pkg.destination}</span>
              {trip ? <span className="font-mono text-ink-2 tabular-nums">{trip.id}</span> : null}
              <span className="flex flex-wrap items-center gap-2">
                <PackageStatusBadge status={pkg.status} className={chip} />
                {pkg.flags.map((flag) => <PackageFlagTag key={flag} flag={flag} className={touch ? 'h-8 px-2.5 text-body-lg' : undefined} />)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
