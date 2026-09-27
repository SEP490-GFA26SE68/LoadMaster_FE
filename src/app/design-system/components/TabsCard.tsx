import { useState } from 'react'
import { TabCount, Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { TRIP_STATUS_GROUPS, type TripRow } from '@/features/trips/trip-list'
import { useT } from '@/lib/i18n'
import type { TripStatus } from '@/types/trip'
import { SheetCard, SkyStage } from '../SheetLayout'

const GROUP_KEYS = ['all', 'review', 'active', 'completed'] as const
type Group = (typeof GROUP_KEYS)[number]

const GROUPS: Record<Group, readonly TripStatus[] | null> = {
  all: null,
  review: TRIP_STATUS_GROUPS.review,
  active: TRIP_STATUS_GROUPS.active,
  completed: ['hoan_thanh'],
}

const INSPECTOR_TABS = ['operations', 'package', 'display', 'packages'] as const

/**
 * Tab trên dải trời (`tone="sky"`) đếm chuyến thật của kho theo nhóm của danh sách chuyến — "Cần xử lý" dùng số hổ phách vì là
 * việc chờ người dùng; tab trên nền trắng là tab của hộp thông tin Planner, "Danh sách" đếm kiện của chuyến đầu kho.
 */
export function TabsCard({ rows, packageCount }: { rows: readonly TripRow[] | undefined; packageCount: number | undefined }) {
  const t = useT()
  const [group, setGroup] = useState<Group>('all')
  const [inspector, setInspector] = useState<string>('operations')
  const inGroup = (key: Group) => {
    const statuses = GROUPS[key]
    return (rows ?? []).filter((row) => statuses === null || statuses.includes(row.status))
  }

  return (
    <SheetCard title={t('designSystem.components.tabs.title')} meta={t('designSystem.components.tabs.meta')}>
      <SkyStage className="px-1.5 py-0">
        <Tabs value={group} onValueChange={(value) => { const next = GROUP_KEYS.find((key) => key === value); if (next) setGroup(next) }}>
          <TabsList tone="sky" aria-label={t('designSystem.components.tabs.groups')} className="px-3.5">
            {GROUP_KEYS.map((key) => (
              <TabsTrigger key={key} value={key}>
                {t(`designSystem.components.tabs.${key}`)}
                <TabCount tone={key === 'review' ? 'warn' : 'neutral'}>{inGroup(key).length}</TabCount>
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
