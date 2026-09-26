import { useT } from '@/lib/i18n'
import { SheetLayout } from './SheetLayout'
import { ComponentsCard } from './style/ComponentsCard'
import { ContrastCard } from './style/ContrastCard'
import { LifecycleCard } from './style/LifecycleCard'
import { SwatchScaleCard, type SwatchStep } from './style/SwatchScaleCard'
import { TypeCard } from './style/TypeCard'
import { useSheetSampleQuery } from './useSheetSampleQuery'

const CYAN_STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const
const NEUTRAL_STEPS = ['0', '25', '50', '100', '200', '300', '400', '500', '600', '700', '800', '900'] as const

/** Bậc được ghi chú: nghĩa của nó trong app (`src/index.css`). */
const CYAN_NOTES: Partial<Record<(typeof CYAN_STEPS)[number], 'primaryFill' | 'link' | 'sky'>> = { '400': 'primaryFill', '700': 'link', '950': 'sky' }
const NEUTRAL_NOTES: Partial<Record<(typeof NEUTRAL_STEPS)[number], 'app' | 'border' | 'secondary' | 'text'>> = {
  '50': 'app', '200': 'border', '600': 'secondary', '900': 'text',
}

/**
 * Bảng kiểu dáng V2.3 "Cyan kính" (`design/v2.3/screens/web/Main.jpg`) — tài liệu sống dựng từ token và thành phần thật. Route:
 * `/kieu-dang`, công khai.
 */
export function StyleSheetPage() {
  const t = useT()
  const sample = useSheetSampleQuery().data

  const cyan: SwatchStep[] = CYAN_STEPS.map((step) => {
    const note = CYAN_NOTES[step]
    return { label: step, token: `--cyan-${step}`, note: note && t(`designSystem.style.cyan.notes.${note}`) }
  })
  const neutral: SwatchStep[] = NEUTRAL_STEPS.map((step) => {
    const note = NEUTRAL_NOTES[step]
    return { label: step, token: `--n-${step}`, note: note && t(`designSystem.style.neutral.notes.${note}`) }
  })

  return (
    <SheetLayout
      path="/kieu-dang"
      title={t('designSystem.style.title')}
      lede={t('designSystem.style.lede')}
      aside={<GlassRules />}
    >
      <div className="grid grid-cols-12 items-start gap-4">
        <SwatchScaleCard title={t('designSystem.style.cyan.title')} meta={t('designSystem.style.cyan.meta')} steps={cyan} />
        <SwatchScaleCard title={t('designSystem.style.neutral.title')} meta={t('designSystem.style.neutral.meta')} steps={neutral} />
        <LifecycleCard />
        <ContrastCard />
        <TypeCard sample={sample} />
        <ComponentsCard />
      </div>
    </SheetLayout>
  )
}

/** Hai thẻ trên dải trời: kính ở đâu, không kính ở đâu (AGENTS mục 5 "Cấm tuyệt đối"). Thẻ "có kính" chính là một mặt kính. */
function GlassRules() {
  const t = useT()
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <section className="rounded-lg border border-cyan-300/35 bg-cyan-400/15 px-4 py-3.5 text-body text-sky-text-3 backdrop-blur-lg">
        <h2 className="mb-1.5 font-display text-body leading-tight font-[650] text-sky-text font-stretch-106%">{t('designSystem.style.glass.yesTitle')}</h2>
        <p className="m-0">{t('designSystem.style.glass.yes')}</p>
      </section>
      <section className="rounded-lg border border-sky-glass-border bg-sky-glass px-4 py-3.5 text-body text-sky-text-3">
        <h2 className="mb-1.5 font-display text-body leading-tight font-[650] text-sky-text font-stretch-106%">{t('designSystem.style.glass.noTitle')}</h2>
        <p className="m-0">{t('designSystem.style.glass.no')}</p>
      </section>
    </div>
  )
}
