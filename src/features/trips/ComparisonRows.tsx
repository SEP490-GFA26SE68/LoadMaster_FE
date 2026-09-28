import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ComparedMetric, RevisionCardModel } from './revision-comparison'

/**
 * Kiểu hiển thị của một giá trị: `number` cả chuỗi là số đo (mono), `count` chỉ phần số trong câu là mono ("132 kiện", "30 giây"),
 * `code` là mã (mono nhỏ), `text` là chữ thường (phương pháp, Bật/Tắt).
 */
type RowKind = 'number' | 'count' | 'code' | 'text'

export type ComparisonRow = {
  key: string
  label: string
  /** Chuỗi đầy đủ theo locale — cũng là khoá so "Chỉ hiện khác biệt". */
  value: (card: RevisionCardModel) => string
  /** Phần số trong `value` với kiểu `count`. */
  number?: (card: RevisionCardModel) => string | undefined
  kind: RowKind
  compare?: ComparedMetric
}

export type ComparisonGroup = { key: 'results' | 'settings'; title: string; rows: ComparisonRow[] }

/**
 * Dòng so sánh theo hai nhóm, đúng những gì revision đã lưu có (LM-051): số từ `result.metrics`, thiết lập từ `request.settings`.
 * Ma trận và thẻ "Phương án đã lưu" của trạng thái rỗng đọc cùng danh sách này.
 */
export function comparisonGroups(t: TFunction, format: Formatter): ComparisonGroup[] {
  const onOff = (value: boolean) => (value ? t('trips.compare.on') : t('trips.compare.off'))
  const packages = (value: number) => t('trips.compare.packages', { value: format.integer(value) })
  return [
    {
      key: 'results',
      title: t('trips.compare.results'),
      rows: [
        { key: 'volume', label: t('trips.compare.volume'), value: (card) => format.percent(card.volumeUtilizationPercent), kind: 'number', compare: 'volumeUtilizationPercent' },
        { key: 'payload', label: t('trips.compare.payload'), value: (card) => format.percent(card.payloadUtilizationPercent), kind: 'number' },
        { key: 'placed', label: t('trips.compare.placed'), value: (card) => packages(card.placedCount), number: (card) => format.integer(card.placedCount), kind: 'count', compare: 'placedCount' },
        { key: 'unplaced', label: t('trips.compare.unplaced'), value: (card) => packages(card.unplacedCount), number: (card) => format.integer(card.unplacedCount), kind: 'count', compare: 'unplacedCount' },
        // Thời gian chạy đo thật (`runtimeMs` của kết quả) — không ghi "không đo" như bản V2
        { key: 'runtime', label: t('trips.compare.runtime'), value: (card) => t('trips.compare.milliseconds', { value: format.integer(card.runtimeMs) }), kind: 'number', compare: 'runtimeMs' },
      ],
    },
    {
      key: 'settings',
      title: t('trips.compare.settings'),
      rows: [
        { key: 'method', label: t('trips.compare.method'), value: (card) => t(`optimization.methods.${card.method}`), kind: 'text' },
        {
          key: 'seed',
          label: t('trips.compare.randomSeed'),
          value: (card) => (card.randomSeed === undefined ? t('trips.compare.noSeed') : String(card.randomSeed)),
          number: (card) => (card.randomSeed === undefined ? undefined : String(card.randomSeed)),
          kind: 'count',
        },
        { key: 'lifo', label: t('trips.compare.enforceLifo'), value: (card) => onOff(card.enforceLifo), kind: 'text' },
        { key: 'cog', label: t('trips.compare.lowCenterOfGravity'), value: (card) => onOff(card.prioritizeLowCenterOfGravity), kind: 'text' },
        { key: 'time', label: t('trips.compare.timeLimit'), value: (card) => t('trips.compare.seconds', { value: format.integer(card.timeLimitSeconds) }), number: (card) => format.integer(card.timeLimitSeconds), kind: 'count' },
        { key: 'job', label: t('trips.compare.jobLabel'), value: (card) => card.jobId, kind: 'code' },
      ],
    },
  ]
}

const MONO_NUMBER = 'font-mono tabular-nums'

/** Giá trị một ô: số đo mono (JetBrains Mono, AGENTS mục 4), chữ đi kèm số giữ font giao diện. */
export function ComparisonValue({ row, card, strong = false }: { row: ComparisonRow; card: RevisionCardModel; strong?: boolean }) {
  const text = row.value(card)
  if (row.kind === 'code') return <span className="font-mono text-caption whitespace-nowrap text-ink-2">{text}</span>
  if (row.kind === 'number') return <span className={cn(MONO_NUMBER, strong ? 'font-semibold' : 'font-medium')}>{text}</span>
  if (row.kind === 'count') {
    const number = row.number?.(card)
    return <Highlight text={text} parts={number ? [number] : []} className={cn(MONO_NUMBER, strong ? 'font-semibold' : 'font-medium')} />
  }
  return <span className={strong ? 'font-semibold' : undefined}>{text}</span>
}

/**
 * Chuỗi đã dịch, bọc lần xuất hiện đầu của từng `parts` trong một `<span>` riêng (mã bản, phần số). Câu vẫn nằm trọn trong từ điển;
 * phần không tìm thấy thì để nguyên chữ.
 */
export function Highlight({ text, parts, className }: { text: string; parts: readonly string[]; className: string }) {
  const pieces: { value: string; marked: boolean }[] = [{ value: text, marked: false }]
  for (const part of parts) {
    const index = pieces.findIndex((piece) => !piece.marked && piece.value.includes(part))
    const piece = pieces[index]
    if (!piece || part === '') continue
    const at = piece.value.indexOf(part)
    pieces.splice(index, 1, ...[
      { value: piece.value.slice(0, at), marked: false },
      { value: part, marked: true },
      { value: piece.value.slice(at + part.length), marked: false },
    ].filter((item) => item.value !== ''))
  }
  return (
    <span>
      {pieces.map((piece, index) => (piece.marked ? <span key={index} className={className}>{piece.value}</span> : piece.value))}
    </span>
  )
}
