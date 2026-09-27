import { zodResolver } from '@hookform/resolvers/zod'
import { Container } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { roundCm, roundKg } from '@/domain/geometry'
import { useT, type MessageKey } from '@/lib/i18n'
import type { VehicleType, VehicleTypeInput } from '@/lib/mock-db'

const NAME_MAX = 80
const POSITIVE: MessageKey = 'vehicleTypes.form.errors.positive'
const positive = z.number({ error: POSITIVE }).gt(0, { error: POSITIVE })

/** Message là key từ điển: đổi ngôn ngữ thì lỗi đổi theo. Kích thước cm, tải trọng kg (D-03), làm tròn tại biên khi lưu. */
const typeSchema = z.object({
  name: z.string().trim().min(1, 'vehicleTypes.form.errors.nameRequired').max(NAME_MAX, 'vehicleTypes.form.errors.nameTooLong'),
  cargoLengthCm: positive,
  cargoWidthCm: positive,
  cargoHeightCm: positive,
  payloadKg: positive,
})

type TypeValues = z.infer<typeof typeSchema>

const NUMERIC = { type: 'number', numeric: true, inputMode: 'decimal', step: 'any' } as const
const DIMENSIONS = [
  ['cargoLengthCm', 'vehicleTypes.form.length'],
  ['cargoWidthCm', 'vehicleTypes.form.width'],
  ['cargoHeightCm', 'vehicleTypes.form.height'],
] as const

/**
 * Thêm / sửa loại xe (LM-104): tên, dài × rộng × cao lòng thùng (cm), tải trọng (kg). `type` vắng là thêm mới. Kho kiểm lại và trả
 * `VEHICLE_TYPE_INVALID` nếu sai; màn hiện lỗi đó qua toast.
 */
export function VehicleTypeDialog({ open, onOpenChange, type, pending, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: VehicleType | null
  pending: boolean
  onSubmit: (input: VehicleTypeInput) => void
}) {
  const t = useT()
  const form = useForm<TypeValues>({ resolver: zodResolver(typeSchema) })
  const { reset, formState: { errors } } = form

  useEffect(() => {
    if (!open) return
    reset(type
      ? { name: type.name, cargoLengthCm: type.cargoLengthCm, cargoWidthCm: type.cargoWidthCm, cargoHeightCm: type.cargoHeightCm, payloadKg: type.payloadKg }
      : { name: '', cargoLengthCm: Number.NaN, cargoWidthCm: Number.NaN, cargoHeightCm: Number.NaN, payloadKg: Number.NaN })
  }, [open, type, reset])

  const nameError = errors.name?.message === 'vehicleTypes.form.errors.nameTooLong'
    ? t('vehicleTypes.form.errors.nameTooLong', { max: NAME_MAX })
    : errors.name ? t('vehicleTypes.form.errors.nameRequired') : undefined

  function handleSubmit(values: TypeValues) {
    onSubmit({
      name: values.name,
      cargoLengthCm: roundCm(values.cargoLengthCm),
      cargoWidthCm: roundCm(values.cargoWidthCm),
      cargoHeightCm: roundCm(values.cargoHeightCm),
      payloadKg: roundKg(values.payloadKg),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-140">
        <form noValidate onSubmit={form.handleSubmit(handleSubmit)}>
          <DialogHeader
            icon={Container}
            title={type ? t('vehicleTypes.form.editTitle', { id: type.id }) : t('vehicleTypes.form.createTitle')}
            description={t('vehicleTypes.form.description')}
          />
          <div className="flex flex-col gap-4 px-7 py-5">
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
            </div>
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
