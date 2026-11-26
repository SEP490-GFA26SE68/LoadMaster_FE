import { MANUAL_HANDLING } from '@/domain/handling'
import { useFormat, useT } from '@/lib/i18n'
import type { TimeScale } from '../viewer-types'

/**
 * Giả định của thời gian thật ước tính (Spec vật lý 10.1, mục 13 câu 3 — chưa có số đo của công ty): vận tốc, gia tốc, thời gian thao
 * tác mỗi kiện, quãng bê và luật dời kiện chắn lối. Số đọc thẳng từ `MANUAL_HANDLING` nên đổi giả định là chữ đổi theo.
 */
export function HandlingAssumptions({ timeScale, className }: { timeScale?: TimeScale; className?: string }) {
  const t = useT()
  const format = useFormat()
  return <div className={className} data-handling-assumptions>
    <p className="font-semibold">{t('plannerPhysics.assumptions.title')}</p>
    <ul className="mt-1 list-disc space-y-0.5 pl-4">
      <li>{t('plannerPhysics.assumptions.speed', { value: format.decimal(MANUAL_HANDLING.maxSpeedMps) })}</li>
      <li>{t('plannerPhysics.assumptions.acceleration', { value: format.decimal(MANUAL_HANDLING.accelerationMps2) })}</li>
      <li>{t('plannerPhysics.assumptions.handling', { value: format.integer(MANUAL_HANDLING.handlingSeconds) })}</li>
      <li>{t('plannerPhysics.assumptions.distance')}</li>
      <li>{t('plannerPhysics.assumptions.moved')}</li>
      {timeScale ? <li>{t('plannerPhysics.assumptions.playback', { scale: format.integer(timeScale) })}</li> : null}
    </ul>
  </div>
}
