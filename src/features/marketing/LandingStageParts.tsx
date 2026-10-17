import { RotateCcw } from 'lucide-react'
import { StopDot } from '@/components/StopChip'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Badge } from '@/components/ui/Badge'
import type { OptimizationResult } from '@/domain/models'
import type { CameraPreset } from '@/features/viewer3d/viewer-types'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH_TAG } from './public-chrome'

/** Ba góc nhìn của khung 3D: toàn cảnh, nhìn từ trên (bật dải vùng điểm giao) và cửa sau — nơi kho và tài xế đứng. */
export const STAGE_VIEWS = [
  { preset: 'goc-cheo', key: 'overview' },
  { preset: 'tren', key: 'zones' },
  { preset: 'cua-sau', key: 'door' },
] as const satisfies readonly { preset: CameraPreset; key: string }[]

/** Nút trên khung tối: 44 px (56 px cảm ứng, chữ 16 px), chữ trắng mờ, đang chọn là kính cyan; vòng focus `--cyan-300`. */
const CONTROL = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-body leading-tight font-semibold',
  'text-sky-text-2 transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass hover:text-sky-text',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
  'pointer-coarse:min-h-14 pointer-coarse:text-body-lg [&_svg]:size-4',
  SKY_FOCUS,
)

/** Điện thoại: hai góc đầu, cuối giữ một dòng, góc giữa (chữ dài nhất) nhận phần còn lại và xuống dòng khi chữ 16 px của máy cảm ứng không vừa. */
export function StageViews({ preset, onPreset, className }: {
  preset: CameraPreset
  onPreset: (preset: CameraPreset) => void
  className?: string
}) {
  const t = useT()
  return (
    <div role="group" aria-label={t('landing.stage.views')}
      className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] rounded-lg border border-landing-hairline bg-canvas-2 p-0.75 sm:flex', className)}>
      {STAGE_VIEWS.map((view) => (
        <button key={view.preset} type="button" aria-pressed={view.preset === preset} onClick={() => onPreset(view.preset)}
          className={cn(CONTROL, 'text-center max-sm:px-2 aria-pressed:bg-cyan-400/20 aria-pressed:text-sky-text aria-pressed:ring-1 aria-pressed:ring-cyan-300/60 aria-pressed:ring-inset')}>
          {t(`landing.stage.view.${view.key}`)}
        </button>
      ))}
    </div>
  )
}

/** "Xếp lại": thùng rỗng rồi xếp lại từ đầu. Không có khi người xem chọn giảm chuyển động — thùng đã đầy ngay, không có gì để xem lại. */
export function StageReplay({ onReplay }: { onReplay: () => void }) {
  const t = useT()
  return (
    <button type="button" onClick={onReplay} aria-label={t('landing.stage.replayLabel')}
      className={cn(CONTROL, 'min-w-11 border border-landing-hairline bg-canvas-2 pointer-coarse:min-w-14')}>
      <RotateCcw aria-hidden strokeWidth={1.5} />
      <span aria-hidden className="hidden sm:inline">{t('landing.stage.replay')}</span>
    </button>
  )
}

/** Chú giải màu điểm giao: số trong vòng màu kèm tên điểm — màu không bao giờ đứng một mình (mục 10). Điểm nào sát cửa: câu dưới khung. */
export function StageLegend({ stopNames }: { stopNames: readonly string[] }) {
  const t = useT()
  return (
    <ul aria-label={t('landing.stage.legend')} className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 sm:flex sm:flex-wrap">
      {stopNames.map((name, index) => {
        const stop = index + 1
        return (
          <li key={stop} className="flex min-w-0 items-center gap-2 text-small text-sky-text-2 pointer-coarse:text-body-lg">
            <StopDot stop={stop} className="size-6 flex-none text-small pointer-coarse:size-7 pointer-coarse:text-body-lg" />
            <span className="sr-only">{t('landing.stage.stop', { number: stop })}: </span>
            <span className="font-medium text-sky-text">{name}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** Số của lần chạy vừa xong trên trình duyệt, kèm MOCK RESULT: kiện đã xếp, lấp đầy, tải trọng, kiện phải dỡ-xếp lại, thời gian tính. */
export function StageReadout({ result }: { result: OptimizationResult }) {
  const t = useT()
  const format = useFormat()
  const { metrics } = result
  const total = metrics.placedCount + metrics.unplacedCount
  const items = [
    { key: 'placed', label: t('landing.stage.readout.placed'), value: t('landing.stage.readout.placedValue', { placed: format.integer(metrics.placedCount), total: format.integer(total) }) },
    { key: 'volume', label: t('landing.stage.readout.volume'), value: format.percent(metrics.volumeUtilizationPercent) },
    { key: 'payload', label: t('landing.stage.readout.payload'), value: format.percent(metrics.payloadUtilizationPercent) },
    ...(metrics.rehandlingCount === undefined ? [] : [{ key: 'rehandling', label: t('landing.stage.readout.rehandling'), value: format.integer(metrics.rehandlingCount) }]),
    { key: 'runtime', label: t('landing.stage.readout.runtime'), value: t('landing.stage.readout.runtimeValue', { ms: format.integer(Math.max(1, Math.round(metrics.runtimeMs))) }) },
  ]
  return (
    <div className="flex flex-col gap-2.5 border-t border-landing-hairline px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="m-0 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg">{t('landing.stage.readout.title')}</p>
        {/* Chữ hổ phách đậm của nhãn không đủ tương phản trên nền tối: dùng bậc 200 */}
        <Badge shape="tag" tone="mock" className={cn('text-amber-200', PUBLIC_TOUCH_TAG)}>MOCK RESULT</Badge>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 md:grid-cols-5">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-col justify-between gap-0.5">
            <dt className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{item.label}</dt>
            <dd className="m-0 font-mono text-h2 leading-7 font-semibold whitespace-nowrap text-sky-text tabular-nums">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
