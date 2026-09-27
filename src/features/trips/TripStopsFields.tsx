import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { TripFormValues } from './trip-form.schema'
import { FieldMark } from './TripFormSection'

/**
 * Điểm giao của form chuyến (LM-053, LM-088, V2.3 TaoChuyen.jpg): mỗi điểm một dòng — mốc số, bốn ô (tên, địa chỉ, số điện thoại,
 * người liên hệ) hai cột, cột nút ↑/↓/xoá bên phải khi tạo mới (bàn phím dùng được ngay, không cần kéo thả). Sửa chỉ đổi chữ của
 * điểm giao hiện có — sắp xếp và xoá ở Chi tiết chuyến để kiện được đánh số lại cùng lúc. Nhãn hiện chữ ngắn ("Tên"); tên truy cập
 * đủ số điểm ("Tên điểm giao 2") qua `aria-label`. Mốc số mang màu định danh của điểm giao, luôn kèm số (AGENTS mục 4).
 */
export function TripStopsFields({ form, creating }: { form: UseFormReturn<TripFormValues>; creating: boolean }) {
  const t = useT()
  const stops = useFieldArray({ control: form.control, name: 'stops' })
  const errors = form.formState.errors.stops
  const listError = errors?.root?.message ?? errors?.message
  const last = stops.fields.length - 1

  return (
    <div className="-ml-10 flex flex-col gap-1 max-sm:ml-0">
      <ol className="m-0 flex list-none flex-col p-0">
        {stops.fields.map((field, index) => {
          const number = index + 1
          const own = errors?.[index]
          const names = {
            name: t('trips.create.stopName', { number }),
            address: t('trips.create.stopAddress', { number }),
            phone: t('trips.create.stopPhone', { number }),
            contactName: t('trips.create.stopContact', { number }),
          }
          return (
            <li
              key={field.id}
              className={cn(
                'grid items-start border-t border-line-soft pt-4.5 pb-5 first:border-t-0 first:pt-1.5',
                creating ? 'grid-cols-[40px_minmax(0,1fr)_44px]' : 'grid-cols-[40px_minmax(0,1fr)]',
              )}
            >
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
                  aria-label={names.name}
                  aria-required
                  error={own?.name?.message}
                  {...form.register(`stops.${index}.name`)}
                />
                <Input label={t('trips.create.stopField.address')} aria-label={names.address} error={own?.address?.message} {...form.register(`stops.${index}.address`)} />
                <Input
                  type="tel"
                  autoComplete="off"
                  label={t('trips.create.stopField.phone')}
                  aria-label={names.phone}
                  error={own?.phone?.message}
                  {...form.register(`stops.${index}.phone`)}
                />
                <Input label={t('trips.create.stopField.contactName')} aria-label={names.contactName} error={own?.contactName?.message} {...form.register(`stops.${index}.contactName`)} />
              </div>
              {creating ? (
                <div className="flex flex-col items-end gap-1 pt-6">
                  <Button type="button" variant="ghost" size="sm" className="size-8 px-0 text-ink-3" aria-label={t('trips.create.moveStopUp', { number })} disabled={index === 0} onClick={() => stops.move(index, index - 1)}>
                    <ArrowUp strokeWidth={1.75} />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="size-8 px-0 text-ink-3" aria-label={t('trips.create.moveStopDown', { number })} disabled={index === last} onClick={() => stops.move(index, index + 1)}>
                    <ArrowDown strokeWidth={1.75} />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="size-8 px-0 text-ink-3" aria-label={t('trips.create.removeStop', { number })} disabled={stops.fields.length === 1} onClick={() => stops.remove(index)}>
                    <Trash2 strokeWidth={1.75} />
                  </Button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {listError ? <p role="alert" className="ml-10 text-fine text-danger">{listError}</p> : null}
      {creating ? (
        <Button
          type="button"
          variant="secondary"
          className="ml-10 self-start"
          onClick={() => stops.append({ name: '', address: '', phone: '', contactName: '' })}
        >
          <Plus strokeWidth={1.5} />
          {t('trips.create.addStop')}
        </Button>
      ) : null}
    </div>
  )
}
