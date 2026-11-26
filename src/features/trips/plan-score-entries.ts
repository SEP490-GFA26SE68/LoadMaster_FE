import type { HowEntry } from '@/components/HowComputed'
import { SCORE_PROFILES, type PlanScore, type ScoreComponent, type ScoreTerm } from '@/features/optimization/load-plans-backend-api'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'

/**
 * Câu của "Tính thế nào?" dưới điểm J của một phương án máy chủ (màn So sánh theo lần chạy): công thức, hai khoản cộng U_vol × w_vol và
 * U_n × w_n (phần cộng = 100 × w × U, theo công thức), rồi từng khoản trừ Sₖ với phần trừ máy chủ trả. Khoản máy chủ không tính ghi
 * "Không tính" kèm lý do theo mã. Tên hồ sơ, tên khoản dịch theo mã. Thuần.
 */

/** Tên hồ sơ ưu tiên theo mã; mã lạ hiện nguyên mã. */
export function scoreProfileName(profile: string, t: TFunction): string {
  const known = SCORE_PROFILES.find((item) => item === profile)
  return known === undefined ? profile : t(`serverPlans.score.profiles.${known}`)
}

/** Lý do một khoản không tính: S3 thiếu dữ liệu trục của xe, S7 và S8 dịch vụ tối ưu chưa tính. */
const NOT_COMPUTED: Partial<Record<ScoreComponent['code'], 'axle' | 'pending'>> = { S3: 'axle', S7: 'pending', S8: 'pending' }

function termEntry(key: 'volume' | 'count', term: ScoreTerm | null, t: TFunction, format: Formatter): HowEntry[] {
  if (term === null) return []
  return [{
    key,
    label: t(`serverPlans.score.${key}.label`),
    text: t(`serverPlans.score.${key}.text`, {
      ratio: format.percent(term.ratio * 100),
      weight: format.ratio(term.weight),
      points: format.decimal(100 * term.weight * term.ratio),
    }),
  }]
}

function componentEntry(component: ScoreComponent, t: TFunction, format: Formatter): HowEntry {
  const label = t('serverPlans.score.component', { code: component.code, name: t(`serverPlans.score.components.${component.code}`) })
  const text = component.computed
    ? t('serverPlans.score.penalty', {
      value: format.percent(component.value * 100),
      weight: format.ratio(component.weight),
      points: format.decimal(Math.abs(component.contribution)),
    })
    : t(`serverPlans.score.notComputed.${NOT_COMPUTED[component.code] ?? 'other'}`)
  return { key: component.code, label, text }
}

export function planScoreEntries(score: PlanScore, t: TFunction, format: Formatter): HowEntry[] {
  return [
    { key: 'formula', label: t('serverPlans.score.formula.label'), text: t('serverPlans.score.formula.text') },
    ...termEntry('volume', score.volume, t, format),
    ...termEntry('count', score.count, t, format),
    ...score.components.map((component) => componentEntry(component, t, format)),
  ]
}
