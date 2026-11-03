import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { adaptBackendVehicle } from '@/features/viewer3d/backend-scene-adapter'

import { VehicleForm } from './VehicleForm'
import {
  fetchVehicleById,
  fetchVehicleConfig,
} from './vehicles-api'

const VehiclePreviewViewer = lazy(() =>
  import('@/features/viewer3d/VehiclePreviewViewer').then(
    (module) => ({ default: module.VehiclePreviewViewer }),
  ),
)

const HAS_WEBGL =
  typeof WebGLRenderingContext !== 'undefined'

export function VehicleDetailPage() {
  const { vehicleId } = useParams()

  if (vehicleId === undefined) {
    return <VehicleForm />
  }

  return <BackendVehicleDetail vehicleId={vehicleId} />
}

function BackendVehicleDetail({
  vehicleId,
}: {
  vehicleId: string
}) {
  const t = useT()

  const [highlightedObstacleId, setHighlightedObstacleId] =
    useState<string | null>(null)

  const [toolbarHost, setToolbarHost] =
    useState<HTMLDivElement | null>(null)

  const vehicleQuery = useQuery({
    queryKey: ['backend', 'vehicle', vehicleId],
    queryFn: () => fetchVehicleById(vehicleId),
  })

  const configQuery = useQuery({
    queryKey: ['backend', 'vehicle-config', vehicleId],
    queryFn: () => fetchVehicleConfig(vehicleId),
  })

  if (vehicleQuery.isPending || configQuery.isPending) {
    return (
      <div role="status" className="p-8">
        {t('fleet.preview.loading')}
      </div>
    )
  }

  if (vehicleQuery.isError || configQuery.isError) {
    const error = vehicleQuery.error ?? configQuery.error

    return (
      <div className="flex flex-col gap-4 p-8">
        <p role="alert" className="text-sm text-red-500">
          {error?.message}
        </p>
        <Button variant="secondary" asChild>
          <Link to="/doi-xe">
            <ChevronLeft strokeWidth={1.5} />
            {t('fleet.detail.back')}
          </Link>
        </Button>
      </div>
    )
  }

  const vehicle = vehicleQuery.data
  const config = configQuery.data

  if (!vehicle || !config) {
    return null
  }

  if (String(config.vehicleId) !== vehicle.id) {
    return (
      <p role="alert" className="p-8 text-sm text-red-500">
        Vehicle configuration mismatch
      </p>
    )
  }

  // Dùng adapter đã được kiểm thử với LoadPlan 3D.
  const vehicleConfig = adaptBackendVehicle(config)

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="secondary" asChild>
          <Link to="/doi-xe">
            <ChevronLeft strokeWidth={1.5} />
            {t('fleet.detail.back')}
          </Link>
        </Button>

        <div>
          <h1 className="text-xl font-semibold">
            {vehicle.name}
          </h1>
          <p className="text-sm text-text-2">
            {vehicle.licensePlate}
            {' · '}
            {vehicle.vehicleTypeName}
          </p>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div ref={setToolbarHost} className="min-h-12" />

        <div
          className="relative h-[520px] overflow-hidden rounded-xl border border-border-dark bg-canvas-1"
          role="region"
          aria-label={t('fleet.preview.label')}
        >
          {HAS_WEBGL ? (
            <Suspense
              fallback={
                <div className="p-6" role="status">
                  {t('fleet.preview.loading')}
                </div>
              }
            >
              <VehiclePreviewViewer
                vehicle={vehicleConfig}
                frameVehicle={vehicleConfig}
                toolbarHost={toolbarHost}
                highlightedObstacleId={highlightedObstacleId}
                onObstacleSelect={setHighlightedObstacleId}
              />
            </Suspense>
          ) : (
            <p className="p-6 text-sm text-text-2">
              {t('fleet.preview.unsupported')}
            </p>
          )}
        </div>

        <p className="text-sm text-text-2">
          {t('fleet.preview.hint')}
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField
          label={t('fleet.preview.label')}
          value={`X ${config.innerLength} × Y ${config.innerWidth} × Z ${config.innerHeight} cm`}
        />

        <DetailField
          label={t('fleet.preview.readout.door')}
          value={
            config.doorWidth != null &&
              config.doorHeight != null
              ? `${t('fleet.preview.readout.width')}: ${config.doorWidth} cm · ${t('fleet.preview.readout.heigh')}: ${config.doorHeight} cm`
              : '—'
          }
        />

        <DetailField
          label={t('fleet.preview.readout.payload')}
          value={`${config.maxPayloadKg} kg`}
        />
      </section>
    </div>
  )
}

function DetailField({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-text-2">{label}</p>
      <p className="mt-2 font-semibold">{value}</p>
    </div>
  )
}