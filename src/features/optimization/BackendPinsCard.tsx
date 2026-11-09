import { Pin } from 'lucide-react'
import { useId } from 'react'
import { Card } from '@/components/ui/Card'
import { Switch } from '@/components/ui/Switch'
import { useT } from '@/lib/i18n'

/**
 * "Giữ kiện đã ghim" của Thiết lập tối ưu bản máy chủ, khi màn mở từ "Chạy lại giữ ghim" của Planner (`?giu-ghim=<mã phương án>`):
 * công tắc bật sẵn kèm câu nói nó làm gì — vẫn một lần chạy, một credit, ba phương án; máy chủ kiểm bộ ghim trước khi chạy. Phương án
 * không còn kiện ghim nào thì chỉ một câu, lần chạy là bình thường.
 */
export function BackendPinsCard({ count, keep, onKeepChange }: { count: number; keep: boolean; onKeepChange: (keep: boolean) => void }) {
  const t = useT()
  const hintId = useId()
  const hint = count === 0 ? t('serverPlans.setup.pins.none') : keep ? t('serverPlans.setup.pins.on', { count }) : t('serverPlans.setup.pins.off')
  return (
    <Card className="flex flex-col gap-2 px-7 py-4.5 max-sm:px-4">
      <h2 className="flex items-center gap-2 font-display text-h3 font-[650] text-ink-strong">
        <Pin className="size-4 text-primary" strokeWidth={1.5} aria-hidden />{t('serverPlans.setup.pins.title')}
      </h2>
      {count > 0 ? (
        <Switch label={t('serverPlans.setup.pins.switch', { count })} checked={keep} aria-describedby={hintId} onCheckedChange={onKeepChange} />
      ) : null}
      <p id={hintId} className="text-small text-ink-2">{hint}</p>
    </Card>
  )
}
