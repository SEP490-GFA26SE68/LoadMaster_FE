import { TabCount, TabsList, TabsTrigger } from '@/components/ui/Tabs'
import { useFormat, useT } from '@/lib/i18n'
import { TRIP_LIST_TABS, type TripListTab } from './trip-list'

/**
 * Dòng số dưới tiêu đề (`ChuyenHang.jpg` `.page-head .sub`): tổng chuyến · đang vận chuyển · cần bạn xử lý, đếm trên cả kho (không theo bộ
 * lọc). Số in đậm trắng, số việc cần xử lý màu hổ phách như số hổ phách trên tab "Đã lập kế hoạch".
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
 * Tab trên dải trời (FE-0-05): Tất cả rồi sáu trạng thái của chuyến, mỗi tab là một giá trị của bộ lọc `trang-thai`
 * (`TRIP_LIST_TABS`); số trên tab đếm chuyến của tab theo tìm và các bộ lọc khác. Tab "Đã lập kế hoạch" có thêm số hổ phách: chuyến
 * cần người dùng xử lý (phương án chờ duyệt hoặc lỗi thời) — chỉ hiện khi có. Phải nằm trong `Tabs` của màn.
 */
export function TripListTabs({ counts, needAction }: { counts: Record<TripListTab, number> | null; needAction: number }) {
  const t = useT()
  return (
    <TabsList tone="sky" aria-label={t('trips.list.tabs.label')}>
      {TRIP_LIST_TABS.map(({ key }) => (
        <TabsTrigger key={key} value={key}>
          {key === 'all' ? t('trips.list.tabs.all') : t(`status.${key}`)}
          {counts ? <TabCount>{counts[key]}</TabCount> : null}
          {counts && key === 'PLANNED' && needAction > 0 ? <NeedActionCount count={needAction} /> : null}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}

/**
 * Số hổ phách cạnh số của tab: chuyến cần người dùng xử lý. Hình là con số; trình đọc màn hình và chú thích nổi có cả câu
 * "2 cần bạn xử lý". Dùng lại ở thẻ Tab của `/thanh-phan`.
 */
export function NeedActionCount({ count }: { count: number }) {
  const t = useT()
  const label = t('trips.list.tabs.needAction', { count })
  return (
    <span className="relative flex" title={label}>
      <span aria-hidden className="flex"><TabCount tone="warn">{count}</TabCount></span>
      <span className="sr-only">{label}</span>
    </span>
  )
}
