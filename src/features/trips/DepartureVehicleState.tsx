import { Button } from '@/components/ui/Button'
import { useT, dataErrorMessage } from '@/lib/i18n'

export function DepartureVehicleState({ warehouse, loading, error, empty, retry }: {
  warehouse: string; loading: boolean; error: unknown; empty: boolean; retry: () => void
}) {
  const t = useT()
  if (!warehouse) return <p role="status">{t('trips.presence.chooseWarehouse')}</p>
  if (loading) return <p role="status">{t('trips.presence.loading')}</p>
  if (error) return <div role="alert">{dataErrorMessage(error, t)} <Button type="button" variant="secondary" onClick={retry}>{t('trips.presence.retry')}</Button></div>
  return empty ? <p role="status">{t('trips.presence.empty')}</p> : null
}
