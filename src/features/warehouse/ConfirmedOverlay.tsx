import { Check } from 'lucide-react'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Lớp phủ xác nhận sau khi bấm "Xác nhận đã xếp": vòng tròn xanh lớn, mã kiện vừa xếp và bước kế tiếp — kiện cuối thì báo đang
 * hoàn tất xếp hàng, hoặc nói còn chờ điều phối viên duyệt xác nhận tay (FE-6-04: kho chưa cho xong xếp). Hiện tối thiểu ~1,2 giây và
 * tới khi kho ghi xong. Là lớp nổi nên vòng tròn được phép có bóng (mục 5).
 */
export function ConfirmedOverlay({
  confirmedId,
  nextStep,
  awaitingApproval = false,
}: {
  confirmedId: string
  /** Bước kế tiếp; vắng khi vừa xếp kiện cuối. */
  nextStep?: number
  /** Còn xác nhận tay chờ duyệt: kiện cuối có kết quả nhưng chuyến chưa hoàn tất xếp được. */
  awaitingApproval?: boolean
}) {
  const t = useT()
  const format = useFormat()
  return (
    <div
      role="status"
      aria-live="assertive"
      className="absolute inset-0 z-5 flex flex-col items-center justify-center gap-5 bg-bg/82 animate-[lm-fade-in_220ms_var(--ease-standard)]"
    >
      <span className="grid size-40 place-items-center rounded-full bg-success shadow-[0_12px_32px_rgb(22_163_74_/_0.35)]">
        <Check className="size-22 text-white" strokeWidth={3} aria-hidden />
      </span>
      <span className="text-[28px] leading-9 font-semibold text-text">
        {t('warehouse.confirmed', { id: confirmedId })}
      </span>
      <span className="text-[18px] leading-6 text-text-2">
        {nextStep !== undefined
          ? t('warehouse.nextStep', { step: format.integer(nextStep) })
          : awaitingApproval ? t('warehouse.confirms.overlayWaiting') : t('warehouse.finishing')}
      </span>
    </div>
  )
}
