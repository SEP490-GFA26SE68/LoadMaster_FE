import { Check, ChevronRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Lumo } from '@/components/brand/Lumo'
import { QrCode } from '@/components/QrCode'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { PLAN_LABELS, PLAN_OBJECTIVES } from '@/domain/models'
import { useT } from '@/lib/i18n'
import type { VerifyContext } from '@/lib/mock-db/verify-model'
import { PUBLIC_TOUCH_TAG } from '../public-chrome'
import { Reveal, useRevealMotion } from '../reveal'
import { PlanStrip } from './PlanStrips'

/** Các cảnh của Cách hoạt động (`steps/`) còn import `svgPiece` từ đây. */
export { svgPiece } from './svg-piece'

/** Mã mẫu đúng dạng mã QR của kho kiện (`LM-XXXX-XXXX-XXXX`, Crockford base32) — không thuộc kiện nào; chỉ để vẽ hình. */
const SAMPLE_QR_TOKEN = 'LM-7K2M-9QXD-4F8T'
const QR_PX = 88
/** Ba mức đối chiếu, theo mã của ứng dụng: tên lấy từ `common.verifyMethods` như hộp đối chiếu và báo cáo chuyến. */
const VERIFY_LEVELS = ['QR', 'CODE', 'MANUAL'] as const
/** Ba bước của chuyến có đối chiếu từng kiện, theo đường đi của kiện: kho soạn, kho xếp, tài xế dỡ (tên từ `common.verifyContexts`). */
const VERIFY_STEPS = ['STAGING', 'LOADING', 'UNLOADING'] as const satisfies readonly VerifyContext[]
const DEADLINES = [
  { status: 'OK', tone: 'success' },
  { status: 'AT_RISK', tone: 'warning' },
  { status: 'MISSED', tone: 'danger' },
] as const satisfies readonly { status: string; tone: BadgeTone }[]

/**
 * Ô đối chiếu, mốc tính từ lúc ô bắt đầu (ms): Lumo quét nhô lên (400 ms), tia chạy qua mã QR (600 ms), ba mức hiện dần cách nhau 70 ms,
 * rồi ba bước có đối chiếu bật ra theo thứ tự.
 */
const SCAN_AT = 100
const BEAM_AT = 400
const LEVELS_AT = 700
const STEPS_AT = 950

/**
 * Ba phương án A · B · C của một lần chạy, theo thứ tự của màn so sánh; tên mục tiêu là chữ của ứng dụng (`runs.objectives`). Mỗi dòng có
 * hình thu nhỏ của thùng xếp theo mục tiêu đó (`PlanStrip`, trang trí): các ô hàng bật ra từ vách trước ra cửa khi dòng hiện.
 */
export function PlansVisual() {
  const t = useT()
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {PLAN_OBJECTIVES.map((objective, index) => (
        <Reveal as="li" key={objective} index={index} delay={200} className="flex items-center gap-3 rounded-md border border-line-soft bg-surface py-2 pr-3 pl-2">
          <Reveal as="span" kind="pop" delay={150} className="grid size-9 flex-none place-items-center rounded-md bg-tint-blue font-display text-h3 font-bold text-tint-blue-fg font-stretch-112%">
            {PLAN_LABELS[objective]}
          </Reveal>
          <span className="min-w-0 flex-1 text-body-lg font-medium text-ink-strong">{t(`runs.objectives.${objective}`)}</span>
          <PlanStrip objective={objective} className="w-20 sm:w-24" />
        </Reveal>
      ))}
    </ol>
  )
}

/** Ba bước có đối chiếu, nối bằng mũi tên — trang trí: câu của ô đã nói kho quét khi soạn và xếp, tài xế quét khi dỡ. */
function VerifySteps() {
  const t = useT()
  return (
    <ol aria-hidden className="m-0 flex list-none flex-wrap items-center gap-x-1.5 gap-y-2 border-t border-line-soft p-0 pt-4">
      {VERIFY_STEPS.map((step, index) => (
        <Reveal as="li" key={step} kind="pop" index={index} delay={STEPS_AT} className="flex items-center gap-1.5">
          {index > 0 ? <ChevronRight className="size-4 flex-none text-ink-3" strokeWidth={1.5} /> : null}
          <span className="flex items-center gap-1.5 rounded-full bg-tint-green py-1 pr-3 pl-2 text-small font-medium text-tint-green-fg pointer-coarse:text-body-lg">
            <Check className="size-4 flex-none" strokeWidth={1.5} />
            {t(`common.verifyContexts.${step}`)}
          </span>
        </Reveal>
      ))}
    </ol>
  )
}

/**
 * Ba mức đối chiếu theo thứ tự thử: quét, gõ mã, xác nhận tay; mã QR chỉ là hình. Từ 768 px Lumo (`scan`) đứng bên phải mã QR, máy quét
 * chĩa vào nó, ba mức xuống hàng dưới; khi ô hiện ra một tia 2 px chạy qua mã QR một lần. Hẹp hơn: mã QR và ba mức nằm cạnh nhau. Dưới
 * cùng là ba bước của chuyến có đối chiếu (soạn → xếp → dỡ).
 */
export function VerifyVisual() {
  const t = useT()
  const motion = useRevealMotion()
  const beam = { '--at': `${BEAM_AT}ms`, '--beam-travel': `${QR_PX - 2}px` } as CSSProperties
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-5 md:flex-col md:items-start md:gap-4">
        <div className="flex flex-none items-end gap-3">
          <div aria-hidden className="relative flex-none rounded-md border border-line-soft bg-bg p-1">
            <QrCode token={SAMPLE_QR_TOKEN} size={QR_PX} />
            {motion ? <span className="lp-beam reveal-piece pointer-events-none absolute inset-x-1 top-1 hidden h-0.5 bg-cyan-400 md:block" style={beam} /> : null}
          </div>
          <Reveal delay={SCAN_AT} className="lp-scan hidden md:block">
            <Lumo pose="scan" px={96} sizes="96px" loading="lazy" />
          </Reveal>
        </div>
        <ol className="m-0 flex min-w-0 list-none flex-col gap-2.5 p-0">
          {VERIFY_LEVELS.map((level, index) => (
            <Reveal as="li" key={level} kind="fade" index={index} delay={LEVELS_AT} className="flex items-center gap-2.5 text-body-lg text-ink-strong">
              <span aria-hidden className="grid size-6 flex-none place-items-center rounded-full bg-tint-blue font-mono text-small font-semibold text-tint-blue-fg pointer-coarse:size-7 pointer-coarse:text-body-lg">
                {index + 1}
              </span>
              {t(`common.verifyMethods.${level}`)}
            </Reveal>
          ))}
        </ol>
      </div>
      <VerifySteps />
    </div>
  )
}

/** Ba mức hạn của điểm giao, cùng chữ và màu như Chi tiết chuyến — là chú giải, không phải giờ đến của chuyến nào. Hiện dần sau tuyến. */
export function DeadlineChips() {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-2">
      {DEADLINES.map(({ status, tone }, index) => (
        <Reveal as="span" key={status} kind="fade" index={index} delay={700} className="flex">
          <Badge tone={tone} dot className={PUBLIC_TOUCH_TAG}>{t(`common.deadlineStatuses.${status}`)}</Badge>
        </Reveal>
      ))}
    </div>
  )
}
