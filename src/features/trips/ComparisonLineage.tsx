import { GitBranch } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { Highlight } from './ComparisonRows'
import type { RevisionCardModel } from './revision-comparison'

/** Ghi chú kế thừa (V2): bản duyệt nào dựng từ bản nào; nói "cùng chỉ số" chỉ khi bốn chỉ số chất xếp thật sự bằng nhau. */
export function ComparisonLineage({ cards }: { cards: readonly RevisionCardModel[] }) {
  const t = useT()
  const pairs = cards.flatMap((card) => {
    const source = cards.find((item) => item.id === card.sourceRevisionId)
    return source ? [{ approved: card, source }] : []
  })
  if (pairs.length === 0) return null
  return (
    <div className="flex items-start gap-3 border-t border-border px-5 py-3.5">
      <GitBranch aria-hidden className="mt-0.5 size-4 flex-none text-ink-3" strokeWidth={1.5} />
      <div className="flex min-w-0 flex-col gap-0.5 text-small leading-5 text-ink-2">
        <span className="font-semibold text-ink-strong">{t('trips.compare.lineageTitle')}</span>
        {pairs.map(({ approved, source }) => {
          const same = approved.volumeUtilizationPercent === source.volumeUtilizationPercent
            && approved.payloadUtilizationPercent === source.payloadUtilizationPercent
            && approved.placedCount === source.placedCount
            && approved.unplacedCount === source.unplacedCount
          const sentence = t('trips.compare.lineage', { approved: approved.id, source: source.id })
          return (
            <p key={approved.id}>
              <Highlight text={sentence} parts={[approved.id, source.id]} className="font-mono text-caption" />
              {same ? ` ${t('trips.compare.lineageSame')}` : ''}
            </p>
          )
        })}
      </div>
    </div>
  )
}
