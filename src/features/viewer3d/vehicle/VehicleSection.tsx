import { useMemo } from 'react'
import { VehicleName } from '@/components/VehicleName'
import type { VehicleConfig } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { VehicleBodyStyle } from '@/types/vehicle-body-style'
import { DARK_SUBCARD } from '../panels/scene-ui'
import { vehicleFacts } from './vehicle-facts'
import { VehicleFactsList } from './VehicleFactsList'

/** Mục "Xe của chuyến" của hộp Hiển thị: cùng bảng số với bảng thông số xe, cho bề rộng không có thẻ xe ở góc khung 3D (dưới 768 px). */
export function VehicleSection({ vehicle, bodyStyle, className }: { vehicle: VehicleConfig; bodyStyle?: VehicleBodyStyle; className?: string }) {
  const t = useT()
  const facts = useMemo(() => vehicleFacts(vehicle, bodyStyle), [vehicle, bodyStyle])
  return (
    <section aria-label={t('viewer.vehicleCard.title')} className={cn('flex flex-col gap-2 px-3 py-2.5', DARK_SUBCARD, className)}>
      <h2 className="font-display font-[650] text-sky-text">{t('viewer.vehicleCard.title')}</h2>
      <p className="font-semibold text-glass-dark-text"><VehicleName name={facts.name} /></p>
      <VehicleFactsList facts={facts} />
    </section>
  )
}
