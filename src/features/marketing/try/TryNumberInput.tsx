import type { FieldPath, UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { useFormat, useT } from '@/lib/i18n'
import { PUBLIC_TOUCH } from '../public-chrome'
import type { FieldLimits, TryFormValues } from './try-form'
import { tryFieldError } from './try-messages'

/** Nhãn nhóm ô (`<legend>`), khung `<fieldset>` và câu chú thích dưới nhóm ô — dùng chung cho thùng xe và loại kiện. */
export const TRY_LEGEND = 'm-0 flex items-center gap-2 p-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%'
export const TRY_FIELDSET = 'm-0 min-w-0 border-0 p-0'
export const TRY_NOTE = 'm-0 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg'

/**
 * Một ô số có nhãn kèm đơn vị ("Dài (cm)"): bàn phím số trên điện thoại (`inputMode`), nhận dấu "," hoặc "."; 56 px và chữ 16 px trên máy
 * cảm ứng. Mọi ô đều bắt buộc (`aria-required`) nên không gắn dấu sao cho từng nhãn. Lỗi là key của schema, dịch kèm khoảng nhận được.
 * `deps`: các ô phải kiểm lại khi ô này đổi (lỗi của chúng phụ thuộc số ở đây).
 */
export function TryNumberInput({ form, name, label, limits, deps }: {
  form: UseFormReturn<TryFormValues>
  name: FieldPath<TryFormValues>
  label: string
  limits: FieldLimits
  deps?: FieldPath<TryFormValues>[]
}) {
  const t = useT()
  const format = useFormat()
  const message = form.getFieldState(name, form.formState).error?.message
  return (
    <Input
      label={label}
      inputMode={limits.integer ? 'numeric' : 'decimal'}
      autoComplete="off"
      spellCheck={false}
      numeric
      aria-required
      className={PUBLIC_TOUCH}
      error={tryFieldError(t, format, message, limits)}
      {...form.register(name, deps && deps.length > 0 ? { deps } : undefined)}
    />
  )
}
