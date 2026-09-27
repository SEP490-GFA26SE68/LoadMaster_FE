import { useId } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { FieldLabel } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import type { CargoPackage } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { PackageStopMarker } from './PackageStopMarker'
import type { StopRow } from './trip-summary'

/**
 * Ô chọn điểm giao của form kiện (V2.3): Select Radix có mốc màu + tên điểm, trong ô và trong danh sách. `deliveryStop` là số nên
 * không đi qua `SelectField` (giá trị chuỗi); Controller đổi chuỗi ↔ số tại đây.
 */
export function PackageStopSelect({ control, stops, label }: {
  control: Control<CargoPackage>
  stops: readonly StopRow[]
  label: string
}) {
  const id = useId()
  const t = useT()
  return (
    <Controller
      control={control}
      name="deliveryStop"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} className="min-w-0 [&>span]:min-w-0 [&>span]:truncate">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stops.map((stop) => (
                <SelectItem key={stop.id} value={String(stop.number)}>
                  <span className="flex min-w-0 items-center gap-2">
                    <PackageStopMarker number={stop.number} size="sm" />
                    <span className="truncate"><span className="sr-only">{t('common.stop', { number: stop.number })}: </span>{stop.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    />
  )
}
