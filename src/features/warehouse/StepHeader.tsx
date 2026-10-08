import { LanguageSwitch } from '@/components/LanguageSwitch'
import { TouchTopBar } from '@/components/TouchTopBar'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useFormat, useT } from '@/lib/i18n'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Thanh trên cùng (dải trời, điều khiển đặc — V2.3 đợt 6): lối thoát, bước hiện tại, thanh tiến độ, nút chuyển ngôn ngữ, mã chuyến.
 * Dùng chung cho bước Soạn hàng (`label` "Đã soạn", FE-6-02) và bước Xếp.
 *
 * Bản design không có nút thoát vì vẽ màn kiosk chạy suốt ca; thực tế nhân viên vẫn cần rời phiên khi chọn nhầm chuyến hoặc xếp
 * xong, nên thêm nút quay lại cỡ cảm ứng 56px (mục 10). Nút chuyển ngôn ngữ cũng 56px (LM-071); đổi ngôn ngữ không remount phiên
 * nên bước đang xếp giữ nguyên. Nút thoát theo vai trò (`exitAction`): nhân viên kho về danh sách chuyến (LM-086) — từ FE-0-01 chỉ
 * nhân viên kho mở được màn này. Thanh tiến độ tính theo số kiện đã có kết quả trong kho, không theo số bước.
 */
export function StepHeader({ step, totalSteps, recorded, tripId, label, progressLabel }: {
  step: number
  totalSteps: number
  /** Kiện đã xong ở bước này: đã soạn, hoặc đã có kết quả xếp (đã xếp, hay hỏng bị bỏ lại). */
  recorded: number
  tripId: string
  /** Chữ trước số; mặc định "Bước". */
  label?: string
  /** Tên của thanh tiến độ; mặc định "Tiến độ xếp hàng". */
  progressLabel?: string
}) {
  const t = useT()
  const format = useFormat()
  const percent = totalSteps === 0 ? 100 : Math.round((recorded / totalSteps) * 100)

  return (
    <TouchTopBar
      leading={<ExitIconButton tone="sky" screenHome={loadingSessionPath(tripId)} contextual={`/chuyen/${tripId}`} label={t('warehouse.header.exit')} iconClassName="size-7" />}
      trailing={
        <>
          <LanguageSwitch size="touch" tone="sky" />
          <span aria-hidden className="mx-1 h-8 w-px bg-sky-solid-border" />
          <div className="flex flex-col items-end">
            <span className="text-body-lg text-sky-text-3">{t('warehouse.header.trip')}</span>
            <span className="font-mono text-[18px] leading-6 font-semibold tracking-[-0.01em] text-sky-text">{tripId}</span>
          </div>
        </>
      }
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-display text-h1 leading-7 font-bold tabular-nums text-sky-text font-stretch-112%">
            {label ?? t('warehouse.header.step')} <span>{format.integer(Math.min(step, totalSteps))}</span>{' '}
            <span className="text-h2 font-medium text-sky-text-3">/ {format.integer(totalSteps)}</span>
          </span>
          <span className="font-display text-body-lg font-[650] tabular-nums text-cyan-200">{format.integer(percent)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progressLabel ?? t('warehouse.header.progress')}
          className="h-2.5 overflow-hidden rounded-full border border-sky-solid-border bg-sky-solid"
        >
          <div
            className="h-full rounded-full bg-(image:--meter-fill) transition-[width] duration-(--dur-md) ease-decelerate"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </TouchTopBar>
  )
}
