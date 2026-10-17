import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { VehicleForm } from './VehicleForm'

export function VehicleDetailPage() {
  const t = useT()
  const { vehicleId } = useParams()

  // /doi-xe/moi
  if (vehicleId === undefined) {
    return <VehicleForm />
  }

  // Tạm thời chưa nối GET detail vehicle.
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <p className="text-body text-text-2">
        {t('fleet.detail.detailNotAvailable')}
      </p>

      <Button
        variant="secondary"
        asChild
      >
        <Link to="/doi-xe">
          <ChevronLeft strokeWidth={1.5} />
          {t('fleet.detail.back')}
        </Link>
      </Button>
    </div>
  )
}