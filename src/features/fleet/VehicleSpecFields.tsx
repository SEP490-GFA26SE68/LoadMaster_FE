import { useFormState, type Control, type UseFormRegister } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import type { VehicleFormValues } from './vehicle-form'

/** Bước nhập của Spec: 0,1 cm và 0,01 kg — đúng bước `roundCm` / `roundKg` áp khi lưu. */
export const CM_STEP = 0.1
export const KG_STEP = 0.01

/** Ô số đo bằng cm, kể cả ô trong bảng vật cản và bảng trục. */
export const NUMERIC_FIELD_PROPS = { type: 'number' as const, numeric: true, inputMode: 'decimal' as const }

const CM_FIELDS = ['innerLengthCm', 'innerWidthCm', 'innerHeightCm', 'doorWidthCm', 'doorHeightCm'] as const

/**
 * Khối "Kích thước và tải trọng" của form xe (Spec 9.2): lòng thùng, tải trọng, cửa sau, khoảng hở.
 * Mọi ô là số có hậu tố đơn vị; câu lỗi do resolver đặt sẵn nên ở đây chỉ hiển thị.
 */
export function VehicleSpecFields({
  control,
  register,
}: {
  control: Control<VehicleFormValues>
  register: UseFormRegister<VehicleFormValues>
}) {
  const t = useT()
  const { errors } = useFormState({ control })

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={t('fleet.form.name')}
        placeholder={t('fleet.form.namePlaceholder')}
        required
        error={errors.name?.message}
        {...register('name')}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {CM_FIELDS.map((field) => (
          <Input
            key={field}
            label={t(`fields.${field}`)}
            required
            suffix="cm"
            step={CM_STEP}
            error={errors[field]?.message}
            {...NUMERIC_FIELD_PROPS}
            {...register(field, { valueAsNumber: true })}
          />
        ))}
        <Input
          label={t('fields.maxPayloadKg')}
          required
          suffix="kg"
          step={KG_STEP}
          error={errors.maxPayloadKg?.message}
          {...NUMERIC_FIELD_PROPS}
          {...register('maxPayloadKg', { valueAsNumber: true })}
        />
        <Input
          label={t('fleet.form.clearanceCm')}
          required
          suffix="cm"
          step={CM_STEP}
          hint={t('fleet.form.clearanceHint')}
          error={errors.clearanceCm?.message}
          {...NUMERIC_FIELD_PROPS}
          {...register('clearanceCm', { valueAsNumber: true })}
        />
      </div>

      <p className="text-caption text-text-3">
        {t('fleet.form.doorPosition')}: {t('fleet.form.doorPositionRear')} — {t('fleet.form.doorPositionHint')}
      </p>
    </div>
  )
}
