import { useId, type ReactNode } from 'react'
import { FieldLabel } from '@/components/ui/field-styles'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { Textarea } from '@/components/ui/Textarea'
import { useT } from '@/lib/i18n'
import type { SheetSample } from '../design-system-api'
import { SheetCard } from '../SheetLayout'

/**
 * Ô nhập ở mọi trạng thái (trống, đang gõ, có đơn vị, lỗi, chọn, chỉ đọc, ngày, nhiều dòng) với nhãn và câu lỗi của form chuyến,
 * form kiện và Hồ sơ. Giá trị là của chuyến đầu kho; ô gõ được nhưng không lưu đi đâu. Ô "đang gõ" mang sẵn viền focus để thấy
 * trạng thái đó mà không cướp con trỏ khi mở trang.
 */
export function FieldsCard({ sample }: { sample: SheetSample | undefined }) {
  const t = useT()
  return (
    <SheetCard title={t('designSystem.components.fields.title')} meta={t('designSystem.components.fields.meta')}>
      {sample ? <Fields sample={sample} /> : <Skeleton className="h-72 w-full rounded-md" />}
    </SheetCard>
  )
}

function Optional({ children }: { children: ReactNode }) {
  const t = useT()
  return <>{children} <span className="font-normal text-ink-3">{t('designSystem.components.optional')}</span></>
}

function Fields({ sample }: { sample: SheetSample }) {
  const t = useT()
  const vehicleId = useId()
  const driverId = useId()
  const { trip } = sample

  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-3.5 sm:grid-cols-2">
      <Input label={t('trips.create.name')} required placeholder={t('trips.create.namePlaceholder')} />
      <Input label={t('trips.create.name')} required defaultValue={trip.name} className="border-cyan-500 shadow-focus" />
      <Input label={t('fields.innerLengthCm')} required numeric inputMode="decimal" defaultValue={String(trip.vehicleLengthCm)} suffix="cm" />
      <Input label={t('trips.form.weight')} required numeric inputMode="decimal" defaultValue="-2" suffix="kg" error={t('trips.form.errors.weightNonNegative')} />

      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={vehicleId} required>{t('trips.create.vehicle')}</FieldLabel>
        <Select defaultValue={trip.vehicleId}>
          <SelectTrigger id={vehicleId}><SelectValue /></SelectTrigger>
          <SelectContent>
            {sample.vehicles.map((vehicle) => <SelectItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel htmlFor={driverId}><Optional>{t('trips.create.driver')}</Optional></FieldLabel>
        <Select>
          <SelectTrigger id={driverId}><SelectValue placeholder={t('trips.create.unassigned')} /></SelectTrigger>
          <SelectContent>
            {sample.drivers.map((driver) => <SelectItem key={driver.id} value={driver.id}>{driver.fullName}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Input label={t('profile.identity.email')} readOnly value={sample.dispatcherEmail} hint={t('profile.identity.note')} />
      <Input label={t('trips.create.scheduledDate')} required type="date" defaultValue={trip.scheduledDate} />
      <div className="sm:col-span-2">
        <Textarea label={<Optional>{t('trips.form.notes')}</Optional>} placeholder={t('designSystem.components.fields.notesPlaceholder')} rows={3} />
      </div>
    </div>
  )
}
