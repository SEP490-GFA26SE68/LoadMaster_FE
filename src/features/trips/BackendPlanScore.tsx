import { HowComputed } from '@/components/HowComputed'
import type { PlanScore } from '@/features/optimization/load-plans-backend-api'
import { useFormat, useT } from '@/lib/i18n'
import { planScoreEntries, scoreProfileName } from './plan-score-entries'

/**
 * Điểm J của một phương án máy chủ ở So sánh theo lần chạy: dòng "Điểm phương án" (J một chữ số lẻ, kèm "theo hồ sơ <tên>") và nút "Tính
 * thế nào?" mở phân rã (`plan-score-entries.ts`; trọng số tạm thì thêm một câu). Không đánh dấu "Tốt nhất": mỗi phương án chấm theo hồ sơ
 * của chính nó — câu nói vì sao nằm một lần trên các thẻ. Máy chủ không chấm thì không vẽ gì. Số của máy chủ, không MOCK RESULT.
 */
export function BackendPlanScore({ score, planLabel }: {
  score: PlanScore | undefined
  /** Nhãn phương án (`A`, hay `#12` khi không có nhãn) để nút "Tính thế nào?" của mỗi thẻ có tên truy cập riêng. */
  planLabel: string
}) {
  const t = useT()
  const format = useFormat()
  if (!score) return null
  return (
    <div data-plan-score className="flex flex-col">
      <dl className="m-0">
        <div className="flex items-start justify-between gap-3 py-2 text-small">
          <dt className="flex min-w-0 flex-col text-ink-2">
            {t('serverPlans.score.label')}
            {score.profile ? <span className="text-ink-3">{t('serverPlans.score.profile', { name: scoreProfileName(score.profile, t) })}</span> : null}
          </dt>
          <dd className="m-0 font-mono tabular-nums text-ink-1">{format.decimal(score.j)}</dd>
        </div>
      </dl>
      <HowComputed
        entries={planScoreEntries(score, t, format)}
        subject={t('serverPlans.score.subject', { label: planLabel })}
        note={score.assumedWeights ? t('serverPlans.score.assumedWeights') : undefined}
      />
    </div>
  )
}
