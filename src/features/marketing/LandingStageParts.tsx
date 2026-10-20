import { ChevronRight, Pause, Play, RotateCcw, Warehouse, type LucideIcon } from 'lucide-react'
import { useId } from 'react'
import { StopDot } from '@/components/StopChip'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Badge } from '@/components/ui/Badge'
import type { OptimizationResult } from '@/domain/models'
import type { StageView } from '@/features/viewer3d/landing/diorama-layout'
import type { StoryStatus } from '@/features/viewer3d/landing/story-clock'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH_TAG } from './public-chrome'
import { Reveal } from './reveal'

/** Ba góc nhìn của khung 3D: toàn sân kho, cận thùng xe, nhìn từ trên (dải vùng điểm giao kèm nhãn). */
export const STAGE_VIEWS = ['overview', 'truck', 'zones'] as const satisfies readonly StageView[]

/**
 * Bề mặt của thẻ, nút và dải số quanh khung 3D: nền tối đặc, không kính (nằm trên cảnh đang chuyển động, đọc lâu). Viền là bóng trong
 * 1 px nên không chiếm chỗ: nhóm nút cao đúng 44 px (56 px cảm ứng), vừa lề trên 72 px của khung.
 */
export const STAGE_SURFACE = 'rounded-md bg-panel-dark shadow-[inset_0_0_0_1px_var(--border-dark)]'

/** Nút trên khung tối: 44 px (56 px cảm ứng, chữ 16 px), chữ trắng mờ, rê chuột là kính sáng; vòng focus `--cyan-300` vẽ vào trong. */
const CONTROL = cn(
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-body leading-tight font-semibold',
  'text-sky-text-2 transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass hover:text-sky-text',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px]',
  'pointer-coarse:min-h-14 pointer-coarse:text-body-lg [&_svg]:size-4 [&_svg]:flex-none',
  SKY_FOCUS,
)

/**
 * Nhóm ba góc nhìn (`aria-pressed`). `inline`: một hàng nằm đè trên khung. `segmented`: dưới khung trên điện thoại, ba cột bằng nhau
 * cao 56 px, chữ 16 px, nhãn dài ("Vùng điểm giao") xuống hai dòng thay vì tràn.
 */
export function StageViews({ view, onChange, layout, className }: {
  view: StageView
  onChange: (view: StageView) => void
  layout: 'inline' | 'segmented'
  className?: string
}) {
  const t = useT()
  const segmented = layout === 'segmented'
  return (
    <div role="group" aria-label={t('landing.stage.views')}
      className={cn(STAGE_SURFACE, 'overflow-hidden', segmented ? 'grid grid-cols-3' : 'inline-flex', className)}>
      {STAGE_VIEWS.map((key) => (
        <button key={key} type="button" aria-pressed={key === view} onClick={() => onChange(key)}
          className={cn(CONTROL, 'text-center aria-pressed:bg-cyan-400/20 aria-pressed:text-sky-text aria-pressed:shadow-[inset_0_0_0_1px_var(--cyan-300)]',
            segmented && 'min-h-14 px-2 text-body-lg text-balance')}>
          {t(`landing.stage.view.${key}`)}
        </button>
      ))}
    </div>
  )
}

type StoryAction = 'pause' | 'resume' | 'replay'

/** Chữ hiện ra là phần đầu của tên truy cập (WCAG 2.5.3): "Tạm dừng" — "Tạm dừng chuyến mẫu". */
const STORY_ACTIONS = {
  pause: { Icon: Pause, text: 'landing.stage.story.pause', label: 'landing.stage.story.pauseLabel' },
  resume: { Icon: Play, text: 'landing.stage.story.resume', label: 'landing.stage.story.resumeLabel' },
  replay: { Icon: RotateCcw, text: 'landing.stage.replay', label: 'landing.stage.replayLabel' },
} as const satisfies Record<StoryAction, { Icon: LucideIcon; text: MessageKey; label: MessageKey }>
const STORY_ORDER = ['pause', 'resume', 'replay'] as const satisfies readonly StoryAction[]

