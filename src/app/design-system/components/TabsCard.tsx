import { useState } from 'react'
import { TabCount, Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { needsAction, type TripRow } from '@/features/trips/trip-list'
import { NeedActionCount } from '@/features/trips/TripListTabs'
import { useT } from '@/lib/i18n'
import { SheetCard, SkyStage } from '../SheetLayout'

/**
 * Bốn tab mẫu của danh sách chuyến: Tất cả và ba trong sáu trạng thái — đủ để thấy tab có số hổ phách cạnh số của nó, và vừa bề
 * ngang thẻ ở 1.366 px (đủ bảy tab thì khay phải cuộn ngang).
 */
const GROUP_KEYS = ['all', 'DRAFT', 'PLANNED', 'DELIVERED'] as const
type Group = (typeof GROUP_KEYS)[number]

const INSPECTOR_TABS = ['operations', 'package', 'display', 'packages'] as const

/**
 * Tab trên dải trời (`tone="sky"`) đếm chuyến thật của kho theo trạng thái như danh sách chuyến — tab "Đã lập kế hoạch" có thêm số
 * hổ phách vì là việc chờ người dùng (phương án chờ duyệt hoặc lỗi thời); tab trên nền trắng là tab của hộp thông tin Planner,
 * "Danh sách" đếm kiện của chuyến đầu kho.
 */
export function TabsCard({ rows, packageCount }: { rows: readonly TripRow[] | undefined; packageCount: number | undefined }) {
  const t = useT()
  const [group, setGroup] = useState<Group>('all')
  const [inspector, setInspector] = useState<string>('operations')
  const trips = rows ?? []
  const needAction = trips.filter(needsAction).length

  return (
    <SheetCard title={t('designSystem.components.tabs.title')} meta={t('designSystem.components.tabs.meta')}>
      <SkyStage className="px-1.5 py-0">
        <Tabs value={group} onValueChange={(value) => { const next = GROUP_KEYS.find((key) => key === value); if (next) setGroup(next) }}>
          <TabsList tone="sky" aria-label={t('designSystem.components.tabs.groups')} className="mx-3.5 my-4">
            {GROUP_KEYS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {key === 'all' ? t('trips.list.tabs.all') : t(`status.${key}`)}
                <TabCount>{trips.filter((row) => key === 'all' || row.status === key).length}</TabCount>
                {key === 'PLANNED' && needAction > 0 ? <NeedActionCount count={needAction} /> : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </SkyStage>
      <Tabs value={inspector} onValueChange={setInspector}>
        <TabsList aria-label={t('designSystem.components.tabs.inspector')} className="px-0">
          {INSPECTOR_TABS.map((key) => (
            <TabsTrigger key={key} value={key}>
              {t(`viewer.inspector.tabs.${key}`)}
              {key === 'packages' && packageCount !== undefined ? <TabCount>{packageCount}</TabCount> : null}
            </TabsTrigger>
          ))}
          <TabsTrigger value="metrics">{t('viewer.plan.metricsTab')}</TabsTrigger>
        </TabsList>
      </Tabs>
    </SheetCard>
  )
}
