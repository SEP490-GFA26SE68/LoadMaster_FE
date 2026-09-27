import { CircleCheck } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Checkbox } from '@/components/ui/Checkbox'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PlanThumbnail } from './PlanThumbnail'
import type { ComparedMetric, RevisionCardModel, bestValues } from './revision-comparison'

type Row = { key: string; label: string; value: (card: RevisionCardModel) => string; compare?: ComparedMetric; mono?: boolean }

/** Dòng của ma trận theo hai nhóm, đúng những gì revision đã lưu có (LM-051): số từ `result.metrics`, thiết lập từ `request.settings`. */
function matrixGroups(t: TFunction, format: Formatter): { title: string; rows: Row[] }[] {
  const onOff = (value: boolean) => (value ? t('trips.compare.on') : t('trips.compare.off'))
  const packages = (value: number) => t('trips.compare.packages', { value: format.integer(value) })
  return [
    {
      title: t('trips.compare.results'),
      rows: [
        { key: 'volume', label: t('trips.compare.volume'), value: (card) => format.percent(card.volumeUtilizationPercent), compare: 'volumeUtilizationPercent', mono: true },
        { key: 'payload', label: t('trips.compare.payload'), value: (card) => format.percent(card.payloadUtilizationPercent), mono: true },
        { key: 'placed', label: t('trips.compare.placed'), value: (card) => packages(card.placedCount), compare: 'placedCount', mono: true },
        { key: 'unplaced', label: t('trips.compare.unplaced'), value: (card) => packages(card.unplacedCount), compare: 'unplacedCount', mono: true },
        // Thời gian chạy đo thật (`runtimeMs` của kết quả) — không ghi "không đo" như bản V2
        { key: 'runtime', label: t('trips.compare.runtime'), value: (card) => t('trips.compare.milliseconds', { value: format.integer(card.runtimeMs) }), compare: 'runtimeMs', mono: true },
      ],
    },
    {
      title: t('trips.compare.settings'),
      rows: [
        { key: 'method', label: t('trips.compare.method'), value: (card) => t(`optimization.methods.${card.method}`) },
        { key: 'seed', label: t('trips.compare.randomSeed'), value: (card) => (card.randomSeed === undefined ? t('trips.compare.noSeed') : String(card.randomSeed)), mono: true },
        { key: 'lifo', label: t('trips.compare.enforceLifo'), value: (card) => onOff(card.enforceLifo) },
        { key: 'cog', label: t('trips.compare.lowCenterOfGravity'), value: (card) => onOff(card.prioritizeLowCenterOfGravity) },
        { key: 'time', label: t('trips.compare.timeLimit'), value: (card) => t('trips.compare.seconds', { value: format.integer(card.timeLimitSeconds) }), mono: true },
        { key: 'job', label: t('trips.compare.jobLabel'), value: (card) => card.jobId, mono: true },
      ],
    },
  ]
}

/**
 * Ma trận so sánh phương án (V2, LM-051): dòng là chỉ số, cột là bản lưu. Đầu cột có nút radio chọn bản sẽ mở trong 3D, nhãn
 * MOCK RESULT và trạng thái của từng bản. Ô tốt nhất tô nền nhạt kèm dấu tích; chỉ số mà mọi bản bằng nhau không đánh dấu. "Chỉ hiện
 * khác biệt" ẩn dòng mà mọi bản cùng giá trị. Giá trị căn trái thẳng mã bản ở đầu cột — đọc theo cột, không đọc theo dòng như bảng
 * số. Nhiều bản thì khung cuộn ngang, cột chỉ số đứng yên.
 */