const actionOf = (status: StoryStatus): StoryAction => (status === 'paused' ? 'resume' : status === 'ended' ? 'replay' : 'pause')

/**
 * Một nút ba trạng thái cho chuyện của khung (WCAG 2.2.2): đang chạy → "Tạm dừng" · tạm dừng → "Tiếp tục" · hết → "Xếp lại". Luôn là
 * cùng một phần tử nên focus đứng yên khi bấm; ba chữ chồng trong một ô lưới nên bề rộng không đổi. Chưa bắt đầu: ẩn nhưng giữ chỗ (không
 * nhận focus). Không `aria-pressed`: tên đổi theo việc nút sẽ làm. `compact`: dưới 640 px chỉ còn biểu tượng.
 */
export function StoryButton({ status, onToggle, compact = false, className }: {
  status: StoryStatus
  onToggle: () => void
  compact?: boolean
  className?: string
}) {
  const t = useT()
  const action = actionOf(status)
  const { Icon, label } = STORY_ACTIONS[action]
  return (
    <button type="button" aria-label={t(label)} onClick={onToggle}
      className={cn(CONTROL, STAGE_SURFACE, 'min-w-11 pointer-coarse:min-w-14', compact && 'max-sm:min-w-14 max-sm:px-0', status === 'idle' && 'invisible', className)}>
      <Icon aria-hidden strokeWidth={1.5} />
      <span aria-hidden className={cn('grid justify-items-start', compact && 'max-sm:hidden')}>
        {STORY_ORDER.map((key) => (
          <span key={key} className={cn('[grid-area:1/1] whitespace-nowrap', key !== action && 'invisible')}>{t(STORY_ACTIONS[key].text)}</span>
        ))}
      </span>
    </button>
  )
}

const ROUTE_ITEM = 'flex min-w-0 items-center gap-2 text-small text-sky-text-2 pointer-coarse:text-body-lg'

/**
 * Hàng "Thứ tự giao" dưới khung: kho rồi bốn điểm giao theo thứ tự đi, mỗi điểm số trong vòng màu kèm tên — màu không bao giờ đứng
 * một mình (mục 10), câu "Màu của kiện theo điểm giao" là mô tả của danh sách. Điện thoại: hai cột, bỏ mũi tên.
 */
