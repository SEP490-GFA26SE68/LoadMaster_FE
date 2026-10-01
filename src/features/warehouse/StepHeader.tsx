import { LanguageSwitch } from '@/components/LanguageSwitch'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useFormat, useT } from '@/lib/i18n'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Thanh trên cùng: lối thoát, bước hiện tại, thanh tiến độ, nút chuyển ngôn ngữ, mã chuyến.
 *
 * Bản design không có nút thoát vì vẽ màn kiosk chạy suốt ca; thực tế nhân viên vẫn cần rời phiên khi chọn nhầm chuyến hoặc xếp
 * xong, nên thêm nút quay lại cỡ cảm ứng 56px (mục 10). Nút chuyển ngôn ngữ cũng 56px (LM-071); đổi ngôn ngữ không remount phiên
 * nên bước đang xếp giữ nguyên. Nút thoát theo vai trò (`exitAction`): nhân viên kho về danh sách chuyến (LM-086) — từ FE-0-01 chỉ
 * nhân viên kho mở được màn này. Thanh tiến độ tính theo số kiện đã có kết quả trong kho, không theo số bước.
 */
export function StepHeader({ step, totalSteps, recorded, tripId }: {
  step: number
  totalSteps: number
  /** Kiện đã có kết quả (đã xếp hoặc thiếu). */
  recorded: number
  tripId: string
}) {
  const t = useT()
  const format = useFormat()
  const percent = totalSteps === 0 ? 100 : Math.round((recorded / totalSteps) * 100)

  return (
    <header className="flex h-18 flex-none items-center gap-4 border-b border-border bg-bg pr-6 pl-3">
      <ExitIconButton screenHome={loadingSessionPath(tripId)} contextual={`/chuyen/${tripId}`} label={t('warehouse.header.exit')} iconClassName="size-7" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-h2 leading-6 font-semibold">
            {t('warehouse.header.step')} <span className="font-mono">{format.integer(Math.min(step, totalSteps))}</span>{' '}
            <span className="font-normal text-text-3">/ {format.integer(totalSteps)}</span>
          </span>
          <span className="font-mono text-body-lg font-medium text-text-2">{format.integer(percent)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('warehouse.header.progress')}
          className="h-2.5 overflow-hidden rounded-full border border-border bg-surface"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-(--dur-md) ease-decelerate"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <LanguageSwitch size="touch" className="flex-none" />

      <span aria-hidden className="h-8 w-px bg-border" />

      <div className="flex flex-none flex-col items-end">
        <span className="text-body-lg text-text-3">{t('warehouse.header.trip')}</span>
        <span className="font-mono text-[18px] leading-6 font-semibold tracking-[-0.01em]">{tripId}</span>
      </div>
    </header>
  )
}
