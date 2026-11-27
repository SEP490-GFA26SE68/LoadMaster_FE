import { Crosshair } from 'lucide-react'
import { memo, useMemo } from 'react'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { IndicatorCard } from '../overlays/IndicatorCard'
import { GLASS_PANEL, MUTED } from '../panels/scene-ui'
import type { CargoAtStep } from './cargo-at-step'
import { cargoCenterOfMass } from './operations-model'

/** Ba số của G theo chữ: cách vách trước (X), lệch ngang so với giữa thùng (|Y − W/2|), cao trên sàn (Z). */
function useGravityLines(cargo: CargoAtStep, vehicle: VehicleConfig) {
  const t = useT()
  const format = useFormat()
  const mass = useMemo(() => cargoCenterOfMass(cargo.placements), [cargo.placements])
  if (!mass) return null
  return [
    t('plannerPhysics.gravity.fromFront', { value: format.length(mass.position.x) }),
    t('plannerPhysics.gravity.lateral', { value: format.length(Math.abs(mass.position.y - vehicle.innerWidthCm / 2)) }),
    t('plannerPhysics.gravity.height', { value: format.length(mass.position.z) }),
  ]
}

function AtStep({ cargo }: { cargo: CargoAtStep }) {
  const t = useT()
  const format = useFormat()
  if (!cargo.at) return null
  return <>{t('plannerPhysics.atStep', { step: format.integer(cargo.at.step), total: format.integer(cargo.at.total) })}</>
}

/**
 * Trọng tâm hàng G ở hộp Chi tiết (Spec vật lý 10.3): cùng tập hàng với dấu G trong 3D và tải trục — hàng ở bước đang xem khi Planner
 * dừng giữa lượt xếp / dỡ (kèm "Tại bước n / N"), không thì cả phương án kể cả bản đang chỉnh tay. Tính từ chính vị trí kiện nên không
 * mang nhãn nguồn.
 */
export function GravityPanel({ cargo, vehicle }: { cargo: CargoAtStep; vehicle: VehicleConfig }) {
  const t = useT()
  const lines = useGravityLines(cargo, vehicle)
  return <IndicatorCard title={t('plannerPhysics.gravity.title')} subtitle={cargo.at ? <AtStep cargo={cargo} /> : undefined} data-gravity-panel="">
    {lines ? <ul className="m-0 flex list-none flex-col gap-1 p-0 font-mono tabular-nums text-sky-text">
      {lines.map((line) => <li key={line}>{line}</li>)}
    </ul> : <p className={MUTED}>{t('plannerPhysics.gravity.empty')}</p>}
  </IndicatorCard>
}

/**
 * Thẻ G nổi góc khung 3D khi bật lớp "Hiện trọng tâm hàng (G)": kính tối, cùng số với `GravityPanel`. Bọc `memo` và chỉ nhận hàng ở bước
 * đang xem: chọn kiện không vẽ lại thẻ; lớp đang tắt thì không tính trọng tâm.
 */
export const MassCard = memo(function MassCard({ cargo, showMass, vehicle, className }: {
  cargo: CargoAtStep; showMass: boolean; vehicle: VehicleConfig; className?: string
}) {
  return showMass ? <MassCardBody cargo={cargo} vehicle={vehicle} className={className} /> : null
})

function MassCardBody({ cargo, vehicle, className }: { cargo: CargoAtStep; vehicle: VehicleConfig; className?: string }) {
  const t = useT()
  const lines = useGravityLines(cargo, vehicle)
  if (!lines) return null
  return <section aria-label={t('plannerPhysics.gravity.title')} data-mass-hud className={cn('pointer-events-auto flex items-start gap-2.5 px-4 py-3 text-body xl:text-small', GLASS_PANEL, className)}>
    <span aria-hidden className="grid size-7.5 flex-none place-items-center rounded-md bg-cog-marker/15 text-cog-marker"><Crosshair className="size-4.5" strokeWidth={1.5} /></span>
    <div className="flex min-w-0 flex-col">
      <span className="font-semibold text-sky-text">{t('plannerPhysics.gravity.title')}</span>
      {cargo.at ? <span className={MUTED}><AtStep cargo={cargo} /></span> : null}
      {lines.map((line) => <span key={line} className="font-mono tabular-nums">{line}</span>)}
    </div>
  </section>
}
