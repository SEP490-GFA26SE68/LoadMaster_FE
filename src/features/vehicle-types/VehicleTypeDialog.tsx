import { zodResolver } from '@hookform/resolvers/zod'
import { Container } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useFormat, useT } from '@/lib/i18n'
import type { VehicleType, VehicleTypeInput } from '@/lib/mock-db'
import {
  COG_RANGE,
  EMPTY_VEHICLE_TYPE,
  MAX_COG_OFFSET_PERCENT,
  NAME_MAX,
  POSITIVE,
  toVehicleTypeForm,
  toVehicleTypeInput,
  vehicleTypeFormSchema,
  type VehicleTypeFormInput,
  type VehicleTypeFormValues,
} from './vehicle-type-form'

const NUMERIC = { type: 'number', numeric: true, inputMode: 'decimal', step: 'any' } as const
const DIMENSIONS = [
  ['cargoLengthCm', 'vehicleTypes.form.length'],
  ['cargoWidthCm', 'vehicleTypes.form.width'],
  ['cargoHeightCm', 'vehicleTypes.form.height'],
] as const
const AXLE_LIMITS = [
  ['frontAxleLimitKg', 'vehicleTypes.form.frontAxleLimit'],
  ['rearAxleLimitKg', 'vehicleTypes.form.rearAxleLimit'],
] as const

/**
 * Thêm / sửa loại xe (LM-104, FE-5b-01): tên, dài × rộng × cao lòng thùng (cm), tải trọng (kg), giới hạn tải trục trước / sau (kg, để
 * trống nếu chưa khai) và độ lệch trọng tâm tối đa (%). `type` vắng là thêm mới. Lỗi hiện tại ô; kho kiểm lại và trả
 * `VEHICLE_TYPE_INVALID` nếu sai, màn hiện lỗi đó qua toast.
 */
export function VehicleTypeDialog({ open, onOpenChange, type, pending, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: VehicleType | null
  pending: boolean
  onSubmit: (input: VehicleTypeInput) => void
}) {
  const t = useT()
  const format = useFormat()
  const form = useForm<VehicleTypeFormInput, unknown, VehicleTypeFormValues>({ resolver: zodResolver(vehicleTypeFormSchema) })
  const { reset, formState: { errors } } = form

  useEffect(() => {
    if (!open) return
    reset(type ? toVehicleTypeForm(type) : EMPTY_VEHICLE_TYPE)
  }, [open, type, reset])

  const nameError = errors.name?.message === 'vehicleTypes.form.errors.nameTooLong'
    ? t('vehicleTypes.form.errors.nameTooLong', { max: NAME_MAX })
    : errors.name ? t('vehicleTypes.form.errors.nameRequired') : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit((values) => onSubmit(toVehicleTypeInput(values)))}>
          <DialogHeader
            icon={Container}
            title={type ? t('vehicleTypes.form.editTitle', { id: type.id }) : t('vehicleTypes.form.createTitle')}
            description={t('vehicleTypes.form.description')}
          />
          <div className="flex max-h-[62vh] flex-col gap-4 overflow-y-auto px-7 py-5">
            <Input label={t('vehicleTypes.form.name')} placeholder={t('vehicleTypes.form.namePlaceholder')} required error={nameError} {...form.register('name')} />
            <div className="grid grid-cols-3 gap-3">
              {DIMENSIONS.map(([field, label]) => (
                <Input
                  key={field}
                  label={t(label)}
                  suffix="cm"
                  required
                  error={errors[field] ? t(POSITIVE) : undefined}
                  {...NUMERIC}
                  {...form.register(field, { valueAsNumber: true })}
                />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label={t('vehicleTypes.form.payload')}
                suffix="kg"
                required
                error={errors.payloadKg ? t(POSITIVE) : undefined}
                {...NUMERIC}
                {...form.register('payloadKg', { valueAsNumber: true })}
              />
              {AXLE_LIMITS.map(([field, label]) => (
                <Input
                  key={field}
                  label={t(label)}
                  suffix="kg"
                  error={errors[field] ? t(POSITIVE) : undefined}
                  {...NUMERIC}
                  {...form.register(field, { valueAsNumber: true })}
                />
              ))}
            </div>
            <p className="-mt-2 text-fine text-ink-3">{t('vehicleTypes.form.axleLimitHint')}</p>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label={t('vehicleTypes.form.maxCogOffset')}
                suffix="%"
                required
                error={errors.maxCogOffsetPercent ? t(COG_RANGE, { max: format.integer(MAX_COG_OFFSET_PERCENT) }) : undefined}
                {...NUMERIC}
                {...form.register('maxCogOffsetPercent', { valueAsNumber: true })}
              />
            </div>
            <p className="-mt-2 text-fine text-ink-3">{t('vehicleTypes.form.maxCogOffsetHint')}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">{t('vehicleTypes.form.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              {type ? t('vehicleTypes.form.save') : t('vehicleTypes.form.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
