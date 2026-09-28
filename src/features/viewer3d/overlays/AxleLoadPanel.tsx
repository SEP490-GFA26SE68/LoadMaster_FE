import type { VehicleAxle } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/**
 * Chỗ của tải trục trong inspector (LM-037, Spec 7.10). Chưa có backend tính tải trục nên không hiện số tải hiện tại nào,
 * chỉ nhãn "Sẽ có sau". Xe khai báo `axles` thì liệt kê cấu hình trục: tên, vị trí X và tải tối đa — không phải số đo.
 */
export function AxleLoadPanel({ axles = [], compact = false }: { axles?: readonly VehicleAxle[]; compact?: boolean }) {
  const t = useT()
  const format = useFormat()
  return (
    <section
      aria-label={t('viewer.axles.title')}
      className={cn('flex min-w-64 flex-col gap-2 rounded-lg border border-glass-dark-border bg-canvas-2/45 p-3', compact ? 'w-70' : 'w-full')}
    >
      <div className="flex items-center justify-between gap-3 text-body-lg xl:text-caption">
        <span className="font-semibold text-sky-text">{t('viewer.axles.title')}</span>
        <span className="text-glass-dark-muted">{t('viewer.axles.comingLater')}</span>
      </div>
      {axles.length > 0 ? (
        <ul className="flex flex-col gap-1 font-mono text-body-lg xl:text-caption">
          {axles.map((axle) => (
            <li key={axle.id}>
              {t('viewer.axles.axle', {
                name: axle.name,
                position: format.length(axle.positionXCm),
                maxLoad: format.weight(axle.maxLoadKg),
              })}
            </li>
          ))}
        </ul>
      ) : null}
      {!compact ? <p className="text-body-lg text-glass-dark-muted xl:text-caption">{t('viewer.axles.pending')}</p> : null}
    </section>
  )
}
