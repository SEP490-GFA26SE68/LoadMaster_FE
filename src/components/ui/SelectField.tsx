import { useId, type ReactNode } from 'react'
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { FieldLabel, FieldMessage } from './field-styles'

/** `disabled`: hiện trong danh sách nhưng không chọn được — nhãn tự nói lý do (xe đang bảo dưỡng, LM-088). */
export type SelectOption = { value: string; label: string; disabled?: boolean }

/**
 * Select nối vào react-hook-form. Radix Select không phải input gốc nên phải
 * đi qua Controller thay vì register (AGENTS.md mục 9: mọi form dùng RHF).
 */
export function SelectField<TValues extends FieldValues>({
  control,
  name,
  label,
  options,
  placeholder,
  hint,
  className,
}: {
  control: Control<TValues>
  name: FieldPath<TValues>
  label: ReactNode
  options: readonly SelectOption[]
  placeholder?: string
  hint?: ReactNode
  className?: string
}) {
  const id = useId()
  const t = useT()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const message = fieldState.error?.message
        return (
          <div className={cn('flex flex-col gap-1.5', className)}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Select value={field.value ?? ''} onValueChange={field.onChange}>
              <SelectTrigger
                id={id}
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={message ? true : undefined}
              >
                <SelectValue placeholder={placeholder ?? t('common.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {options.map((option) => (
                  <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldMessage error={message} hint={hint} />
          </div>
        )
      }}
    />
  )
}

/** Đổi bảng nhãn dạng Record thành danh sách option cho SelectField. */
export function optionsFromLabels<T extends string>(
  labels: Record<T, string>,
): SelectOption[] {
  return (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
  }))
}
