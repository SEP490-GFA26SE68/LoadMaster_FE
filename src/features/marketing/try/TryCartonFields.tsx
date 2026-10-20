import { PackagePlus, Trash2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useFieldArray, useWatch, type UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import {
  CARTON_FIELDS,
  CARTON_LIMITS,
  CARTON_PRESET,
  cartonValues,
  EMPTY_CARTON,
  MAX_CARTON_KINDS,
  MAX_TOTAL_QUANTITY,
  totalQuantity,
  type TryFormValues,
} from './try-form'
import { TryNumberInput } from './TryNumberInput'
import { FIELDSET, LEGEND, NOTE } from './TryTruckFields'

const SIZE_FIELDS = ['lengthCm', 'widthCm', 'heightCm'] as const
const LOAD_FIELDS = ['weightKg', 'quantity'] as const

/** Tổng số kiện đang nhập so với trần của bản thử; vượt trần thì đỏ (lỗi chặn nằm ở ô số kiện cuối). */
function CartonTotal({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  const format = useFormat()
  const total = totalQuantity(useWatch({ control: form.control, name: 'cartons' }))
  const over = total > MAX_TOTAL_QUANTITY
  return (
    <p className={cn('m-0 text-small tabular-nums pointer-coarse:text-body-lg', over ? 'text-danger' : 'text-ink-2')}>
      {t('landingTry.cartons.total', { total: format.integer(total), max: format.integer(MAX_TOTAL_QUANTITY) })}
    </p>
  )
}

/** Một loại kiện: chấm màu (cùng màu với hình), nút điền kiện mẫu, nút bỏ (loại thứ hai), dài · rộng · cao, khối lượng, số kiện. */
function CartonFieldset({ form, index, onRemove }: { form: UseFormReturn<TryFormValues>; index: number; onRemove?: () => void }) {
  const t = useT()
  const number = index + 1
  const fill = () => {
    const values = cartonValues(CARTON_PRESET.carton)
    for (const field of CARTON_FIELDS) {
      form.setValue(`cartons.${index}.${field}`, values[field], { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    }
  }
  return (
    <fieldset className={cn(FIELDSET, 'border-t border-line-soft pt-5')}>
      <legend className={cn(LEGEND, 'float-left w-full')}>
        <span aria-hidden className={cn('try-swatch size-3 flex-none rounded-sm', `try-kind-${index}`)} />
        {t('landingTry.cartons.legend', { number })}
      </legend>
      <div className="clear-both flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={fill} className={cn('h-11', PUBLIC_TOUCH)}>
            <PackagePlus aria-hidden strokeWidth={1.5} />
            {t('landingTry.cartons.preset', { name: CARTON_PRESET.name })}{' '}
            <span className="sr-only">{t('landingTry.cartons.presetFor', { number })}</span>
          </Button>
          {onRemove ? (
            <Button type="button" variant="ghost" onClick={onRemove} className={cn('h-11', PUBLIC_TOUCH)}>
              <Trash2 aria-hidden strokeWidth={1.5} />
              {t('landingTry.cartons.remove', { number })}
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {SIZE_FIELDS.map((field) => (
            <TryNumberInput key={field} form={form} name={`cartons.${index}.${field}`} label={t(`landingTry.cartons.${field}`)} limits={CARTON_LIMITS[field]} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {LOAD_FIELDS.map((field) => (
            <TryNumberInput key={field} form={form} name={`cartons.${index}.${field}`} label={t(`landingTry.cartons.${field}`)} limits={CARTON_LIMITS[field]} />
          ))}
        </div>
      </div>
    </fieldset>
  )
}

/**
 * Một hoặc hai loại kiện (`useFieldArray`). Thêm loại thứ hai thì con trỏ vào ô đầu của nó; bỏ loại thứ hai thì con trỏ về nút "Thêm",
 * không rơi về đầu trang.
 */
export function TryCartonFields({ form }: { form: UseFormReturn<TryFormValues> }) {
  const t = useT()
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'cartons' })
  const addRef = useRef<HTMLButtonElement>(null)
  const focusAdd = useRef(false)
  useEffect(() => {
    if (focusAdd.current && fields.length < MAX_CARTON_KINDS) {
      focusAdd.current = false
      addRef.current?.focus()
    }
  }, [fields.length])
  return (
    <div className="flex flex-col gap-5">
      {fields.map((field, index) => (
        <CartonFieldset
          key={field.id}
          form={form}
          index={index}
          onRemove={index > 0 ? () => {
            focusAdd.current = true
            remove(index)
          } : undefined}
        />
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          ref={addRef}
          type="button"
          variant="ghost"
          hidden={fields.length >= MAX_CARTON_KINDS}
          onClick={() => append({ ...EMPTY_CARTON })}
          className={cn('h-11', PUBLIC_TOUCH)}
        >
          <PackagePlus aria-hidden strokeWidth={1.5} />
          {t('landingTry.cartons.add')}
        </Button>
        <CartonTotal form={form} />
      </div>
      <p className={NOTE}>{t('landingTry.cartons.rules')}</p>
    </div>
  )
}
