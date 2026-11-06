import { Pin, RotateCw } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { GLASS_PANEL, GlassChip, MUTED } from '../panels/scene-ui'

/**
 * Kiện đã ghim ở hàng dưới phải khung 3D của Planner (FE-BL-02), bên trái "Đổi xe" / "Chi tiết": nhãn "N kiện đã ghim" (biểu tượng ghim
 * kèm chữ) và nút phụ "Chạy lại giữ ghim" — tối ưu lại với các kiện đó giữ nguyên chỗ. Hàng này nằm dưới cột nổi bên phải của
 * Planner (đặt chồng lên trên thì cột che mất nút) và thanh trên không thêm gì (đã đo ở 1.366 px). Không có kiện ghim thì không vẽ gì.
 * Ghim chưa lưu (draft chưa Duyệt) thì nút mờ kèm lý do ngay cạnh: lần chạy lại đọc ghim từ phương án đã lưu. Nơi gọi chặn vì luật khác
 * (Planner bản máy chủ: chuyến chưa Đã lập kế hoạch) truyền `blockedReason`: nút mờ, câu đó đứng cạnh.
 */
export function PinnedRerun({ count, unsaved, blockedReason, onRerun }: { count: number; unsaved: boolean; blockedReason?: string; onRerun: () => void }) {
  const t = useT()
  const reasonId = useId()
  if (count === 0) return null
  const reason = blockedReason ?? (unsaved ? t('viewer.pins.unsaved') : undefined)
  return (
    <div className="pointer-events-auto flex min-w-0 items-end gap-2">
      <p id={reasonId} className={cn('max-w-72 text-caption', reason !== undefined ? ['p-2', GLASS_PANEL] : 'sr-only', MUTED)}>
        {reason ?? t('viewer.pins.rerunHint')}
      </p>
      <GlassChip tone="cyan" size="pill" className="self-center"><Pin strokeWidth={1.5} aria-hidden />{t('viewer.pins.count', { count })}</GlassChip>
      <Button variant="glass" className="hidden size-14 shrink-0 p-0 glass-dark md:flex xl:h-10 xl:w-auto xl:px-3.5" disabled={reason !== undefined}
        aria-label={t('viewer.pins.rerun')} aria-describedby={reasonId} onClick={onRerun}>
        <RotateCw strokeWidth={1.5} /><span className="hidden xl:inline">{t('viewer.pins.rerun')}</span>
      </Button>
    </div>
  )
}
