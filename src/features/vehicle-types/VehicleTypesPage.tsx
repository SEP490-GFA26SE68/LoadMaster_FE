import { Container } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useVehicleTypesQuery } from './useVehicleTypesQuery'

/** Loại xe `/doi-xe/loai-xe` (LM-104). Khung màn: đếm loại xe và số xe đã gắn loại; bảng và form (quyền `vehicleTypes.edit`) dựng tiếp. */
export function VehicleTypesPage() {
  const t = useT()
  const query = useVehicleTypesQuery()
  const rows = query.data ?? []
  const assigned = rows.reduce((sum, row) => sum + row.vehicleIds.length, 0)
  return (
    <ScreenShell
      title={t('vehicleTypes.title')}
      description={t('pageHero.vehicleTypes')}
      icon={Container}
      loading={query.isPending}
      error={query.error}
      summary={rows.length === 0 ? t('vehicleTypes.empty') : t('vehicleTypes.count', { count: rows.length, assigned })}
    />
  )
}