export function ComparisonMatrix({ cards, best, selectedId, onSelect }: {
  cards: readonly RevisionCardModel[]
  best: ReturnType<typeof bestValues>
  selectedId: string | undefined
  onSelect: (id: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const differs = (row: Row) => new Set(cards.map(row.value)).size > 1
  const groups = matrixGroups(t, format)
    .map((group) => ({ ...group, rows: onlyDifferences ? group.rows.filter(differs) : group.rows }))
    .filter((group) => group.rows.length > 0)
  const columnCount = cards.length + 1

  return (
    // flex-none: con overflow-hidden của cột flex bị co về 0 (AGENTS mục 5)
    <section aria-labelledby={titleId} className="relative flex flex-none flex-col overflow-hidden rounded-lg border border-border bg-bg">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id={titleId} className="text-h3 font-semibold text-ink-strong">{t('trips.compare.matrixTitle')}</h2>
          <p className="text-caption text-ink-2">{t('trips.compare.matrixHint')}</p>
        </div>
        <Checkbox label={t('trips.compare.onlyDifferences')} checked={onlyDifferences} onCheckedChange={(checked) => setOnlyDifferences(checked === true)} />
      </div>

      {/* Ô giá trị lùi 38 px (radio 16 + khoảng 10 + lề 12) để thẳng mã bản ở đầu cột */}
      <div className="relative overflow-x-auto border-t border-border">
        <table className="w-full table-fixed border-collapse" style={{ minWidth: 208 + cards.length * 248 }}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-52 bg-table-head px-4 text-left align-bottom text-caption font-semibold text-ink-2">
                {t('trips.compare.metric')}
              </th>
              {cards.map((card) => (
                <th key={card.id} scope="col" className={cn('px-3 py-3 text-left align-top font-normal', card.id === selectedId ? 'bg-primary-bg' : 'bg-table-head')}>
                  <RevisionHeader card={card} selected={card.id === selectedId} onSelect={onSelect} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {onlyDifferences ? null : (
              <tr className="border-t border-border">
                <th scope="row" className="sticky left-0 z-10 bg-bg px-4 text-left text-body font-normal text-ink-2">{t('trips.compare.preview')}</th>
                {cards.map((card) => (
                  <td key={card.id} className="py-2 pr-3 pl-9.5">
                    <div className="max-w-72 overflow-hidden rounded-md">
                      <PlanThumbnail revisionId={card.id} request={card.revision.request} placements={card.revision.result.placements}
                        totalCount={card.placedCount + card.unplacedCount} />
                    </div>
                  </td>
                ))}
              </tr>
            )}
            {groups.map((group) => [
              <tr key={group.title} className="border-t border-border bg-surface">
                <th scope="colgroup" colSpan={columnCount} className="sticky left-0 px-4 py-1.5 text-left text-caption font-semibold text-ink-2">{group.title}</th>
              </tr>,
              ...group.rows.map((row) => (
                <tr key={row.key} className="h-11 border-t border-border">
                  <th scope="row" className="sticky left-0 z-10 bg-bg px-4 text-left text-body font-normal text-ink-2">{row.label}</th>
                  {cards.map((card) => {
                    const isBest = row.compare !== undefined && best[row.compare] === card[row.compare]
                    return (
                      <td key={card.id} className={cn('pr-3 pl-9.5 text-left text-body text-ink-1', row.mono && 'font-mono tabular-nums', isBest && 'bg-primary-bg')}>
                        <span className="inline-flex items-center gap-1.5">
                          {row.value(card)}
                          {isBest ? <CircleCheck className="size-3.5 flex-none text-primary" strokeWidth={1.5} aria-label={t('trips.compare.best')} /> : null}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )),
            ])}
          </tbody>
        </table>
        {onlyDifferences && groups.length === 0 ? <p className="px-5 py-4 text-body text-ink-2">{t('trips.compare.noDifferences')}</p> : null}
      </div>

      <Lineage cards={cards} />
    </section>
  )
}

/** Đầu cột một bản lưu: radio chọn (tên truy cập là mã bản), nhãn nguồn và trạng thái, dòng thời điểm / quan hệ duyệt. */
function RevisionHeader({ card, selected, onSelect }: { card: RevisionCardModel; selected: boolean; onSelect: (id: string) => void }) {
  const t = useT()
  const format = useFormat()
  const note = card.sourceRevisionId
    ? t('trips.compare.approvedFrom', { id: card.sourceRevisionId })
    : card.approvedAs.length > 0
      ? t('trips.compare.approvedAs', { ids: card.approvedAs.join(', ') })
      : t('trips.compare.createdAt', { time: format.time(card.createdAt), date: format.date(card.createdAt) })
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="radio" name="compare-revision" aria-label={card.id} checked={selected} onChange={() => onSelect(card.id)}
        className="mt-1 size-4 flex-none accent-primary" />
      <span className="flex min-w-0 flex-col gap-1.5">
        <span className="font-mono text-h3 font-semibold text-ink-strong">{card.id}</span>
        <span className="flex flex-wrap gap-1.5">
          {card.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          {card.latest ? <Badge tone="info">{t('trips.compare.status.latest')}</Badge> : null}
          {card.approved ? <Badge tone="success">{t('trips.compare.status.approved')}</Badge> : null}
          {card.stale ? <Badge tone="danger">{t('trips.compare.status.stale')}</Badge> : null}
        </span>
        <span className="text-caption text-ink-2">{note}</span>
      </span>
    </label>
  )
}

/** Ghi chú kế thừa (V2): bản duyệt nào dựng từ bản nào; nói "cùng chỉ số" chỉ khi bốn chỉ số chất xếp thật sự bằng nhau. */
function Lineage({ cards }: { cards: readonly RevisionCardModel[] }) {
  const t = useT()
  const pairs = cards.flatMap((card) => {
    const source = cards.find((item) => item.id === card.sourceRevisionId)
    return source ? [{ approved: card, source }] : []
  })
  if (pairs.length === 0) return null
  return (
    <div className="flex flex-col gap-1 border-t border-border px-5 py-3">
      <span className="text-body font-medium text-ink-1">{t('trips.compare.lineageTitle')}</span>
      {pairs.map(({ approved, source }) => {
        const same = approved.volumeUtilizationPercent === source.volumeUtilizationPercent
          && approved.payloadUtilizationPercent === source.payloadUtilizationPercent
          && approved.placedCount === source.placedCount
          && approved.unplacedCount === source.unplacedCount
        return (
          <p key={approved.id} className="text-caption text-ink-2">
            {t('trips.compare.lineage', { approved: approved.id, source: source.id })}{same ? ` ${t('trips.compare.lineageSame')}` : ''}
          </p>
        )
      })}
    </div>
  )
}
