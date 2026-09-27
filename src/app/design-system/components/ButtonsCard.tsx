import { Box, Check, Ellipsis, Play, Plus, RotateCw, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { Preview, SheetCard, SkyStage } from '../SheetLayout'

/**
 * Năm kiểu `Button` (chính, phụ, ghost, nguy hiểm, kính) ở ba cỡ và trạng thái vô hiệu hoá, với nhãn thật của các màn. Bản xem trước
 * `inert`: nút không nối vào việc gì nên không để bấm (AGENTS mục 6 "Nút chưa hoạt động").
 */
export function ButtonsCard() {
  const t = useT()
  const title = t('designSystem.components.buttons.title')
  return (
    <SheetCard title={title} meta={t('designSystem.components.buttons.meta')}>
      <Preview label={title} className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button><Plus strokeWidth={2.2} aria-hidden />{t('trips.list.create')}</Button>
          <Button variant="secondary">{t('trips.create.submitEdit')}</Button>
          <Button variant="ghost">{t('trips.create.cancel')}</Button>
          <Button variant="danger">{t('trips.detail.cancel')}</Button>
          {/* Nút nguy hiểm nhẹ (V2.3 .btn-danger-soft): Button chưa có biến thể này, dựng từ nút phụ + chữ đỏ */}
          <Button variant="secondary" className="border-red-200 text-danger hover:bg-red-50">
            <Trash2 strokeWidth={1.75} aria-hidden />{t('trips.form.delete')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button size="lg"><Check strokeWidth={2.2} aria-hidden />{t('viewer.plan.approve')}</Button>
          <Button variant="secondary" size="sm">{t('designSystem.components.buttons.small')}</Button>
          <Button variant="secondary" size="icon" aria-label={t('designSystem.components.buttons.more')}><Ellipsis strokeWidth={1.75} aria-hidden /></Button>
          <Button disabled><Play strokeWidth={1.75} aria-hidden />{t('optimization.run')}</Button>
        </div>
        <p className="m-0 text-fine text-ink-3">{t('designSystem.components.buttons.disabledNote')}</p>
        <SkyStage className="flex flex-wrap items-center gap-2.5 px-3.5 py-3.5">
          <Button><Box strokeWidth={2} aria-hidden />{t('trips.detail.openPlan')}</Button>
          <Button variant="glass"><RotateCw strokeWidth={1.75} aria-hidden />{t('trips.detail.runOptimization')}</Button>
          <Button variant="glass" size="icon" aria-label={t('designSystem.components.buttons.more')}><Ellipsis strokeWidth={1.75} aria-hidden /></Button>
        </SkyStage>
      </Preview>
    </SheetCard>
  )
}
