import { useEffect } from 'react'
import { LUMO_POSES, type LumoPose } from '@/components/brand/Lumo'
import { useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LumoSays, type LumoSizes } from './reveal'
import { withVars } from './reveal/reveal-runtime'
import type { HeroPhase } from './useStoryDriver'

/** Câu Lumo đang nói: theo pha của chuyện, câu "còn kiện chưa xếp" khi phương án không xếp hết, và câu của hình dự phòng. */
export type NarratorLine = HeroPhase | 'readyPartial' | 'fallback'

/** Mỗi câu một tư thế, theo nghĩa cố định của tư thế (AGENTS "Thương hiệu"): máy tính bảng lúc tính, mang kiện lúc nhập, chỉ lúc xếp. */
const LINES = {
  preparing: ['tablet', 'landingStory.lumo.hero.preparing'],
  intake: ['carry', 'landingStory.lumo.hero.intake'],
  optimize: ['tablet', 'landingStory.lumo.hero.optimize'],
  loading: ['point', 'landingStory.lumo.hero.loading'],
  ready: ['done', 'landingStory.lumo.hero.ready'],
  readyPartial: ['point', 'landingStory.lumo.hero.readyPartial'],
  fallback: ['point', 'landingStory.lumo.hero.fallback'],
} as const satisfies Record<NarratorLine, readonly [LumoPose, MessageKey]>

const STORY_LINES = ['preparing', 'intake', 'optimize', 'loading', 'ready', 'readyPartial'] as const satisfies readonly NarratorLine[]
/** Tư thế của lời dẫn, tải sẵn khi khung 3D bắt đầu tải để lúc đổi pha không chờ ảnh. */
const HERO_POSES = ['tablet', 'carry', 'point', 'done'] as const satisfies readonly LumoPose[]
/** 96 px dưới 768 · 128 px tới 1.439 · 144 px từ 1.440 (không quá nửa cạnh ảnh 512 px). Hình dự phòng: 96 · 128. */
const SIZES = { base: 96, md: 128, wide: 144 } as const satisfies LumoSizes
const FALLBACK_SIZES = { base: 96, md: 128 } as const satisfies LumoSizes
const toPx = (value: number) => `${value}px`

/** Bong bóng nằm đè trên khung (từ 1.280 px) rộng cố định 320 / 352 px; thành hàng dưới khung thì lấy phần còn lại, tối đa 544 px. */
const BUBBLE = { overlay: 'w-80 flex-none min-[90rem]:w-88', row: 'flex-1 md:max-w-[34rem]' } as const

/**
 * Lumo dẫn chuyện của khung 3D (`LumoSays`, `budgetMs` 1.000, chữ dừng gõ khi chuyện bị giữ). Câu đổi bốn lần trong một chuyện, nên hộp
 * giữ chỗ theo câu dài nhất: một bản trong suốt `aria-hidden` cùng cỡ chồng tất cả các câu vào một ô lưới — hàng dưới khung không nhảy khi
 * Lumo đổi câu. `line` rỗng: chỉ giữ chỗ (trang chưa tải khung 3D). Câu của hình dự phòng không đổi nên không cần giữ chỗ.
 */
export function StoryNarrator({ line, paused = false, layout, preload = false, className }: {
  line: NarratorLine | null
  paused?: boolean
  layout: 'overlay' | 'row'
  /** Tải sẵn ảnh các tư thế của lời dẫn. */
  preload?: boolean
  className?: string
}) {
  const t = useT()
  useEffect(() => {
    if (!preload) return
    for (const pose of HERO_POSES) {
      const image = new Image()
      image.decoding = 'async'
      image.src = LUMO_POSES[pose]
    }
  }, [preload])

  const bubble = BUBBLE[layout]
  const spoken = line ? LINES[line] : null
  return (
    <div className={cn('grid', className)}>
      {line === 'fallback' ? null : (
        <div aria-hidden className="reveal-lumo invisible flex items-end gap-3 [grid-area:1/1]"
          style={withVars({ '--lumo-px-base': toPx(SIZES.base), '--lumo-px-md': toPx(SIZES.md), '--lumo-px-wide': toPx(SIZES.wide) })}>
          <div className="reveal-lumo-fig" />
          <p className={cn('reveal-bubble relative m-0 grid min-w-0 max-w-md rounded-lg border px-4 py-3 text-body-lg', bubble)}>
            {STORY_LINES.map((key) => <span key={key} className="[grid-area:1/1]">{t(LINES[key][1])}</span>)}
          </p>
        </div>
      )}
      {spoken ? (
        <LumoSays pose={spoken[0]} px={line === 'fallback' ? FALLBACK_SIZES : SIZES} text={t(spoken[1])} side="bubble-right" budgetMs={1000} paused={paused} trigger="mount"
          loading="eager" className="self-end [grid-area:1/1]" bubbleClassName={bubble} />
      ) : null}
    </div>
  )
}
