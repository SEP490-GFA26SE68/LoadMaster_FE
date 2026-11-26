import type { UseFormReturn } from 'react-hook-form'

import { Input } from '@/components/ui/Input'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'

import {
  COG_RANGE,
  MAX_COG_OFFSET_PERCENT,
  type VehicleTypeFormInput,
  type VehicleTypeFormValues,
} from './vehicle-type-form'

const NUMERIC = { type: 'number', numeric: true, inputMode: 'decimal', step: 'any' } as const

/**
 * Giới hạn vật lý của loại xe máy chủ: lệch trọng tâm dọc (bắt buộc), lệch ngang (%, tuỳ chọn — trống là dùng ngưỡng dọc) và tải trọng sàn
 * (kg/m², tuỳ chọn — trống là không kiểm). Hai ô tuỳ chọn không bao giờ tự điền. Lỗi là key từ điển: ngoài khoảng (`COG_RANGE`) hoặc xoá
 * giá trị đã lưu (`CANNOT_CLEAR`, đặt lúc gửi).
 */
export function VehiclePhysicalLimitsFields({ form }: {
  form: UseFormReturn<VehicleTypeFormInput, unknown, VehicleTypeFormValues>
}) {
  const t = useT()
  const format = useFormat()
  const errors = form.formState.errors
  const max = format.integer(MAX_COG_OFFSET_PERCENT)
  const message = (key: string | undefined) => {
    if (key === COG_RANGE) return t(COG_RANGE, { max })
    return key ? t(key as MessageKey) : undefined
  }

  return (
    <>
      <div className="grid grid-cols-3 items-start gap-3">
        <Input
          label={t('vehicleTypes.form.maxCogOffset')}
          suffix="%"
          required
          error={errors.maxCogOffsetPercent ? t(COG_RANGE, { max }) : undefined}
          {...NUMERIC}
          {...form.register('maxCogOffsetPercent', { valueAsNumber: true })}
        />
        <Input
          label={t('physicalData.vehicle.cogY')}
          suffix="%"
          error={message(errors.maxCogOffsetPercentY?.message)}
          {...NUMERIC}
          {...form.register('maxCogOffsetPercentY', { valueAsNumber: true })}
        />
        <Input
          label={t('physicalData.vehicle.floorLoad')}
          suffix="kg/m²"
          error={message(errors.floorLoadCapacityKgM2?.message)}
          {...NUMERIC}
          {...form.register('floorLoadCapacityKgM2', { valueAsNumber: true })}
        />
      </div>
      <ul className="-mt-2 flex flex-col gap-1 text-fine text-ink-3">
        <li>{t('vehicleTypes.form.maxCogOffsetHint')}</li>
        <li>{t('physicalData.vehicle.cogYHint')}</li>
        <li>{t('physicalData.vehicle.floorLoadHint')}</li>
      </ul>
    </>
  )
}
