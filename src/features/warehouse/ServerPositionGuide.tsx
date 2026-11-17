import { useLocale, useT } from '@/lib/i18n'
import { positionGuide, type GuideFace } from './warehouse-position-guide'
import type { ServerCargoBox, ServerPlacement } from './warehouse-dto'

const FACES: readonly GuideFace[] = ['front', 'rear', 'left', 'right', 'floor', 'roof']

export function ServerPositionGuide({ box, placement }: { box: ServerCargoBox | null; placement: ServerPlacement }) {
  const t = useT()
  const { locale } = useLocale()
  // Guide measurements must not disappear into the app-wide one-decimal display rounding.
  const numbers = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumSignificantDigits: 15 })
  const result = positionGuide(box, placement)
  const cm = (n: number) => Number.isFinite(n) ? numbers.format(n) : t('serverWarehouse.unknown')
  return <section aria-label={t('serverWarehouse.guide.positionTitle')} className="flex flex-col gap-3 rounded-lg border border-border bg-bg p-4">
    <h2 className="m-0 text-h3 font-semibold">{t('serverWarehouse.guide.positionTitle')}</h2>
    <p className="m-0 text-ink-2">{t('serverWarehouse.guide.origin')}</p>
    <dl className="m-0 grid grid-cols-2 gap-3">
      <Fact label={t('serverWarehouse.guide.packageCode')} value={placement.packageCode ?? t('serverWarehouse.unknown')} />
      <Fact label={t('serverWarehouse.guide.sequence')} value={String(placement.sequence)} />
      <Fact label={t('serverWarehouse.session.stop')} value={placement.stopSequence === null ? t('serverWarehouse.unknown') : [placement.stopSequence, placement.stopName].filter(Boolean).join(' · ')} />
      <Fact label={t('serverWarehouse.session.position')} value={t('serverWarehouse.session.positionValue', { x: cm(placement.x), y: cm(placement.y), z: cm(placement.z) })} />
      <Fact label={t('serverWarehouse.session.size')} value={t('serverWarehouse.session.sizeValue', { length: cm(placement.lengthCm), width: cm(placement.widthCm), height: cm(placement.heightCm) })} />
    </dl>
    {result.issue !== null ? <p role="alert" className="m-0 font-medium text-badge-warning-fg">{t(`serverWarehouse.guide.geometry.${result.issue}`)}</p> : null}
    {result.distances === null ? null : <dl className="m-0 grid grid-cols-2 gap-3 border-t border-border pt-3">
      {FACES.map((face) => <Fact key={face} label={t(`serverWarehouse.guide.faces.${face}`)} value={cm(result.distances![face]) + ' cm'} />)}
    </dl>}
    <h3 className="m-0 text-body-lg font-semibold">{t('serverWarehouse.guide.orientation')}</h3>
    {result.axes === null ? <p role="alert" className="m-0 font-medium text-badge-warning-fg">{t('serverWarehouse.guide.rotationUnknown')}</p> :
      <ul className="m-0 list-disc pl-5">
        {result.axes.map((edge, i) => <li key={i}>{t('serverWarehouse.guide.edgeAlongAxis', {
          edge: t(`serverWarehouse.guide.edges.${edge}`),
          axis: t(`serverWarehouse.guide.axes.${(['X', 'Y', 'Z'] as const)[i]!}`),
        })}</li>)}
      </ul>}
    <p className="m-0 text-ink-2">{t('serverWarehouse.guide.noLabelGuess')}</p>
  </section>
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><dt className="text-ink-3">{label}</dt><dd className="m-0 break-words font-mono font-medium tabular-nums text-ink-strong">{value}</dd></div>
}
