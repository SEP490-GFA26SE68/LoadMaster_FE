import { FlagOff } from 'lucide-react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Package, PackageFlag } from '@/lib/mock-db'
import { PackageFlagTag } from './package-look'
import type { PackageHistoryLine } from './package-pool-api'
import { useClearPackageFlagMutation } from './usePackagePoolQuery'

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

/** Cờ của kiện ở panel chi tiết (D-92); điều phối viên (`packages.manage`) gỡ được từng cờ. */
export function PackageFlagsSection({ titleId, pkg }: { titleId: string; pkg: Package }) {
  const t = useT()
  const canManage = useCan()('packages.manage')
  const clear = useClearPackageFlagMutation()

  function handleClear(flag: PackageFlag) {
    clear.mutate({ id: pkg.id, flag }, {
      onSuccess: () => toast.success(t('sourcing.detail.flagCleared', { flag: t(`common.packageFlags.${flag}`), code: pkg.packageCode })),
    })
  }

  return (
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
  )
}

/** Lịch sử kiện kho đã ghi (`Package.history`), mới nhất trước — không suy ở màn. */
export function PackageHistorySection({ titleId, history }: { titleId: string; history: readonly PackageHistoryLine[] }) {
  const t = useT()
  const format = useFormat()
  return (
    <section aria-labelledby={`${titleId}-history`} className="flex flex-col gap-2">
      <h3 id={`${titleId}-history`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.history')}</h3>
      <ol aria-labelledby={`${titleId}-history`} className="flex flex-col">
        {history.map((entry, index) => (
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
  )
}
