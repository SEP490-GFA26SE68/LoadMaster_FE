import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import type { RevisionCardModel } from './revision-comparison'

/**
 * Nhãn của một bản lưu (V2.3 `SoSanhPhuongAn.jpg`): MOCK RESULT, trạng thái (đã duyệt xanh lá, mới nhất cyan, lỗi thời hổ phách) rồi
 * quan hệ duyệt xám ("Duyệt từ REV-001", "Đã duyệt thành REV-002"). Dùng ở đầu cột ma trận và thẻ "Phương án đã lưu".
 */
export function RevisionTags({ card }: { card: RevisionCardModel }) {
  const t = useT()
  return (
    <span className="flex flex-wrap gap-1.5">
      {card.isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
      {card.approved ? <Badge shape="tag" tone="success">{t('trips.compare.status.approved')}</Badge> : null}
      {card.latest ? <Badge shape="tag" tone="cyan">{t('trips.compare.status.latest')}</Badge> : null}
      {card.stale ? <Badge shape="tag" tone="warning" outlined>{t('trips.compare.status.stale')}</Badge> : null}
      {card.sourceRevisionId ? <Badge shape="tag">{t('trips.compare.approvedFrom', { id: card.sourceRevisionId })}</Badge> : null}
      {card.approvedAs.length > 0 ? <Badge shape="tag">{t('trips.compare.approvedAs', { ids: card.approvedAs.join(', ') })}</Badge> : null}
    </span>
  )
}

/** "Tạo lúc 09:00 24/09/2026" — giờ tạo revision trong kho. */
export function RevisionCreatedAt({ card, className }: { card: RevisionCardModel; className?: string }) {
  const t = useT()
  const format = useFormat()
  return <span className={className}>{t('trips.compare.createdAt', { time: format.time(card.createdAt), date: format.date(card.createdAt) })}</span>
}

/**
 * Đầu cột một bản lưu: nút radio chọn bản sẽ mở trong 3D (tên truy cập là mã bản), nhãn, dòng thời điểm tạo. Nhãn và thời điểm lùi
 * 28 px (radio 18 + khoảng 10) để thẳng mã bản; giá trị trong ô lùi cùng mức.
 */
export function ComparisonColumnHeader({ card, selected, onSelect }: { card: RevisionCardModel; selected: boolean; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col">
      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="radio"
          name="compare-revision"
          aria-label={card.id}
          checked={selected}
          onChange={() => onSelect(card.id)}
          className="size-4.5 flex-none cursor-pointer appearance-none rounded-full border-[1.5px] border-n-500 bg-bg transition-[border] duration-(--dur-fast) checked:border-[5.5px] checked:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        />
        <span className="font-mono text-h3 leading-5 font-semibold text-ink-strong">{card.id}</span>
      </label>
      <span className="mt-2.5 ml-7"><RevisionTags card={card} /></span>
      <RevisionCreatedAt card={card} className="mt-2 ml-7 text-fine text-ink-3" />
    </div>
  )
}
