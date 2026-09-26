import { Plus, Route } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useT } from '@/lib/i18n'
import { SheetCard } from '../SheetLayout'

const ROWS = [0, 1, 2, 3, 4]
const ROW_GRID = 'grid grid-cols-[1.6fr_1fr_0.7fr_1fr_0.9fr] items-center gap-3 border-b border-line-soft px-3.5'

/**
 * Trạng thái rỗng của danh sách chuyến (chữ và liên kết tạo chuyến thật) cạnh khung bảng đang tải dựng bằng `Skeleton`.
 */
export function EmptyLoadingCard() {
  const t = useT()
  return (
    <SheetCard title={t('designSystem.components.empty.title')} bare>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        <EmptyState
          icon={Route}
          tone="info"
          title={t('trips.list.emptyTitle')}
          description={t('trips.list.emptyDescription')}
          className="px-5 py-9 sm:border-r sm:border-line-soft"
          action={(
            <Button asChild>
              <Link to="/chuyen/moi"><Plus strokeWidth={2} aria-hidden />{t('trips.list.createFirst')}</Link>
            </Button>
          )}
        />
        <div role="status" aria-label={t('designSystem.components.empty.loading')} className="pt-2.5">
          <div className={`${ROW_GRID} h-9.5 bg-n-25`}>
            {[60, 70, 50, 60, 70].map((width, index) => <Skeleton key={index} className="h-2.5" style={{ width: `${width}%` }} />)}
          </div>
          {ROWS.map((row) => (
            <div key={row} className={`${ROW_GRID} h-14`}>
              <span className="flex flex-col gap-2">
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-2.5 w-1/2" />
              </span>
              <Skeleton className="h-3 w-[70%]" />
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2 w-4/5" />
              <Skeleton className="h-5.5 w-[90%] rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </SheetCard>
  )
}
