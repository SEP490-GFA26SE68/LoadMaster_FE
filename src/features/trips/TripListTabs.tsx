import { TabCount, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useFormat, useT } from '@/lib/i18n'
import { TRIP_LIST_TABS, type TripListTab } from './trip-list'

/**
 * Dòng số dưới tiêu đề (`ChuyenHang.jpg` `.page-head .sub`): tổng chuyến · đang vận chuyển · cần bạn xử lý, đếm trên cả kho (không theo bộ
 * lọc). Số in đậm trắng, số việc cần xử lý màu hổ phách như số của tab "Cần xử lý".
 */
export function TripListStats({ total, transit, review }: { total: number; transit: number; review: number }) {
  const t = useT()
  const format = useFormat()
  const number = 'font-semibold text-sky-text tabular-nums'
  return (
    <span className="flex gap-3.5">
      <span><b className={number}>{format.integer(total)}</b> {t('trips.list.stats.total', { count: total })}</span>
      <span aria-hidden>·</span>
      <span><b className={number}>{format.integer(transit)}</b> {t('trips.list.stats.transit')}</span>
      <span aria-hidden>·</span>
      <span><b className="font-semibold text-amber-500 tabular-nums">{format.integer(review)}</b> {t('trips.list.stats.review')}</span>
    </span>
  )
}

/**
 * Tab trên dải trời thay hàng ô số liệu của V2: mỗi tab là một giá trị của bộ lọc `trang-thai` (`TRIP_LIST_TABS`), số trên tab theo
 * tìm và các bộ lọc khác. "Cần xử lý" dùng số hổ phách vì là việc chờ người dùng. Phải nằm trong `Tabs` của màn.
 */
export function TripListTabs({ counts }: { counts: Record<TripListTab, number> | null }) {
  const t = useT()
  return (
    <TabsList tone="sky" aria-label={t('trips.list.tabs.label')}>
      {TRIP_LIST_TABS.map(({ key }) => (
        <TabsTrigger key={key} value={key}>
          {t(`trips.list.tabs.${key}`)}
          {counts ? <TabCount tone={key === 'review' && counts.review > 0 ? 'warn' : 'neutral'}>{counts[key]}</TabCount> : null}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
