import { Lock } from 'lucide-react'
import { useId } from 'react'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { fieldLabelClass } from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import type { AlgorithmChoice, OptimizationAlgorithm } from '@/lib/mock-db'
import { cn } from '@/lib/utils'

type Props = {
  /** Cả ba thuật toán theo thứ tự hạng, kèm lý do không chọn được (`algorithmChoices`). */
  readonly choices: readonly AlgorithmChoice[]
  readonly value: OptimizationAlgorithm
  readonly onChange: (algorithm: OptimizationAlgorithm) => void
}

/**
 * Ô chọn thuật toán của lần chạy ở "Thiết lập nâng cao": mỗi thuật toán một dòng (tên, một câu nói nó làm gì). Dòng gói chưa có hoặc
 * nguồn chưa chạy được thì mờ, lý do ngay tại dòng và nối vào ô chọn bằng `aria-describedby`. Câu chung dưới nhóm nói cả ba phương án
 * chạy cùng thuật toán đã chọn và kết quả mang MOCK RESULT.
 */
export function SetupAlgorithmField({ choices, value, onChange }: Props) {
  const t = useT()
  const id = useId()
  const labelId = `${id}-label`
  const noteId = `${id}-note`

  function handleValueChange(next: string) {
    const picked = choices.find((choice) => choice.algorithm === next && choice.block === null)
    if (picked) onChange(picked.algorithm)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className={fieldLabelClass}>{t('runs.algorithm')}</span>
      <RadioGroup value={value} onValueChange={handleValueChange} aria-labelledby={labelId} aria-describedby={noteId}
        className="gap-0 overflow-hidden rounded-md border border-border">
        {choices.map((choice) => <AlgorithmRow key={choice.algorithm} id={`${id}-${choice.algorithm}`} choice={choice} />)}
      </RadioGroup>
      <p id={noteId} className="m-0 text-fine text-ink-3">{t('optimization.algorithmNote')}</p>
    </div>
  )
}

function AlgorithmRow({ id, choice }: { id: string; choice: AlgorithmChoice }) {
  const t = useT()
  const { algorithm, block, requiredTier } = choice
  const hintId = `${id}-hint`
  const reasonId = `${id}-reason`
  return (
    <div data-algorithm-choice={algorithm}
      className={cn('flex items-start gap-3 border-t border-line-soft px-3.5 py-3 first:border-t-0', block === null ? 'bg-bg' : 'bg-surface')}>
      <RadioGroupItem id={id} value={algorithm} disabled={block !== null} className="mt-0.5"
        aria-describedby={block === null ? hintId : `${hintId} ${reasonId}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <label htmlFor={id} className={cn('text-body font-semibold', block === null ? 'cursor-pointer text-ink-strong' : 'text-ink-2')}>
          {t(`runs.algorithms.${algorithm}`)}
        </label>
        <p id={hintId} className="m-0 text-small text-ink-3">{t(`optimization.algorithmChoice.hints.${algorithm}`)}</p>
        {block === null ? null : (
          <p id={reasonId} className="m-0 flex items-center gap-1.5 text-small font-medium text-ink-2">
            <Lock aria-hidden className="size-4 flex-none" strokeWidth={1.5} />
            {t(`optimization.algorithmChoice.blocked.${block}`, { tier: t(`common.planTiers.${requiredTier}`) })}
          </p>
        )}
      </div>
    </div>
  )
}
