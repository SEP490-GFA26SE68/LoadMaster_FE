
import { type UseFormReturn } from 'react-hook-form'
import { useT } from '@/lib/i18n'
import type { CompanyWarehouse } from '@/features/company-warehouses/company-warehouses-api'
import { Input } from '@/components/ui/Input'
import { FieldMessage } from '@/components/ui/field-styles'
import { type TripFormValues } from './trip-form.schema'
import { TripFormSection } from './TripFormSection'

type Props = {
  form: UseFormReturn<TripFormValues>
  locked: boolean
  warehouses: CompanyWarehouse[]
  loading?: boolean
  selectedWarehouseId: string
  onWarehouseChange: (warehouseId: string) => void
}

export function TripFormDepotSection({
  form,
  locked,
  warehouses,
  loading = false,
  selectedWarehouseId,
  onWarehouseChange,
}: Props) {
  const t = useT()
  const errors = form.formState.errors.depot

  const depot = form.watch('depot')

  function handleWarehouseChange(
    event: React.ChangeEvent<HTMLSelectElement>,
  ) {
    onWarehouseChange(event.target.value)
  }

  return (
    <TripFormSection
      number={2}
      title={t('trips.create.depotTitle')}
      locked={locked}
      description={
        locked ? undefined : t('trips.create.depotHint')
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="md:col-span-12">
          <label
            htmlFor="trip-warehouse"
            className="mb-1.5 block text-sm font-medium"
          >
            {t('tripWarehouse.select')}
          </label>

          <select
            id="trip-warehouse"
            value={selectedWarehouseId}
            onChange={handleWarehouseChange}
            disabled={locked || loading}
            className="h-10 w-full rounded-md border border-border bg-bg px-3 text-body"
          >
            <option value="">
              {t('tripWarehouse.placeholder')}
            </option>

            {warehouses.map((warehouse) => (
              <option
                key={warehouse.id}
                value={warehouse.id}
                disabled={
                  warehouse.latitude === null ||
                  warehouse.longitude === null
                }
              >
                {warehouse.warehouseName}
                {warehouse.isDefault
                  ? ` — ${t('tripWarehouse.default')}`
                  : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-5">
          <Input
            label={t('trips.create.depotName')}
            value={depot.name}
            readOnly
          />
          {errors?.name?.message ? (
            <FieldMessage error={errors.name.message} />
          ) : null}
        </div>

        <div className="md:col-span-7">
          <Input
            label={t('trips.create.depotAddress')}
            value={depot.address}
            readOnly
          />
        </div>

        <div className="md:col-span-6">
          <Input
            label={t('map.picker.lat')}
            value={depot.coordinates.lat}
            readOnly
          />
        </div>

        <div className="md:col-span-6">
          <Input
            label={t('map.picker.lng')}
            value={depot.coordinates.lng}
            readOnly
          />
        </div>

        {errors?.coordinates?.message ? (
          <div className="md:col-span-12">
            <FieldMessage error={errors.coordinates.message} />
          </div>
        ) : null}
      </div>
    </TripFormSection>
  )
}
