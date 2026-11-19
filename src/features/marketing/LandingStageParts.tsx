import { Pause, Play, RotateCcw, type LucideIcon } from 'lucide-react'
import { SKY_FOCUS } from '@/components/sky-focus'
import type { StageView } from '@/features/viewer3d/landing/diorama-layout'
import type { StoryStatus } from '@/features/viewer3d/landing/story-clock'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** Ba góc nhìn của khung 3D: toàn sân kho, cận thùng xe, nhìn từ trên (dải vùng điểm giao kèm nhãn). */
export const STAGE_VIEWS = ['overview', 'truck', 'zones'] as const satisfies readonly StageView[]

/**
 * Bề mặt của thẻ, nút và dải số quanh khung 3D: nền tối đặc, không kính (nằm trên cảnh đang chuyển động, đọc lâu). Viền là bóng trong
 * 1 px nên không chiếm chỗ: nhóm nút cao đúng 44 px (56 px cảm ứng), vừa lề trên 72 px của khung.
 */
export const STAGE_SURFACE = 'rounded-md bg-panel-dark shadow-[inset_0_0_0_1px_var(--border-dark)]'

/** Nút trên khung tối: 44 px (56 px cảm ứng, chữ 16 px), chữ trắng mờ, rê chuột là kính sáng; vòng focus `--cyan-300` vẽ vào trong. */
export const CONTROL = cn(
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
            // Chế độ tương phản cao bỏ nền và bóng: viền đáy trong suốt được tô màu chữ của hệ thống, thành vạch 4 px dưới góc đang chọn
            'forced-colors:aria-pressed:border-b-4 forced-colors:aria-pressed:border-transparent',
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
