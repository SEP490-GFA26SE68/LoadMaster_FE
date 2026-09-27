import { CircleCheck } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Card, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { ComparisonColumnHeader } from './ComparisonColumnHeader'
import { ComparisonLineage } from './ComparisonLineage'
import { comparisonGroups, ComparisonValue, type ComparisonRow } from './ComparisonRows'
import { PlanThumbnail } from './PlanThumbnail'
import type { RevisionCardModel, bestValues } from './revision-comparison'

/** Nền cột đang chọn: đầu cột cyan-50 có vạch trên, thân cột nhạt hơn để chữ vẫn đọc trên nền gần trắng. */
const SELECTED_HEAD = 'bg-cyan-50 shadow-[inset_0_3px_0_var(--cyan-500)]'
const SELECTED_CELL = 'bg-cyan-50/55'

/**
 * Ma trận so sánh phương án (V2.3 `SoSanhPhuongAn.jpg`, LM-051, LM-106): dòng là chỉ số, cột là bản lưu, trong một Card đè dải trời.
 * Đầu cột có nút radio chọn bản sẽ mở trong 3D; cả cột đang chọn tô cyan nhạt. Giá trị tốt nhất đậm kèm dấu tích xanh lá (chú giải ở
 * đầu thẻ); chỉ số mà mọi bản bằng nhau không đánh dấu. "Chỉ hiện khác biệt" ẩn dòng mà mọi bản cùng giá trị. Giá trị căn trái thẳng
 * mã bản — đọc theo cột, không đọc theo dòng như bảng số. Nhiều bản thì khung cuộn ngang, cột chỉ số đứng yên. `footer` là thanh hành
 * động dính đáy vùng cuộn, nên thẻ không `overflow-hidden` (sticky cần tổ tiên cuộn là vùng cuộn của màn).
 */
export function ComparisonMatrix({ cards, best, selectedId, onSelect, footer }: {
  cards: readonly RevisionCardModel[]
  best: ReturnType<typeof bestValues>
  selectedId: string | undefined
  onSelect: (id: string) => void
  footer: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const differs = (row: ComparisonRow) => new Set(cards.map(row.value)).size > 1
  const groups = comparisonGroups(t, format)
    .map((group) => ({ ...group, rows: onlyDifferences ? group.rows.filter(differs) : group.rows }))
    .filter((group) => group.rows.length > 0)
  const cellTone = (card: RevisionCardModel) => (card.id === selectedId ? SELECTED_CELL : undefined)

  return (
    // flex-none: con của cột flex bị co về 0 (AGENTS mục 5)
    <Card role="region" aria-labelledby={titleId} className="relative flex flex-none flex-col">
      <div className="flex flex-wrap items-start gap-4 border-b border-border px-5 pt-4 pb-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle as="h2" id={titleId}>{t('trips.compare.matrixTitle')}</CardTitle>
          <p className="text-small text-ink-3">{t('trips.compare.matrixHint')}</p>
        </div>
        <div className="ml-auto flex items-center gap-4.5 pt-0.5">
          <span className="inline-flex items-center gap-1.5 text-small text-ink-3">
            <CircleCheck aria-hidden className="size-4 text-green-700" strokeWidth={1.5} />
            {t('trips.compare.best')}
          </span>
          <Checkbox label={t('trips.compare.onlyDifferences')} checked={onlyDifferences} onCheckedChange={(checked) => setOnlyDifferences(checked === true)} />
        </div>
      </div>

      {/* Ô giá trị lùi 44 px (lề 16 + radio 18 + khoảng 10) để thẳng mã bản ở đầu cột */}
      <div className="relative overflow-x-auto">
        <table className="w-full table-fixed border-collapse" style={{ minWidth: 212 + cards.length * 248 }}>
          <colgroup>
            <col className="w-53" />
            {cards.map((card) => <col key={card.id} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-surface px-4 pb-3.5 pl-5 text-left align-bottom text-caption font-semibold text-ink-3">
                {t('trips.compare.metric')}
              </th>
              {cards.map((card) => (
                <th key={card.id} scope="col" className={cn('px-4 py-3.5 text-left align-top font-normal', card.id === selectedId ? SELECTED_HEAD : 'bg-surface')}>
                  <ComparisonColumnHeader card={card} selected={card.id === selectedId} onSelect={onSelect} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {onlyDifferences ? null : (
              <tr className="border-t border-border">
                <th scope="row" className="sticky left-0 z-10 bg-bg px-4 pt-4 pl-5 text-left align-top text-body font-normal text-ink-2">{t('trips.compare.preview')}</th>
                {cards.map((card) => (
                  <td key={card.id} className={cn('py-3.5 pr-4 pl-11', cellTone(card))}>
                    <div className={cn('overflow-hidden rounded-md', card.id === selectedId && 'ring-2 ring-cyan-500')}>
                      <PlanThumbnail revisionId={card.id} request={card.revision.request} placements={card.revision.result.placements}
                        totalCount={card.placedCount + card.unplacedCount} />
                    </div>
                  </td>
                ))}
              </tr>
            )}
            {groups.map((group) => [
              <tr key={group.key} className="h-8.5 border-t border-border bg-surface">
                <th scope="rowgroup" className="sticky left-0 z-10 bg-surface px-4 pl-5 text-left text-fine font-semibold text-ink-2">{group.title}</th>
                {cards.map((card) => <td key={card.id} className={cellTone(card)} />)}
              </tr>,
              ...group.rows.map((row) => (
                <tr key={row.key} className="h-11.5 border-t border-line-soft">
                  <th scope="row" className="sticky left-0 z-10 bg-bg px-4 pl-5 text-left text-body font-normal text-ink-2">{row.label}</th>
                  {cards.map((card) => {
                    const isBest = row.compare !== undefined && best[row.compare] === card[row.compare]
                    return (
                      <td key={card.id} className={cn('pr-4 pl-11 text-left text-body text-ink-strong', cellTone(card))}>
                        <span className="inline-flex items-center gap-1.75">
                          <ComparisonValue row={row} card={card} strong={isBest} />
                          {isBest ? <CircleCheck className="size-4 flex-none text-green-700" strokeWidth={1.5} aria-label={t('trips.compare.best')} /> : null}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
        {onlyDifferences && groups.length === 0 ? <p className="border-t border-line-soft px-5 py-4 text-body text-ink-2">{t('trips.compare.noDifferences')}</p> : null}
      </div>

      <ComparisonLineage cards={cards} />
      {footer}
    </Card>
  )
}
