import { useFormat, useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { weightColor, type ColorContext } from '../colors'
import type { ColorMode } from '@/features/viewer3d/viewer-types'
import type { SceneStop } from '../scene-input'

/**
 * Chú thích màu nổi góc trên phải. Theo điểm giao / kiện gốc: bảng 8 màu
 * kèm tên và số kiện — màu luôn đi cùng số (mục 10). Theo khối lượng: dải
 * một sắc với hai đầu min/max.
 */
export function StopLegend({
  stops,
  colorMode,
  colorContext,
}: {
  stops: readonly SceneStop[]
  colorMode: ColorMode
  colorContext: ColorContext
}) {
  const t = useT()
  const format = useFormat()
  if (colorMode === 'khoi-luong') {
    const ramp = [0, 0.25, 0.5, 0.75, 1].map(weightColor).join(', ')
    return (
      <div className="flex min-w-50 flex-col gap-2 rounded-lg border border-glass-dark-border bg-canvas-2/45 px-3 py-2.5">
        <span className="text-body-lg xl:text-caption text-glass-dark-muted">{t('viewer.legend.weight')}</span>
        <div
          aria-hidden
          className="h-2.5 rounded-xs"
          style={{ background: `linear-gradient(90deg, ${ramp})` }}
        />
        <div className="flex justify-between font-mono text-body-lg xl:text-caption text-glass-dark-muted">
          <span>{format.decimal(colorContext.minWeightKg)} kg</span>
          <span>{format.decimal(colorContext.maxWeightKg)} kg</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-w-50 flex-col gap-1.5 rounded-lg border border-glass-dark-border bg-canvas-2/45 px-3 py-2.5">
      {colorMode === 'kien-goc' ? (
        <span className="pb-0.5 text-body-lg xl:text-caption text-glass-dark-muted">
          {t('viewer.legend.sourcePackage')}
        </span>
      ) : null}
      {stops.map((stop) => (
        <span key={stop.number} className="flex items-center gap-2 text-body-lg xl:text-caption">
          <span
            aria-hidden
            className="size-2.5 flex-none rounded-[3px]"
            style={{ background: stopColor(stop.number) }}
          />
          <span className="flex-1">
            {t('common.stopWithName', { number: stop.number, name: stop.name })}
          </span>
          <span className="font-display font-semibold tabular-nums text-glass-dark-text/85">
            {format.integer(stop.packageCount)}
          </span>
        </span>
      ))}
    </div>
  )
}
