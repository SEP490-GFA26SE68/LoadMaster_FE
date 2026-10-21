
import {
  useFormState,
  type Control,
  type UseFormRegister,
} from 'react-hook-form'
import { Info } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { SelectField } from '@/components/ui/SelectField'
import { useT } from '@/lib/i18n'
import type { VehicleFormValues } from './vehicle-form'
import type { VehicleType } from '../vehicle-types/vehicle-types-api'

export function VehicleSpecFields({
  control,
  register,
  vehicleTypes,
}: {
  control: Control<VehicleFormValues>
  register: UseFormRegister<VehicleFormValues>
  vehicleTypes: VehicleType[]
}) {
  const t = useT()
  const { errors } = useFormState({ control })

  const vehicleTypeOptions = vehicleTypes.map((type) => ({
    value: type.id,
    label: type.name,
  }))

  return (
    <div className="flex flex-col gap-5">
      {/* Tên xe */}
      <Input
        label={t('fleet.form.name')}
        placeholder={t('fleet.form.namePlaceholder')}
        required
        error={errors.name?.message}
        {...register('name')}
      />

      {/* Biển số và loại xe */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Input
          label={t('fleet.form.licensePlate')}
          placeholder="60C-446.32"
          required
          error={errors.licensePlate?.message}
          {...register('licensePlate')}
        />

        <SelectField
          control={control}
          name="vehicleTypeId"
          label={t('fleet.form.vehicleType')}
          placeholder={t('fleet.form.vehicleTypePlaceholder')}
          options={vehicleTypeOptions}
        />
      </div>

      {/* Ghi chú thông số kỹ thuật */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-4 py-3">
        <Info
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-ink-3"
          strokeWidth={1.5}
        />

        <p className="text-small leading-relaxed text-ink-3">
          {t('fleet.form.vehicleTypeHint')}
        </p>
      </div>
    </div>
  )
}
