import { QrCode } from '@/components/QrCode'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { PLAN_LABELS, PLAN_OBJECTIVES } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { PUBLIC_TOUCH_TAG } from '../public-chrome'

/** Mã mẫu đúng dạng mã QR của kho kiện (`LM-XXXX-XXXX-XXXX`, Crockford base32) — không thuộc kiện nào; chỉ để vẽ hình. */
const SAMPLE_QR_TOKEN = 'LM-7K2M-9QXD-4F8T'
const VERIFY_LEVELS = ['qr', 'code', 'manual'] as const
const DEADLINES = [
  { status: 'OK', tone: 'success' },
  { status: 'AT_RISK', tone: 'warning' },
  { status: 'MISSED', tone: 'danger' },
] as const satisfies readonly { status: string; tone: BadgeTone }[]

/** Ba phương án A · B · C của một lần chạy, theo thứ tự của màn so sánh; tên mục tiêu là chữ của ứng dụng (`runs.objectives`). */
export function PlansVisual() {
  const t = useT()
  return (
    <ol className="m-0 grid list-none gap-2 p-0">
      {PLAN_OBJECTIVES.map((objective) => (
        <li key={objective} className="flex items-center gap-3 rounded-md border border-line-soft bg-surface py-2 pr-3 pl-2">
          <span className="grid size-9 flex-none place-items-center rounded-md bg-tint-blue font-display text-h3 font-bold text-tint-blue-fg font-stretch-112%">
            {PLAN_LABELS[objective]}
          </span>
          <span className="text-body-lg font-medium text-ink-strong">{t(`runs.objectives.${objective}`)}</span>
        </li>
      ))}
    </ol>
  )
}

/** Ba mức đối chiếu theo thứ tự thử: quét, gõ mã, xác nhận tay; mã QR bên cạnh chỉ là hình. */
export function VerifyVisual() {
  const t = useT()
  return (
    <div className="flex items-center gap-5">
      <div aria-hidden className="flex-none rounded-md border border-line-soft bg-bg p-1">
        <QrCode token={SAMPLE_QR_TOKEN} size={88} />
      </div>
      <ol className="m-0 flex min-w-0 list-none flex-col gap-2.5 p-0">
        {VERIFY_LEVELS.map((level, index) => (
          <li key={level} className="flex items-center gap-2.5 text-body-lg text-ink-strong">
            <span aria-hidden className="grid size-6 flex-none place-items-center rounded-full bg-tint-blue font-mono text-small font-semibold text-tint-blue-fg pointer-coarse:size-7 pointer-coarse:text-body-lg">
              {index + 1}
            </span>
            {t(`landing.features.verify.levels.${level}`)}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Ba mức hạn của điểm giao, cùng chữ và màu như Chi tiết chuyến — là chú giải, không phải giờ đến của chuyến nào. */
export function DeadlineChips() {
  const t = useT()
  return (
    <div className="flex flex-wrap gap-2">
      {DEADLINES.map(({ status, tone }) => (
        <Badge key={status} tone={tone} dot className={PUBLIC_TOUCH_TAG}>{t(`common.deadlineStatuses.${status}`)}</Badge>
      ))}
    </div>
  )
}
