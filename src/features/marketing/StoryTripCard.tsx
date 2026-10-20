import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LANDING_STOP_COUNT } from './landing-sample.mock'
import { PUBLIC_TOUCH_TAG } from './public-chrome'
import { useStoryLoaded, useStoryPhase, type StoryDriver } from './useStoryDriver'

/** Giai đoạn mà thẻ kể: đang tính · đã tính phương án · kho đang xếp · xếp xong. */
export type TripCardPhase = 'preparing' | 'computed' | 'loading' | 'ready'

type TripCardProps = {
  phase: TripCardPhase
  /** Số kiện đang nằm trong thùng của khung 3D (pha xếp). */
  recorded: number
  /** Số kiện của yêu cầu mẫu. */
  total: number
  /** `id` của tên thẻ: khung 3D lấy làm tên. */
  titleId?: string
  /** Chip luôn xuống hàng riêng dưới tên: thẻ hẹp nằm đè trên khung (288 px) không đổi chiều cao khi chip đổi. */
  compact?: boolean
  className?: string
}

/** Chip và nhãn của ứng dụng ở cỡ chữ 16 px trên máy cảm ứng, như mọi chip của hai trang công khai. */
const TOUCH = PUBLIC_TOUCH_TAG

/**
 * Thẻ "Chuyến mẫu" nằm đè trên khung 3D (từ 1.280 px) hay ngay trên khung (hẹp hơn), nền tối đặc. Chip đầu "Đã tính phương án" chỉ có ở
 * trang giới thiệu (`landing.stage.computed`): tông trung tính, chấm vòng rỗng — chờ người kế tiếp, không trùng trạng thái nào của ứng dụng.
 * Sau đó là chip của chính ứng dụng: `StatusBadge` Đang xếp hàng kèm dòng phụ "Đang xếp n / 366" rồi "Xếp xong — chờ xuất phát". Không có
 * chip Đã lập kế hoạch: chuyến mẫu không có tuyến, cũng không được duyệt. Không số kết quả nào nên không có MOCK RESULT: số kiện, số điểm
 * giao là của yêu cầu mẫu, n là số hộp đang vẽ trong thùng.
 * Chiều cao không đổi theo giai đoạn: dưới 768 px (và khi `compact`) chip xuống hàng riêng — chip "đang tính" dài nhất không vừa cạnh tên.
 */
export function StoryTripCard({ phase, recorded, total, titleId, compact = false, className }: TripCardProps) {
  const t = useT()
  const format = useFormat()
  const chip =
    phase === 'preparing' ? <Badge dot="spin" className={TOUCH}>{t('landing.stage.preparing')}</Badge>
      : phase === 'computed' ? <Badge dot="ring" className={TOUCH}>{t('landing.stage.computed')}</Badge>
        : <StatusBadge status="LOADING" className={TOUCH} />
  const sub = phase === 'loading' ? { kind: 'loading' as const, recorded, total } : phase === 'ready' ? { kind: 'loaded' as const } : null
  return (
    <div className={cn('rounded-lg border border-border-dark bg-panel-dark p-3.5', className)}>
      <div className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5', compact ? 'flex-col items-start' : 'max-md:flex-col max-md:items-start')}>
        <p id={titleId} className="m-0 font-display text-h3 leading-5.5 font-[650] tracking-[-0.1px] text-sky-text font-stretch-106%">
          {t('landing.stage.trip')}
        </p>
        {chip}
      </div>
      {/* Số kiện, số điểm giao không tách khỏi đơn vị: hẹp thì cả cụm xuống dòng (không còn "4" một dòng, "điểm giao" dòng sau) */}
      <p className="m-0 mt-1 text-small text-sky-text-2 pointer-coarse:text-body-lg">
        {t('landing.stage.title')} ·{' '}
        <span className="whitespace-nowrap">{t('landing.stage.load', { count: format.integer(total), stops: format.integer(LANDING_STOP_COUNT) })}</span>
      </p>
      <div className="mt-2.5 flex min-h-5 items-center pointer-coarse:min-h-7">
        <TripSubStatusTag sub={sub} className={cn('tabular-nums', TOUCH)} />
      </div>
    </div>
  )
}

/**
 * Thẻ chuyến chạy theo chuyện: đọc kênh chậm của `useStoryDriver` (tối đa 10 lần mỗi giây) nên chỉ thẻ này vẽ lại theo tiến độ xếp. `n`
 * không vượt số kiện có chỗ trong phương án — đúng số hộp khung 3D đang vẽ trong thùng.
 */
export function StoryTripCardLive({ driver, resolved, placed, total, titleId, compact, className }: {
  driver: StoryDriver
  /** Phương án mẫu đã tính xong. */
  resolved: boolean
  /** Số kiện có chỗ trong phương án (`result.placements.length`). */
  placed: number
  total: number
  titleId?: string
  compact?: boolean
  className?: string
}) {
  const story = useStoryPhase(driver)
  const loaded = useStoryLoaded(driver, total)
  const phase: TripCardPhase = !resolved ? 'preparing' : story === 'loading' || story === 'ready' ? story : 'computed'
  return <StoryTripCard phase={phase} recorded={Math.min(loaded, placed)} total={total} titleId={titleId} compact={compact} className={className} />
}
