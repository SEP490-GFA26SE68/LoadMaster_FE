import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import type { DeliveryStop } from '@/lib/mock-db'
import { stopColor, stopForeground } from '@/lib/stops'
import type { TripFormValues } from './trip-form.schema'
import { FieldMark } from './TripFormSection'

/**
 * Điểm giao của form **sửa** chuyến (LM-088, V2.3; FE-4b-04): mỗi điểm một dòng — mốc số, bốn ô (tên, địa chỉ, số điện thoại, người
 * liên hệ) hai cột. Form chỉ đổi chữ của điểm giao hiện có: điểm tự sinh khi đưa yêu cầu giao vào chuyến, điểm tay thêm ở Chi tiết
 * chuyến (D-73); sắp xếp và xoá cũng ở đó để kiện được đánh số lại cùng lúc. Form tạo chuyến không có mục này. Nhãn hiện chữ ngắn
 * ("Tên"); tên truy cập đủ số điểm ("Tên điểm giao 2") qua `aria-label`. Mốc số mang màu định danh của điểm giao, luôn kèm số. Điểm tự
 * sinh giữ tên và địa chỉ của yêu cầu giao (khoá gộp điểm, D-73): hai ô đó chỉ đọc, còn sửa số điện thoại và người liên hệ.
 */
export function TripStopsFields({ form, saved }: { form: UseFormReturn<TripFormValues>; saved: readonly DeliveryStop[] }) {
  const t = useT()
  const stops = useFieldArray({ control: form.control, name: 'stops' })
  const errors = form.formState.errors.stops
  if (stops.fields.length === 0) return <p className="text-lede text-ink-3">{t('trips.create.noStops')}</p>
  return (
    <ol className="m-0 -ml-10 flex list-none flex-col p-0 max-sm:ml-0">
      {stops.fields.map((field, index) => {
        const number = index + 1
        const own = errors?.[index]
        const generated = saved[index]?.generated === true
        return (
          <li key={field.id} className="grid grid-cols-[40px_minmax(0,1fr)] items-start border-t border-line-soft pt-4.5 pb-5 first:border-t-0 first:pt-1.5">
            <span
              aria-hidden
              className="mt-7.75 ml-px grid size-6.5 place-items-center rounded-[8px] font-display text-caption font-bold"
              style={{ background: stopColor(number), color: stopForeground(number) }}
            >
              {number}
            </span>
            <div className="grid grid-cols-1 gap-x-4 gap-y-3.5 md:grid-cols-2">
              <Input
                label={<>{t('trips.create.stopField.name')}<FieldMark kind="required" /></>}
                aria-label={t('trips.create.stopName', { number })}
                aria-required
                readOnly={generated}
                hint={generated ? t('trips.create.stopGeneratedHint') : undefined}
                error={own?.name?.message}
                {...form.register(`stops.${index}.name`)}
              />
              <Input
                label={t('trips.create.stopField.address')}
                aria-label={t('trips.create.stopAddress', { number })}
                readOnly={generated}
                error={own?.address?.message}
                {...form.register(`stops.${index}.address`)}
              />
              <Input
                type="tel"
                autoComplete="off"
                label={t('trips.create.stopField.phone')}
                aria-label={t('trips.create.stopPhone', { number })}
                error={own?.phone?.message}
                {...form.register(`stops.${index}.phone`)}
              />
              <Input
                label={t('trips.create.stopField.contactName')}
                aria-label={t('trips.create.stopContact', { number })}
                error={own?.contactName?.message}
                {...form.register(`stops.${index}.contactName`)}
              />
            </div>
          </li>
        )
      })}
    </ol>
  )
}
