import { useState } from 'react'
import { DEFAULT_PERIOD, type PeriodPreset } from '@/features/manager/dashboard-period'
import { useTripsQuery } from '@/features/trips/useTripsQuery'
import { useT } from '@/lib/i18n'
import { BannersCard } from './components/BannersCard'
import { ButtonsCard } from './components/ButtonsCard'
import { ChoicesCard } from './components/ChoicesCard'
import { DialogCard } from './components/DialogCard'
import { EmptyLoadingCard } from './components/EmptyLoadingCard'
import { FieldsCard } from './components/FieldsCard'
import { FormSectionCard } from './components/FormSectionCard'
import { KpiCard } from './components/KpiCard'
import { LabelsCard } from './components/LabelsCard'
import { MenuCard } from './components/MenuCard'
import { MetersCard } from './components/MetersCard'
import { TabsCard } from './components/TabsCard'
import { ToastCard } from './components/ToastCard'
import { TripTableCard } from './components/TripTableCard'
import { SheetLayout } from './SheetLayout'
import { useSheetSampleQuery } from './useSheetSampleQuery'

const column = 'flex min-w-0 flex-col gap-4'

/**
 * Bảng thành phần V2.3 (`design/v2.3/screens/web/ThanhPhan.jpg`): thành phần thật của `src/components` với nhãn và dữ liệu thật
 * của kho, hai cột thẻ, bảng tràn ngang ở giữa. Điều khiển chọn, tab, ô nhập, bảng bấm được; nút, hộp thoại, toast, menu là bản
 * xem trước không bấm được. Route: `/thanh-phan`, công khai.
 */
export function ComponentSheetPage() {
  const t = useT()
  const sample = useSheetSampleQuery().data
  const rows = useTripsQuery().data
  const [period, setPeriod] = useState<PeriodPreset>(DEFAULT_PERIOD)

  return (
    <SheetLayout path="/thanh-phan" title={t('designSystem.components.title')} lede={t('designSystem.components.lede')}>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className={column}>
            <ButtonsCard />
            <ChoicesCard sample={sample} period={period} onPeriodChange={setPeriod} />
            <TabsCard rows={rows} packageCount={sample?.trip.packageCount} />
            <BannersCard sample={sample} rows={rows} />
          </div>
          <div className={column}>
            <FieldsCard sample={sample} />
            <LabelsCard sample={sample} />
            <MetersCard sample={sample} />
          </div>
        </div>

        <TripTableCard rows={rows} />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <div className={column}>
            <KpiCard period={period} />
            <ToastCard />
            <FormSectionCard />
          </div>
          <div className={column}>
            <DialogCard sample={sample} />
            <EmptyLoadingCard />
            <MenuCard />
          </div>
        </div>
      </div>
    </SheetLayout>
  )
}
