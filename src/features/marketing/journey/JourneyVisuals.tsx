import { QrCode } from '@/components/QrCode'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { PUBLIC_TOUCH_TAG } from '../public-chrome'

/** Mã mẫu đúng dạng mã QR của kho kiện (`LM-XXXX-XXXX-XXXX`, Crockford base32) — không thuộc kiện nào; chỉ để vẽ hình. */
const SAMPLE_QR_TOKEN = 'LM-7K2M-9QXD-4F8T'
const VERIFY_LEVELS = ['qr', 'code', 'manual'] as const
const DEADLINES = [
  { status: 'OK', tone: 'success' },
  { status: 'AT_RISK', tone: 'warning' },
  { status: 'MISSED', tone: 'danger' },
] as const satisfies readonly { status: string; tone: BadgeTone }[]

const LABEL = 'm-0 text-small font-semibold text-ink-2 pointer-coarse:text-body-lg'

/** Chặng kho: ba cách đối chiếu một kiện theo thứ tự thử — quét, gõ mã, xác nhận tay; mã QR bên cạnh chỉ là hình. */
export function VerifyVisual() {
  const t = useT()
  return (
    <div className="flex flex-col gap-3">
      <p className={LABEL}>{t('landingJourney.verify.label')}</p>
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
              {t(`landingJourney.verify.levels.${level}`)}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

/** Kho rồi bốn điểm giao theo thứ tự đi, nối thẳng như bản đồ của Chi tiết chuyến; toạ độ trong khung 530 × 150. */
const DEPOT = { x: 30, y: 104 }
const STOPS = [
  { stop: 1, x: 140, y: 50 },
  { stop: 2, x: 262, y: 102 },
  { stop: 3, x: 384, y: 40 },
  { stop: 4, x: 500, y: 94 },
] as const

/**
 * Chặng trên đường: sơ đồ tuyến (trang trí — kho, đường đi, số điểm giao trên màu định danh) và chú giải ba mức hạn, cùng chữ và màu
 * như Chi tiết chuyến — không phải giờ đến của chuyến nào.
 */
export function RouteVisual() {
  const t = useT()
  const route = [DEPOT, ...STOPS].map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <div className="flex flex-col gap-4">
      <svg aria-hidden viewBox="0 0 530 150" className="block h-auto w-full max-w-130">
        <polyline points={route} fill="none" className="stroke-cyan-200" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={route} fill="none" className="stroke-primary" strokeWidth={2.5} strokeDasharray="1 7" strokeLinecap="round" strokeLinejoin="round" />
        <rect x={DEPOT.x - 16} y={DEPOT.y - 16} width={32} height={32} rx={7} className="fill-panel-dark" />
        <rect x={DEPOT.x - 5} y={DEPOT.y - 5} width={10} height={10} rx={2} className="fill-cyan-300" />
        <text x={DEPOT.x} y={DEPOT.y + 36} textAnchor="middle" fontSize={17} className="fill-ink-2 font-semibold">{t('landingJourney.route.depot')}</text>
        {STOPS.map(({ stop, x, y }) => (
          <g key={stop}>
            <circle cx={x} cy={y} r={18} fill={stopColor(stop)} className="stroke-bg" strokeWidth={3} />
            <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={18} fill={stopForeground(stop)} className="font-display font-bold">{stop}</text>
          </g>
        ))}
      </svg>
      <div className="flex flex-col gap-2">
        <p className={LABEL}>{t('landingJourney.route.deadlines')}</p>
        <div className="flex flex-wrap gap-2">
          {DEADLINES.map(({ status, tone }) => (
            <Badge key={status} tone={tone} dot className={PUBLIC_TOUCH_TAG}>{t(`common.deadlineStatuses.${status}`)}</Badge>
          ))}
        </div>
      </div>
    </div>
  )
}
