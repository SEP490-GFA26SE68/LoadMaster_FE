import { PackagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import { StopDot } from '@/components/StopChip'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/SelectField'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { HowComputed } from '@/components/HowComputed'
import { PUBLIC_TOUCH } from '../public-chrome'
import { addedCarton, CARTON_LIMITS, MAX_CARTON_KINDS, MAX_TOTAL_QUANTITY, STOP_CHOICES, totalQuantity, type TryFormValues } from './try-form'
import { TRY_FIELDSET, TRY_LEGEND, TryNumberInput } from './TryNumberInput'

const SIZE_FIELDS = ['lengthCm', 'widthCm', 'heightCm'] as const
const LOAD_FIELDS = ['weightKg', 'quantity'] as const
/** Ô chọn Radix: nút mở 56 px và chữ 16 px trên máy cảm ứng, như ô số. */
const SELECT_TOUCH = 'pointer-coarse:[&_button]:h-14 pointer-coarse:[&_button]:text-body-lg'

/** Tổng số kiện đang nhập so với trần của bản thử; vượt trần thì chữ đỏ (lỗi chặn nằm ở ô số kiện của loại cuối). */
function CartonTotal({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  const format = useFormat()
  const total = totalQuantity(useWatch({ control: form.control, name: 'cartons' }))
  return (
    <p className={cn('m-0 text-small tabular-nums pointer-coarse:text-body-lg', total > MAX_TOTAL_QUANTITY ? 'text-danger' : 'text-ink-2')}>
      {t('landingTry.cartons.total', { total: format.integer(total), max: format.integer(MAX_TOTAL_QUANTITY) })}
    </p>
  )
}

/** Chấm màu của điểm giao đang chọn — cùng màu với kiện của loại này trên hình phương án. Trang trí: ô chọn đã nói điểm nào. */
function CartonStopDot({ form, index }: { form: UseFormReturn<TryFormValues>; index: number }) {
  const stop = useWatch({ control: form.control, name: `cartons.${index}.stop` })
  return <StopDot stop={Number(stop)} className="size-6 text-small" />
}

/**
 * Một loại kiện: dài · rộng · cao (cm), khối lượng (kg), số kiện và điểm giao; nút bỏ khi còn hơn một loại. Lỗi "quá trần tổng số kiện"
 * nằm ở ô số kiện của loại cuối nhưng phụ thuộc mọi ô số kiện: đổi một ô thì các ô số kiện khác (`count` loại) được kiểm lại, để lỗi tự
 * hết khi tổng đã về dưới trần.
 */
function CartonFieldset({ form, index, count, onRemove }: { form: UseFormReturn<TryFormValues>; index: number; count: number; onRemove?: () => void }) {
  const t = useT()
  const number = index + 1
  const stops = STOP_CHOICES.map((value) => ({ value, label: t('landingTry.cartons.stopOption', { number: value }) }))
  const otherQuantities = Array.from({ length: count }, (_, other) => `cartons.${other}.quantity` as const).filter((_, other) => other !== index)
  return (
    <fieldset className={cn(TRY_FIELDSET, 'border-t border-line-soft pt-4')}>
      <legend className="sr-only">{t('landingTry.cartons.legend', { number })}</legend>
      <div className="flex min-h-9 items-center justify-between gap-3">
        <span aria-hidden className={TRY_LEGEND}>
          <CartonStopDot form={form} index={index} />
          {t('landingTry.cartons.legend', { number })}
        </span>
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={t('landingTry.cartons.remove', { number })}
            title={t('landingTry.cartons.remove', { number })}
            // Vùng chạm 56 px trên máy cảm ứng nhưng hàng tiêu đề giữ 36 px: phần thừa tràn vào khoảng trống trên và dưới hàng
            className="pointer-coarse:-my-2.5 pointer-coarse:size-14"
          >
            <Trash2 aria-hidden strokeWidth={1.5} />
          </Button>
        ) : null}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-3">
        {SIZE_FIELDS.map((field) => (
          <TryNumberInput key={field} form={form} name={`cartons.${index}.${field}`} label={t(`landingTry.cartons.${field}`)} limits={CARTON_LIMITS[field]} />
        ))}
        {LOAD_FIELDS.map((field) => (
          <TryNumberInput
            key={field}
            form={form}
            name={`cartons.${index}.${field}`}
            label={t(`landingTry.cartons.${field}`)}
            limits={CARTON_LIMITS[field]}
            deps={field === 'quantity' ? otherQuantities : undefined}
          />
        ))}
        <SelectField control={form.control} name={`cartons.${index}.stop`} label={t('landingTry.cartons.stop')} options={stops} className={SELECT_TOUCH} />
      </div>
    </fieldset>
  )
}

/**
 * Một tới bốn loại kiện (`useFieldArray`). Thêm loại mới thì con trỏ vào ô đầu của nó (mặc định của `append`); bỏ một loại thì con trỏ về
 * nút "Thêm loại kiện", không rơi về đầu trang.
 */
export function TryCartonFields({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'cartons' })
  const addRef = useRef<HTMLButtonElement>(null)
  const focusAdd = useRef(false)
  useEffect(() => {
    if (focusAdd.current) {
      focusAdd.current = false
      addRef.current?.focus()
    }
  }, [fields.length])
  return (
    <div className="flex flex-col gap-4">
      {fields.map((field, index) => (
        <CartonFieldset
          key={field.id}
          form={form}
          index={index}
          count={fields.length}
          onRemove={fields.length > 1 ? () => {
            focusAdd.current = true
            remove(index)
          } : undefined}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Button
          ref={addRef}
          type="button"
          variant="ghost"
          hidden={fields.length >= MAX_CARTON_KINDS}
          onClick={() => append(addedCarton(fields.length))}
          className={cn('-ml-2', PUBLIC_TOUCH)}
        >
          <PackagePlus aria-hidden strokeWidth={1.5} />
          {t('landingTry.cartons.add')}
        </Button>
        <CartonTotal form={form} />
      </div>
      {/* Bản thử giả định gì về thùng xe và kiện: một nút thay hai đoạn văn — điện thoại ngắn đi gần 150 px */}
      <HowComputed
        subject={t('landingTry.form.howSubject')}
        entries={[
          { key: 'truck', label: t('landingTry.truck.legend'), text: t('landingTry.truck.note') },
          { key: 'cartons', label: t('landingTry.cartons.rulesLabel'), text: t('landingTry.cartons.rules') },
        ]}
        className="-mt-2"
      />
    </div>
  )
}
