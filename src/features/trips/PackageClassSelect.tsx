import { useId } from 'react'
import { Controller, type Control } from 'react-hook-form'
import { FieldLabel, FieldMessage } from '@/components/ui/field-styles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { HANDLING_CLASSES, type CargoPackage, type HandlingClass } from '@/domain/models'
import { useT } from '@/lib/i18n'

const isHandlingClass = (value: string): value is HandlingClass => (HANDLING_CLASSES as readonly string[]).includes(value)

/**
 * Ô chọn loại hàng của form kiện trong chuyến (FE-3b-07, D-68): kiện thêm trong chuyến thành kiện của kho kiện mang loại hàng này
 * (in trên nhãn). `handlingClass` của `CargoPackage` là trường tuỳ chọn — kiện chưa khai hiện là hàng thường, và chỉ ghi vào kiện khi
 * người dùng chọn, nên mở rồi lưu một kiện cũ không làm phương án lỗi thời.
 */
export function PackageClassSelect({ control, label, hint }: { control: Control<CargoPackage>; label: string; hint: string }) {
  const id = useId()
  const t = useT()
  return (
    <Controller
      control={control}
      name="handlingClass"
      render={({ field }) => (
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Select value={field.value ?? 'STANDARD'} onValueChange={(value) => (isHandlingClass(value) ? field.onChange(value) : undefined)}>
            <SelectTrigger id={id} ref={field.ref} onBlur={field.onBlur} aria-describedby={`${id}-hint`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HANDLING_CLASSES.map((value) => <SelectItem key={value} value={value}>{t(`common.handlingClasses.${value}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <FieldMessage id={`${id}-hint`} hint={hint} />
        </div>
      )}
    />
  )
}
