import { Lock } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { SelectField, type SelectOption } from '@/components/ui/SelectField'
import { useFormat, useT } from '@/lib/i18n'
import type { VehicleStatus } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { useRunDateText } from './trip-form-dates'
import type { TripFormValues } from './trip-form.schema'
import { FieldMark, TripFormSection } from './TripFormSection'
import type { VehicleOption } from './trips-api'

/** Chip trạng thái xe trong ô thông số, cùng ngữ pháp chấm với Đội xe (`fleet/VehicleStatusBadge`): sẵn sàng xanh lá, đang phục vụ xanh lam. */
const VEHICLE_STATUS: Record<VehicleStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  available: { tone: 'success', dot: 'solid' },
  in_use: { tone: 'azure', dot: 'halo' },
  maintenance: { tone: 'neutral', dot: 'solid' },
}

/**
 * Mục 1 của form chuyến (V2.3 TaoChuyen.jpg, SuaChuyenKhoa.jpg): tên + ngày chạy một hàng, xe + tài xế một hàng (8/4 cột), rồi ô
 * thông số xe đang chọn. Ngày chạy có gợi ý thứ và "hôm nay / ngày mai". Kho đã bắt đầu xếp thì ô xe khoá kèm lý do; ô thông số
 * chuyển xám, không còn chip trạng thái. Ô nhập mang `aria-label` bằng đúng chữ nhãn để dấu * không lọt vào tên truy cập.
 */
export function TripFormInfoSection({ form, vehicles, drivers, selected, locked }: {
  form: UseFormReturn<TripFormValues>
  vehicles: readonly SelectOption[]
  drivers: readonly SelectOption[]
  selected: VehicleOption | undefined
  locked: boolean
}) {
  const t = useT()
  const format = useFormat()
  const runDate = useRunDateText()
  const { errors } = form.formState
  const scheduledDate = useWatch({ control: form.control, name: 'scheduledDate' })
  const vehicleHint = locked ? (
    <span className="inline-flex items-center gap-1.5">
      <Lock aria-hidden className="size-3.5" strokeWidth={1.75} />
      {t('trips.create.vehicleLockedHint')}
    </span>
  ) : selected?.status === 'maintenance' ? t('trips.create.vehicleMaintenanceHint') : t('trips.create.vehicleHint')
  const status = selected ? VEHICLE_STATUS[selected.status] : null

  return (
    <TripFormSection number={1} title={t('trips.create.infoTitle')} description={t('trips.create.infoHint')}>
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-12">
        <div className="md:col-span-8">
          <Input
            label={<>{t('trips.create.name')}<FieldMark kind="required" /></>}
            aria-label={t('trips.create.name')}
            aria-required
            placeholder={t('trips.create.namePlaceholder')}
            error={errors.name?.message}
            {...form.register('name')}
          />
        </div>
        <div className="md:col-span-4">
          <Input
            type="date"
            label={<>{t('trips.create.scheduledDate')}<FieldMark kind="required" /></>}
            aria-label={t('trips.create.scheduledDate')}
            aria-required
            hint={runDate.hint(scheduledDate)}
            error={errors.scheduledDate?.message}
            {...form.register('scheduledDate')}
          />
        </div>
        <fieldset disabled={locked} className="m-0 min-w-0 border-0 p-0 md:col-span-8">
          <SelectField
            control={form.control}
            name="vehicleId"
            label={<>{t('trips.create.vehicle')}<FieldMark kind="required" /></>}
            placeholder={t('trips.create.vehiclePlaceholder')}
            options={vehicles}
            hint={vehicleHint}
          />
        </fieldset>
        <SelectField
          className="md:col-span-4"
          control={form.control}
          name="driverId"
          label={<>{t('trips.create.driver')}<FieldMark kind="optional" /></>}
          options={drivers}
          hint={t('trips.create.driverHint')}
        />
        {selected ? (
          <dl
            className={cn(
              'm-0 flex flex-wrap items-center gap-x-7.5 gap-y-2 rounded-[12px] border px-4 py-2.75 md:col-span-8',
              locked ? 'border-border bg-n-50' : 'border-cyan-100 bg-cyan-50',
            )}
          >
            <div className="flex flex-col gap-0.75">
              <dt className="text-fine text-ink-3">{t('trips.create.cargoSpace')}</dt>
              <dd className="m-0 font-display text-body font-semibold whitespace-nowrap text-ink-strong tabular-nums">
                {format.dimensions(selected.vehicle.innerLengthCm, selected.vehicle.innerWidthCm, selected.vehicle.innerHeightCm)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.75">
              <dt className="text-fine text-ink-3">{t('trips.create.payload')}</dt>
              <dd className="m-0 font-display text-body font-semibold whitespace-nowrap text-ink-strong tabular-nums">{format.weight(selected.vehicle.maxPayloadKg)}</dd>
            </div>
            {status && !locked ? (
              <Badge tone={status.tone} dot={status.dot} className="ml-auto">{t(`fleet.status.${selected.status}`)}</Badge>
            ) : null}
          </dl>
        ) : null}
      </div>
    </TripFormSection>
  )
}
