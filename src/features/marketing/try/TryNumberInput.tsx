import type { FieldPath, UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import type { FieldLimits, TryFormValues } from './try-form'
import { tryFieldError } from './try-messages'

/** Ô số của bản thử: 44 px trên máy bàn, 56 px và chữ 16 px trên máy cảm ứng; số canh phải, mono. */
export const TRY_INPUT = cn('h-11', PUBLIC_TOUCH)

/** Lỗi của một ô theo đường dẫn (`truck.lengthCm`, `cartons.1.quantity`). */
function errorAt(form: UseFormReturn<TryFormValues>, name: FieldPath<TryFormValues>): string | undefined {
  const state = form.getFieldState(name, form.formState)
  return state.error?.message
}

/**
 * Một ô số có nhãn kèm đơn vị ("Dài (cm)"). Bàn phím số trên điện thoại (`inputMode`), nhận dấu "," hoặc "."; lỗi là key của schema, dịch
 * kèm khoảng nhận được của ô.
 */
export function TryNumberInput({ form, name, label, limits }: {
  form: UseFormReturn<TryFormValues>
  name: FieldPath<TryFormValues>
  label: string
  limits: FieldLimits
}) {
  const t = useT()
  const format = useFormat()
  return (
    <Input
      label={label}
      inputMode={limits.integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      numeric
      required
      className={TRY_INPUT}
      error={tryFieldError(t, format, errorAt(form, name), limits)}
      {...form.register(name)}
    />
  )
}
