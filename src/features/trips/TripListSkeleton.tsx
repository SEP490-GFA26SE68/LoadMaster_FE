import { Skeleton } from '@/components/ui/Skeleton'
import { useT } from '@/lib/i18n'

/** Độ rộng cột "Tuyến" của từng dòng giữ chỗ, để không đều tăm tắp. */
const ROUTE_WIDTHS = ['90%', '70%', '100%', '60%', '80%', '85%']

/** Cùng tỷ lệ cột với bảng thật (`trip-list-columns.tsx`): tuyến, mã, xe, tài xế, kiện, lấp đầy, trạng thái, mũi tên. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_108px_13%_15%_76px_122px_132px_20px] items-center px-3.5 gap-x-7'

/**
 * Bảng chuyến đang tải (LM-088, V2.3): cùng một thẻ đè lên dải trời như bảng thật — đầu thẻ giữ chỗ ô tìm và chip lọc, tiêu đề cột
 * thật, 6 dòng giữ chỗ chạy dải sáng.
 */
export function TripListSkeleton() {
  const t = useT()
  return (
    <div aria-busy="true" aria-label={t('trips.skeleton.loading')} className="flex-none">
      <div className="overflow-hidden rounded-lg border border-border bg-bg shadow-card">
        <div className="flex items-center gap-2 border-b border-line-soft px-3.5 py-3">
          <Skeleton className="h-9 w-85 rounded-md" />
          <Skeleton className="h-8 w-44 rounded-md" />
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
        <div className={`${GRID} h-10 border-b border-border bg-table-head text-caption font-semibold text-ink-2`}>
          <span>{t('trips.skeleton.route')}</span>
          <span>{t('trips.skeleton.id')}</span>
          <span>{t('trips.skeleton.vehicle')}</span>
          <span>{t('trips.skeleton.driver')}</span>
          <span className="text-right">{t('trips.skeleton.packages')}</span>
          <span>{t('trips.skeleton.fill')}</span>
          <span>{t('trips.skeleton.status')}</span>
          <span />
        </div>
        {ROUTE_WIDTHS.map((width, index) => (
          <div key={index} className={`${GRID} h-14 border-b border-line-soft last:border-b-0`}>
            <span className="flex flex-col gap-2">
              <Skeleton className="h-3 max-w-full" style={{ width }} />
              <Skeleton className="h-2.5 w-3/4" />
            </span>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-3 w-8" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-6.5 w-24 rounded-full" />
            <span />
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-text-3">{t('trips.skeleton.loadingText')}</p>
    </div>
  )
}
