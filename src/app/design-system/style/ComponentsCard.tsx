import { Box, Check, ChevronDown, Plus, RotateCw, Search } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useT } from '@/lib/i18n'
import { FilterChip, GlassNavSample } from '../samples'
import { Preview, SheetCard, SkyStage } from '../SheetLayout'

/**
 * Tóm tắt thành phần ở `/kieu-dang`: ba kiểu nút, ô tìm, chip lọc, rồi nút trên dải trời. Toàn bộ là bản xem trước `inert` — bản bấm
 * được nằm ở `/thanh-phan`.
 */
export function ComponentsCard() {
  const t = useT()
  const title = t('designSystem.style.components.title')
  return (
    <SheetCard title={title} className="col-span-12 lg:col-span-4">
      <Preview label={title} className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Button><Plus strokeWidth={2.2} aria-hidden />{t('trips.list.create')}</Button>
          <Button variant="secondary">{t('trips.create.cancel')}</Button>
          <Button variant="ghost">{t('designSystem.style.components.ghost')}</Button>
        </div>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} />
          <Input placeholder={t('designSystem.style.components.search')} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip>
            {t('designSystem.components.choices.vehicleChip', { name: t('common.filters.all') })}
            <ChevronDown aria-hidden strokeWidth={1.75} />
          </FilterChip>
          <FilterChip pressed><Check aria-hidden strokeWidth={2} />{t('trips.packages.onlyFragile')}</FilterChip>
        </div>
        <SkyStage className="flex flex-col gap-3.5">
          <GlassNavSample items={[t('nav.trips'), t('nav.fleet')]} active={0} />
          <div className="flex flex-wrap items-center gap-2.5">
            <Button><Box strokeWidth={2} aria-hidden />{t('trips.detail.openPlan')}</Button>
            <Button variant="glass"><RotateCw strokeWidth={1.75} aria-hidden />{t('trips.detail.runOptimization')}</Button>
          </div>
        </SkyStage>
      </Preview>
    </SheetCard>
  )
}