export function StageRoute({ stopNames, className }: { stopNames: readonly string[]; className?: string }) {
  const t = useT()
  const titleId = useId()
  const legendId = useId()
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p id={titleId} className="m-0 text-small font-semibold text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.stage.route')}</p>
      <span id={legendId} className="sr-only">{t('landing.stage.legend')}</span>
      <ol aria-labelledby={titleId} aria-describedby={legendId}
        className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 md:flex md:flex-wrap md:items-center md:gap-x-2.5">
        <li className={ROUTE_ITEM}>
          <span aria-hidden className="grid size-6 flex-none place-items-center rounded-sm bg-panel-dark text-cyan-300 shadow-[inset_0_0_0_1px_var(--border-dark)] pointer-coarse:size-7">
            <Warehouse className="size-3.5" strokeWidth={1.5} />
          </span>
          <span className="font-medium text-sky-text">{t('landing.stage.depot')}</span>
        </li>
        {stopNames.map((name, index) => (
          <li key={name} className={ROUTE_ITEM}>
            <ChevronRight aria-hidden strokeWidth={1.5} className="size-4 flex-none text-sky-text-3 max-md:hidden" />
            <StopDot stop={index + 1} className="size-6 text-small pointer-coarse:size-7 pointer-coarse:text-body-lg" />
            <span className="sr-only">{t('landing.stage.stop', { number: index + 1 })}: </span>
            <span className="font-medium text-sky-text">{name}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

type ReadoutCell = { key: string; label: MessageKey; value: string }
const CELL_LABELS = ['placed', 'volume', 'payload', 'rehandling', 'runtime'] as const

/** Năm ô cùng bố cục cho bản giữ chỗ (chỉ nhãn) và bản có số: dải không đổi chiều cao khi số hiện ra. */
const CELLS = 'm-0 grid grid-cols-2 gap-x-4 gap-y-3 [grid-area:1/1] sm:grid-cols-3 md:grid-cols-5'
const CELL = 'flex min-w-0 flex-col justify-end gap-0.5'
const LABEL = 'text-small text-sky-text-3 pointer-coarse:text-body-lg'
const VALUE = 'm-0 font-mono text-h2 leading-7 font-semibold whitespace-nowrap text-sky-text tabular-nums'

/**
 * Dải số của lần chạy, dưới khung. Trước khi xếp xong: một câu chờ, cùng chiều cao (năm ô nhãn trong suốt giữ chỗ) — số của lần chạy
 * chỉ hiện khi đã có. Xếp xong: MOCK RESULT và năm ô — kiện đã xếp / kiện của yêu cầu, lấp đầy, tải trọng, kiện phải dỡ-xếp lại, thời gian
 * tính — bật ra lần lượt cách nhau 70 ms; số không đếm, không lăn.
 */
export function StageReadout({ result, total, className }: { result: OptimizationResult | null; total: number; className?: string }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const metrics = result?.metrics
  const cells: ReadoutCell[] = !result || !metrics ? CELL_LABELS.map((key) => ({ key, label: `landing.stage.readout.${key}`, value: ' ' })) : [
    { key: 'placed', label: 'landing.stage.readout.placed', value: t('landing.stage.readout.placedValue', { placed: format.integer(result.placements.length), total: format.integer(total) }) },
    { key: 'volume', label: 'landing.stage.readout.volume', value: format.percent(metrics.volumeUtilizationPercent) },
    { key: 'payload', label: 'landing.stage.readout.payload', value: format.percent(metrics.payloadUtilizationPercent) },
    ...(metrics.rehandlingCount === undefined ? [] : [{ key: 'rehandling', label: 'landing.stage.readout.rehandling', value: format.integer(metrics.rehandlingCount) } as const]),
    { key: 'runtime', label: 'landing.stage.readout.runtime', value: t('landing.stage.readout.runtimeValue', { ms: format.integer(Math.max(1, Math.round(metrics.runtimeMs))) }) },
  ]
  // Cổng hiện ra là cả dải (lộ 15 % là đủ, kể cả khi dải nằm sát mép dưới cửa sổ): ô số gắn vào lúc xếp xong thì bật ra ngay nếu dải
  // đang trong khung nhìn, còn không thì chờ tới khi cuộn tới
  return (
    <Reveal group role="group" aria-labelledby={titleId} data-stage-readout="" className={cn(STAGE_SURFACE, 'flex flex-col gap-2.5 rounded-lg px-4 py-3', className)}>
      <div className="flex min-h-5 flex-wrap items-center gap-2 pointer-coarse:min-h-7">
        <p id={titleId} className="m-0 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg">{t('landing.stage.readout.title')}</p>
        {/* Chữ hổ phách đậm của nhãn không đủ tương phản trên nền tối: dùng bậc 200 */}
        {result ? <Badge shape="tag" tone="mock" className={cn('text-amber-200', PUBLIC_TOUCH_TAG)}>MOCK RESULT</Badge> : null}
      </div>
      <div className="grid">
        {result ? (
          <dl className={CELLS}>
            {cells.map((cell, index) => (
              <Reveal key={cell.key} kind="pop" index={index} className={CELL}>
                <dt className={LABEL}>{t(cell.label)}</dt>
                <dd className={VALUE}>{cell.value}</dd>
              </Reveal>
            ))}
          </dl>
        ) : (
          <>
            <dl aria-hidden className={cn(CELLS, 'invisible')}>
              {cells.map((cell) => (
                <div key={cell.key} className={CELL}>
                  <dt className={LABEL}>{t(cell.label)}</dt>
                  <dd className={VALUE}>{cell.value}</dd>
                </div>
              ))}
            </dl>
            <p className="m-0 self-center text-small text-sky-text-3 [grid-area:1/1] pointer-coarse:text-body-lg">{t('landing.stage.readout.pending')}</p>
          </>
        )}
      </div>
    </Reveal>
  )
}
