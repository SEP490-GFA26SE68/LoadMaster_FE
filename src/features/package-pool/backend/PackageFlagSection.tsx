import { FlagOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { PackageFlagTag } from '../package-look'
import type { CargoPackage } from './packages-api'
import { useClearPackageFlagMutation } from './usePackagePoolQuery'

/**
 * Cờ của kiện bản máy chủ: kho bỏ kiện khỏi chuyến (thiếu lúc soạn, hỏng lúc xếp) thì kiện mang cờ và chưa vào yêu cầu giao hay chuyến
 * khác được. Chỉ điều phối viên gỡ cờ (máy chủ chỉ cho `DISPATCHER`); người khác chỉ thấy cờ.
 */
export function PackageFlagSection({ titleId, pkg, code }: { titleId: string; pkg: CargoPackage; code: string }) {
  const t = useT()
  const canClear = useCan()('trips.edit')
  const clear = useClearPackageFlagMutation()
  const flag = pkg.flag
  const flagLabel = flag === null ? '' : t(`common.packageFlags.${flag}`)

  function handleClear() {
    clear.mutate(pkg.id, {
      onSuccess: () => toast.success(t('sourcing.detail.flagCleared', { flag: flagLabel, code })),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <section aria-labelledby={`${titleId}-flags`} className="flex flex-col gap-2">
      <h3 id={`${titleId}-flags`} className="text-body font-semibold text-ink-strong">{t('sourcing.detail.flags')}</h3>
      {flag === null ? (
        <p className="text-small text-ink-2">{t('sourcing.detail.noFlags')}</p>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <PackageFlagTag flag={flag} />
            {canClear ? (
              <Button variant="secondary" size="sm" loading={clear.isPending} aria-label={t('sourcing.detail.clearFlagLabel', { flag: flagLabel })} onClick={handleClear}>
                <FlagOff strokeWidth={1.5} />
                {t('sourcing.detail.clearFlag')}
              </Button>
            ) : null}
          </div>
          <p className="text-small text-ink-2">{t('sourcing.detail.flagNote')}</p>
        </>
      )}
    </section>
  )
}
