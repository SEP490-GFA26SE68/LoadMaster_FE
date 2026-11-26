import { Calculator, ChevronDown } from 'lucide-react'
import { useWatch, type UseFormReturn } from 'react-hook-form'

import { Input } from '@/components/ui/Input'
import { useT, type MessageKey } from '@/lib/i18n'

import { McKeeEstimator } from './McKeeEstimator'
import type { PackageTypeFormInput, PackageTypeFormValues } from './package-type-form'

/**
 * Ô "Sức chịu nén mặt trên" σ (kg/m²) của form loại kiện máy chủ, kèm phần mở ra được "Ước tính cho thùng carton" (McKee). Ô để trống được:
 * trống là chưa có số liệu, lần chạy tối ưu báo thiếu — không điền sẵn giá trị nào. Theo dõi dài, rộng ở đây để cả hộp thoại không vẽ lại.
 */
export function TopLoadCapacityField({ form }: { form: UseFormReturn<PackageTypeFormInput, unknown, PackageTypeFormValues> }) {
  const t = useT()
  const [lengthCm, widthCm] = useWatch({ control: form.control, name: ['lengthCm', 'widthCm'] })
  const message = form.formState.errors.topLoadCapacityKgM2?.message

  return (
    <div className="flex flex-col gap-2">
      <Input
        label={t('physicalData.sigma.label')}
        hint={t('physicalData.sigma.hint')}
        numeric
        suffix="kg/m²"
        type="number"
        step="0.01"
        min={0}
        className="text-left"
        error={message ? t(message as MessageKey) : undefined}
        {...form.register('topLoadCapacityKgM2', { valueAsNumber: true })}
      />
      <details className="group rounded-md border border-border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-body font-medium text-ink-1 [&::-webkit-details-marker]:hidden">
          <Calculator aria-hidden className="size-4 text-ink-3" strokeWidth={1.5} />
          <span className="flex-1">{t('physicalData.mckee.toggle')}</span>
          <ChevronDown aria-hidden className="size-4 text-ink-3 group-open:rotate-180 motion-reduce:transition-none" strokeWidth={1.5} />
        </summary>
        <div className="border-t border-border px-3 py-3">
          <McKeeEstimator
            lengthCm={Number(lengthCm)}
            widthCm={Number(widthCm)}
            onUse={(value) => form.setValue('topLoadCapacityKgM2', value, { shouldDirty: true, shouldValidate: true })}
          />
        </div>
      </details>
    </div>
  )
}
