import { Boxes, PackageOpen, Scale, SlidersHorizontal, type LucideIcon } from 'lucide-react'
import { SCORE_PROFILES, type LoadPlan, type PlanScore } from '@/features/optimization/load-plans-backend-api'
import type { ScoreProfile } from '@/features/optimization/plan-score-dto'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { AxleUsage } from './axle-usage'
import { scoreProfileName } from './plan-score-entries'
import { scoreBars, type ScoreBar } from './score-bars'

/**
 * Phần riêng của thẻ phương án ở So sánh theo lần chạy bản máy chủ: hồ sơ ưu tiên (icon + một câu), biểu đồ điểm cộng / trừ và thanh tải
 * trục. Mọi số là của máy chủ; hình `aria-hidden`, chữ cạnh hình nói đủ điều hình nói.
 */

const PROFILE_ICONS: Readonly<Record<ScoreProfile, LucideIcon>> = { A: Boxes, B: Scale, C: PackageOpen, default: SlidersHorizontal }

/** Hồ sơ của phương án: hồ sơ máy chủ chấm điểm theo, không có thì theo nhãn A · B · C; còn lại không có khối hồ sơ. */
export function planProfile(plan: LoadPlan): ScoreProfile | null {
  const fromScore = SCORE_PROFILES.find((profile) => profile === plan.score?.profile)
  return fromScore ?? SCORE_PROFILES.find((profile) => profile === plan.label) ?? null
}

export function PlanProfile({ profile }: { profile: ScoreProfile }) {
  const t = useT()
  const Icon = PROFILE_ICONS[profile]
  return (
    <div data-plan-profile={profile} className="flex items-start gap-3">
      <span className="grid size-9 flex-none place-items-center rounded-md bg-tint-blue text-tint-blue-fg" aria-hidden>
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <p className="flex min-w-0 flex-col text-small">
        <span className="font-semibold text-ink-1">{scoreProfileName(profile, t)}</span>
        <span className="text-pretty text-ink-2">{t(`serverRun.compare.profile.${profile}`)}</span>
      </p>
    </div>
  )
}

function barName(bar: ScoreBar, t: TFunction): string {
  if (bar.key === 'volume' || bar.key === 'count') return t(`serverPlans.score.${bar.key}.label`)
  return t(`serverPlans.score.components.${bar.key}`)
}

/**
 * Biểu đồ điểm: mỗi khoản một thanh — cộng tô `--primary`, trừ xám trung tính —, luôn kèm dấu và số. Hình `aria-hidden`; dòng dưới hình
 * (đọc được) nói khoản trừ lớn nhất. Thanh mọc một lần; giảm chuyển động thì đứng yên.
 */
export function ScoreBars({ score }: { score: PlanScore }) {
  const t = useT()
  const format = useFormat()
  const { bars, largestPenalty } = scoreBars(score)
  if (bars.length === 0) return null
  return (
    <div data-score-bars className="flex flex-col gap-2">
      <p className="text-small font-semibold text-ink-2">{t('serverRun.compare.bars.title')}</p>
      <ul aria-hidden className="flex flex-col gap-1.5">
        {bars.map((bar) => (
          <li key={bar.key} data-score-bar={bar.key} data-sign={bar.sign} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-2 text-fine">
            <span className="truncate text-ink-2">{barName(bar, t)}</span>
            <span className="h-2 overflow-hidden rounded-full bg-line-soft">
              <span
                className={cn(
                  'block h-full origin-left rounded-full motion-safe:animate-[lm-bar-grow_var(--dur-slow)_var(--ease-decelerate)_both]',
                  bar.sign === 'plus' ? 'bg-primary' : 'bg-n-500',
                )}
                style={{ width: `${bar.share * 100}%` }}
              />
            </span>
            <span className="text-right font-mono tabular-nums text-ink-1">
              {t(`serverRun.compare.bars.${bar.sign}`, { points: format.decimal(bar.points) })}
            </span>
          </li>
        ))}
      </ul>
      <p data-score-biggest className="text-small text-pretty text-ink-2">
        {largestPenalty
          ? t('serverRun.compare.bars.biggest', { name: barName(largestPenalty, t), points: format.decimal(largestPenalty.points) })
          : t('serverRun.compare.bars.noPenalty')}
      </p>
    </div>
  )
}

/** Thanh tải trục so giới hạn: vượt thì thanh đầy kèm chữ "Vượt … kg" (không chỉ màu). */
export function AxleUsageBars({ usage }: { usage: readonly AxleUsage[] }) {
  const t = useT()
  const format = useFormat()
  if (usage.length === 0) return null
  return (
    <dl data-axle-usage className="flex flex-col gap-2">
      {usage.map((item) => (
        <div key={item.group} data-axle-group={item.group} className="flex flex-col gap-1 text-small">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">{t(item.group === 'front' ? 'serverPlans.compare.metrics.frontAxle' : 'serverPlans.compare.metrics.rearAxle')}</dt>
            <dd className="m-0 flex items-center gap-2 font-mono tabular-nums text-ink-1">
              {item.overKg > 0 ? <span data-axle-over className="font-sans font-semibold text-danger">{t('serverRun.compare.axle.over', { kg: format.weight(item.overKg) })}</span> : null}
              {t('serverRun.compare.axle.usage', { load: format.weight(item.loadKg), limit: format.weight(item.limitKg) })}
            </dd>
          </div>
          <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-line-soft">
            <span className={cn('block h-full rounded-full', item.overKg > 0 ? 'bg-danger' : 'bg-azure-500')} style={{ width: `${item.share * 100}%` }} />
          </span>
        </div>
      ))}
    </dl>
  )
}
