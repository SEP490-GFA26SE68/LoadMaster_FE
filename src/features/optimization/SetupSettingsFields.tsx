import { ChevronDown } from 'lucide-react'
import { useId, useState } from 'react'
import { useWatch, type UseFormReturn } from 'react-hook-form'
import { Input } from '@/components/ui/Input'
import { Switch } from '@/components/ui/Switch'
import { fieldLabelClass } from '@/components/ui/field-styles'
import { PLAN_LABELS, PLAN_OBJECTIVES } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { DEFAULT_RUN_ALGORITHM } from '@/lib/mock-db'
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
 * Ba phương án mỗi lần chạy (FE-5b-05, D-77) — thay ô chọn mục tiêu của LM-104: người dùng không chọn mục tiêu nữa, một lần chạy tạo
 * đủ ba. Danh sách chỉ đọc cùng khung viền với nhóm chọn cũ: ô nhãn A · B · C, tên mục tiêu, câu giải thích dồn phải.
 */
export function SetupCandidateList() {
  const t = useT()
  return (
    <ul aria-label={t('optimization.candidatesTitle')} className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border p-0">
      {PLAN_OBJECTIVES.map((objective) => (
        <li key={objective} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-line-soft px-3.5 py-2 first:border-t-0">
          <span aria-hidden className="grid size-5.5 flex-none place-items-center rounded-[7px] bg-n-100 font-display text-caption font-bold text-ink-2">
            {PLAN_LABELS[objective]}
          </span>
          <span className="text-body font-semibold text-ink-strong">
            <span className="sr-only">{t('optimization.candidateLabel', { label: PLAN_LABELS[objective] })}: </span>
            {t(`runs.objectives.${objective}`)}
          </span>
          <span className="ml-auto text-right text-fine text-ink-3">{t(`optimization.objectiveHints.${objective}`)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Phần "Thiết lập nâng cao" gập trong `<details>` (V2.3: ô mũi tên 28 px, tiêu đề Archivo, ghi chú): tên thuật toán của lần chạy — chỉ
 * đọc, không chọn tay (FE-5b-05; hạng thuật toán theo gói nối ở FE-8-05), kèm câu nói rõ kết quả là MOCK RESULT — rồi thời gian giới hạn
 * và random seed. Có lỗi ở hai ô số thì phần này tự mở, để lỗi không nằm khuất khi nút Tối ưu bị tắt. Giữ `<details>`/`<summary>` (E2E mở
 * phần này qua `summary`).
 */
export function SetupAdvancedFields({ form }: Form) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { register, formState: { errors } } = form
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
        <dl className="m-0 flex flex-col gap-1.5">
          <dt className={fieldLabelClass}>{t('runs.algorithm')}</dt>
          <dd data-run-algorithm className="m-0 flex min-h-11 items-center rounded-md border border-border bg-n-25 px-3.5 text-body font-semibold text-ink-strong">
            {t(`runs.algorithms.${DEFAULT_RUN_ALGORITHM}`)}
          </dd>
          <dd className="m-0 text-fine text-ink-3">{t('optimization.algorithmNote')}</dd>
        </dl>

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
