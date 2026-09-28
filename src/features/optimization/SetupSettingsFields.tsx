import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Switch } from '@/components/ui/Switch'
import { fieldLabelClass } from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import { OPTIMIZATION_ALGORITHMS, OPTIMIZATION_OBJECTIVES } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import type { SetupValues } from './optimization-request'

type Form = { form: UseFormReturn<SetupValues> }

/** Phần "Yêu cầu xếp hàng" (Spec 9.4, V2.3): hai công tắc, mỗi công tắc một câu giải thích nối bằng `aria-describedby`. */
export function SetupRequirementFields({ form }: Form) {
  const t = useT()
  const lifoHint = useId()
  const lowCenterHint = useId()
  const { control, setValue } = form
  const enforceLifo = useWatch({ control, name: 'enforceLifo' })
  const lowCenter = useWatch({ control, name: 'prioritizeLowCenterOfGravity' })

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-0.75 border-b border-line-soft pb-3.5">
        <Switch label={t('optimization.enforceLifo')} checked={enforceLifo} aria-describedby={lifoHint}
          onCheckedChange={(checked) => setValue('enforceLifo', checked, { shouldDirty: true })} />
        <p id={lifoHint} className="pl-12 text-fine text-ink-3">{t('optimization.lifoHint')}</p>
      </div>
      <div className="flex flex-col gap-0.75 pt-3.5">
        <Switch label={t('optimization.lowCenterOfGravity')} checked={lowCenter} aria-describedby={lowCenterHint}
          onCheckedChange={(checked) => setValue('prioritizeLowCenterOfGravity', checked, { shouldDirty: true })} />
        <p id={lowCenterHint} className="pl-12 text-fine text-ink-3">{t('optimization.lowCenterHint')}</p>
      </div>
    </div>
  )
}

/**
 * Phần "Thiết lập nâng cao" gập trong `<details>` (V2.3: ô mũi tên 28 px, tiêu đề Archivo, ghi chú): mục tiêu và thuật toán của lần chạy
 * (luồng 3 Review 1, LM-104 — kho lưu vào lịch sử lần chạy; mock tối ưu bỏ qua nên câu ghi chú nói rõ kết quả vẫn là MOCK RESULT) dựng
 * thành danh sách chọn có viền như ô "Phương pháp" của bản mẫu, rồi thời gian giới hạn và random seed. Có lỗi ở hai ô số thì phần này tự
 * mở, để lỗi không nằm khuất khi nút Tối ưu bị tắt. Giữ `<details>`/`<summary>` (E2E mở phần này qua `summary`).
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
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="grid size-7 flex-none place-items-center rounded-[9px] bg-n-100 text-ink-2">
          <ChevronDown className="size-4 transition-transform duration-(--dur-fast) ease-standard group-open:rotate-180" strokeWidth={2} />
        </span>
        <span className="font-display text-[17px] leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('optimization.advancedTitle')}</span>
        <span className="text-small text-ink-3 max-md:hidden">{t('optimization.advancedHint')}</span>
      </summary>
      <div className="mt-4.5 ml-10 flex flex-col gap-5 max-sm:ml-0">
        <ChoiceList legend={t('runs.objective')} value={objective}
          options={OPTIMIZATION_OBJECTIVES.map((code) => ({ value: code, label: t(`runs.objectives.${code}`), hint: t(`optimization.objectiveHints.${code}`) }))}
          onChange={(value) => {
            const code = OPTIMIZATION_OBJECTIVES.find((item) => item === value)
            if (code) setValue('objective', code, { shouldDirty: true })
          }} />
        <ChoiceList legend={t('runs.algorithm')} value={algorithm}
          options={OPTIMIZATION_ALGORITHMS.map((code) => ({ value: code, label: t(`runs.algorithms.${code}`), hint: t(`optimization.algorithmHints.${code}`) }))}
          onChange={(value) => {
            const code = OPTIMIZATION_ALGORITHMS.find((item) => item === value)
            if (code) setValue('algorithm', code, { shouldDirty: true })
          }} />
        <p className="-mt-2 text-fine text-ink-3">{t('optimization.runChoiceNote')}</p>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-4 max-md:col-span-6">
            <Input label={t('optimization.timeLimit')} numeric suffix={t('optimization.timeUnit')} type="number" step="1"
              hint={t('optimization.timeLimitHint')} error={errors.timeLimitSeconds?.message} {...register('timeLimitSeconds', { valueAsNumber: true })} />
          </div>
          <div className="col-span-4 max-md:col-span-6">
            <Input label={t('optimization.randomSeed')} numeric type="number" step="1"
              hint={t('optimization.seedHint')} error={errors.randomSeed?.message} {...register('randomSeed', { valueAsNumber: true })} />
          </div>
        </div>
      </div>
    </details>
  )
}

type Choice = { value: string; label: string; hint: string }

/**
 * Nhóm chọn một (V2.3 `.methods`): khung viền bo 12, mỗi lựa chọn một hàng 44 px, hàng đang chọn nền `--cyan-50`, câu giải thích
 * dồn phải (đậm cyan khi chọn). Radio vẫn là Radix `RadioGroup` nên phím mũi tên và tên truy cập ("Cân bằng tải trục") giữ nguyên.
 */
function ChoiceList({ legend, value, options, onChange }: { legend: string; value: string; options: Choice[]; onChange: (value: string) => void }) {
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0">
      <legend className={cn('mb-2 p-0', fieldLabelClass)}>{legend}</legend>
      <RadioGroup aria-label={legend} value={value} onValueChange={onChange}
        className="gap-0 overflow-hidden rounded-md border border-border">
        {options.map((option) => (
          <div key={option.value} data-state={option.value === value ? 'on' : 'off'}
            className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line-soft px-3.5 py-2 first:border-t-0 data-[state=on]:bg-cyan-50">
            <RadioGroupItem value={option.value} label={option.label} />
            <span className={cn('ml-auto text-right text-fine', option.value === value ? 'font-semibold text-cyan-800' : 'text-ink-3')}>{option.hint}</span>
          </div>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

