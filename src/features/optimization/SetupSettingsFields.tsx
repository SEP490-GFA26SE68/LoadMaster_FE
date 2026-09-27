import { useId, useState, type ReactNode } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/lib/i18n'
import { OPTIMIZATION_ALGORITHMS, OPTIMIZATION_OBJECTIVES } from '@/lib/mock-db'
import type { SetupValues } from './optimization-request'

type Form = { form: UseFormReturn<SetupValues> }

/** Phần "Yêu cầu xếp hàng" (Spec 9.4, V2): hai công tắc, mỗi công tắc một câu giải thích nối bằng `aria-describedby`. */
export function SetupRequirementFields({ form }: Form) {
  const t = useT()
  const lifoHint = useId()
  const lowCenterHint = useId()
  const { control, setValue } = form
  const enforceLifo = useWatch({ control, name: 'enforceLifo' })
  const lowCenter = useWatch({ control, name: 'prioritizeLowCenterOfGravity' })

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <Switch label={t('optimization.enforceLifo')} checked={enforceLifo} aria-describedby={lifoHint}
          onCheckedChange={(checked) => setValue('enforceLifo', checked, { shouldDirty: true })} />
        <p id={lifoHint} className="pl-12 text-caption text-ink-3">{t('optimization.lifoHint')}</p>
      </div>
      <div className="flex flex-col gap-1 pt-4">
        <Switch label={t('optimization.lowCenterOfGravity')} checked={lowCenter} aria-describedby={lowCenterHint}
          onCheckedChange={(checked) => setValue('prioritizeLowCenterOfGravity', checked, { shouldDirty: true })} />
        <p id={lowCenterHint} className="pl-12 text-caption text-ink-3">{t('optimization.lowCenterHint')}</p>
      </div>
    </div>
  )
}

/**
 * Phần "Thiết lập nâng cao" gập trong `<details>` (V2): mục tiêu và thuật toán của lần chạy (luồng 3 Review 1, LM-104 — kho lưu vào
 * lịch sử lần chạy; mock tối ưu bỏ qua nên câu ghi chú nói rõ kết quả vẫn là MOCK RESULT), thời gian giới hạn và random seed. Có lỗi ở
 * hai ô số thì phần này tự mở, để lỗi không nằm khuất khi nút Tối ưu bị tắt.
 */
export function SetupAdvancedFields({ form }: Form) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { control, register, setValue, formState: { errors } } = form
  const objective = useWatch({ control, name: 'objective' })
  const algorithm = useWatch({ control, name: 'algorithm' })
  const hasError = errors.timeLimitSeconds !== undefined || errors.randomSeed !== undefined

  return (
    <details open={open || hasError} onToggle={(event) => setOpen(event.currentTarget.open)} className="group">
      <summary className="cursor-pointer rounded-sm text-body font-medium text-ink-1 marker:text-ink-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
        {t('optimization.advancedTitle')}
        <span className="ml-2 text-caption font-normal text-ink-3">{t('optimization.advancedHint')}</span>
      </summary>
      <div className="flex flex-col gap-5 pt-4">
        <div className="grid gap-5 md:grid-cols-2">
          <Choice legend={t('runs.objective')}>
            <RadioGroup aria-label={t('runs.objective')} value={objective}
              onValueChange={(value) => {
                const code = OPTIMIZATION_OBJECTIVES.find((item) => item === value)
                if (code) setValue('objective', code, { shouldDirty: true })
              }}>
              {OPTIMIZATION_OBJECTIVES.map((code) => (
                <Option key={code} value={code} label={t(`runs.objectives.${code}`)} hint={t(`optimization.objectiveHints.${code}`)} />
              ))}
            </RadioGroup>
          </Choice>
          <Choice legend={t('runs.algorithm')}>
            <RadioGroup aria-label={t('runs.algorithm')} value={algorithm}
              onValueChange={(value) => {
                const code = OPTIMIZATION_ALGORITHMS.find((item) => item === value)
                if (code) setValue('algorithm', code, { shouldDirty: true })
              }}>
              {OPTIMIZATION_ALGORITHMS.map((code) => (
                <Option key={code} value={code} label={t(`runs.algorithms.${code}`)} hint={t(`optimization.algorithmHints.${code}`)} />
              ))}
            </RadioGroup>
          </Choice>
        </div>
        <p className="text-caption text-ink-3">{t('optimization.runChoiceNote')}</p>

        <div className="grid grid-cols-2 gap-3">
          <Input label={t('optimization.timeLimit')} numeric suffix="s" type="number" step="1"
            error={errors.timeLimitSeconds?.message} {...register('timeLimitSeconds', { valueAsNumber: true })} />
          <Input label={t('optimization.randomSeed')} numeric type="number" step="1"
            error={errors.randomSeed?.message} {...register('randomSeed', { valueAsNumber: true })} />
        </div>
      </div>
    </details>
  )
}

function Choice({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2.5 border-0 p-0">
      <legend className="mb-1 text-caption font-medium text-ink-2">{legend}</legend>
      {children}
    </fieldset>
  )
}

/** Một lựa chọn: nhãn và một dòng giải thích ngay dưới, thẳng hàng với chữ của nhãn. */
function Option({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <RadioGroupItem value={value} label={label} />
      <span className="pl-7 text-caption text-ink-3">{hint}</span>
    </div>
  )
}
