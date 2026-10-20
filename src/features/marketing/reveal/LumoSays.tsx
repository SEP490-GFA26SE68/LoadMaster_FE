import { useState, type AnimationEvent } from 'react'
import { Lumo, LUMO_NAME, type LumoPose } from '@/components/brand/Lumo'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { withVars } from './reveal-runtime'
import { useLumoSwap } from './useLumoSwap'
import { useTyping } from './useTyping'
import './lumo-says.css'

/** Cỡ Lumo theo bề rộng màn (px CSS): dưới 768 · từ 768 · từ 1.280 · từ 1.440; bậc thiếu lấy bậc nhỏ hơn. */
export type LumoSizes = { base: number; md?: number; xl?: number; wide?: number }

type LumoSaysProps = {
  pose: LumoPose
  /** Cỡ hiển thị — không quá nửa cạnh ảnh (`LUMO_ASSET_PX`). Một số, hoặc cỡ theo bề rộng màn. */
  px: number | LumoSizes
  text: string
  /** Bong bóng nằm bên trái hay bên phải Lumo; đuôi luôn chỉ vào Lumo. Ảnh không bao giờ lật. */
  side: 'bubble-left' | 'bubble-right'
  /** Thời gian gõ tối đa của một câu: 1.400 ms ở các phần, 1.000 ms cho lời dẫn khung 3D. */
  budgetMs?: number
  /** Giữ nguyên chữ đang gõ. */
  paused?: boolean
  /** `view`: chạy khi cuộn tới · `mount`: chạy ngay khi gắn (phần mở đầu). */
  trigger?: 'view' | 'mount'
  loading?: 'eager' | 'lazy'
  /** Mili giây sau lúc lộ mới bắt đầu vào; chữ gõ sau đó thêm 300 ms. */
  delay?: number
  className?: string
  bubbleClassName?: string
}

/** Tư thế bán thân: ló lên trên một cạnh ngang, cạnh che khoảng 12 % đáy ảnh (CSS `[data-bust]`). */
const BUSTS: ReadonlySet<LumoPose> = new Set<LumoPose>(['explain', 'idea', 'wink'])
/** Chữ bắt đầu gõ sau khi Lumo bắt đầu vào chừng này. */
const TYPE_LEAD_MS = 300

const toPx = (value: number | undefined) => (value === undefined ? undefined : `${value}px`)

/**
 * Thuộc tính `sizes` của ảnh Lumo theo cùng các bậc bề rộng với `lumo-says.css` (768 · 1.280 · 1.440 px): trình duyệt được chọn bản nửa
 * cạnh khi đủ nét. Nơi tải sẵn ảnh (`new Image()`) dùng đúng chuỗi này cùng `lumoSrcSet` để ảnh không tải hai lần.
 */
export function lumoSizesAttr({ base, md, xl, wide }: LumoSizes): string {
  return [
    wide === undefined ? null : `(min-width: 1440px) ${wide}px`,
    xl === undefined ? null : `(min-width: 1280px) ${xl}px`,
    md === undefined ? null : `(min-width: 768px) ${md}px`,
    `${base}px`,
  ].filter((part) => part !== null).join(', ')
}

/**
 * Lumo nói một câu: ảnh Lumo (`aria-hidden`) và bong bóng chữ — tiền tố `sr-only` "Lumo nói:", không `aria-live` (lời dẫn không tự đọc to).
 * Hàng `flex items-end`: Lumo đứng (hay ló lên, tư thế bán thân) trên mép dưới của hàng, đuôi bong bóng chỉ vào ngang miệng Lumo — đặt hàng
 * ngay trên cạnh mà Lumo ló lên. Chuyển động bật: vào một lần (nhô lên 600 ms, bong bóng bật ra từ đuôi), gõ theo grapheme trong `budgetMs`,
 * nhún một cái khi gõ xong; đổi `text` là gõ câu mới, đổi `pose` là mờ chéo hai ảnh sau khi ảnh mới giải mã xong, kèm một cái nhún. Không
 * lặp. Chuyển động tắt: ảnh đứng yên, chữ đủ ngay. Bong bóng luôn nền sáng đặc (đọc được trên nền tối lẫn nền sáng), xuống dòng trong cột
 * hẹp. Có cổng riêng: trong `Reveal group` vẫn chạy theo lúc chính nó lộ.
 */
export function LumoSays({
  pose,
  px,
  text,
  side,
  budgetMs = 1400,
  paused = false,
  trigger = 'view',
  loading = 'lazy',
  delay = 0,
  className,
  bubbleClassName,
}: LumoSaysProps) {
  const t = useT()
  const { locale } = useLocale()
  const motion = useRevealMotion()
  const [shown, setShown] = useState<'no' | 'yes' | 'instant'>('no')
  const gateRef = useRevealRef<HTMLDivElement>((instant) => setShown(instant ? 'instant' : 'yes'), trigger)
  const [hops, setHops] = useState(0)
  const hop = () => setHops((count) => count + 1)
  const live = motion && shown !== 'no'
  const { done: typed, typedRef, restRef } = useTyping({ text, locale, budgetMs, paused, started: live, leadMs: delay + TYPE_LEAD_MS, instant: !motion || shown === 'instant', onDone: hop })
  const { swap, nextRef, finish } = useLumoSwap(pose, live && shown !== 'instant')
  const sizes = typeof px === 'number' ? { base: px } : px
  const sizesHint = lumoSizesAttr(sizes)

  const handleFadeEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target !== event.currentTarget) return
    finish()
    hop()
  }
  const bubble = (
    <p
      data-side={side}
      className={cn(
        // Không đặt margin dưới: utilities thắng lớp nâng bong bóng lên ngang miệng Lumo (`lumo-says.css`)
        'reveal-bubble reveal-piece relative mx-0 mt-0 min-w-0 max-w-md rounded-lg border border-border bg-bg px-4 py-3 text-body-lg text-pretty text-ink-strong',
        bubbleClassName,
      )}
    >
      <span className="sr-only">{t('landingStory.lumo.says', { name: LUMO_NAME })}</span>{' '}
      {typed ? (
        text
      ) : (
        <>
          <span className="sr-only select-none">{text}</span>
          <span aria-hidden="true" key={text}>
            <span ref={typedRef} />
            <span ref={restRef} className="reveal-type-rest" />
          </span>
        </>
      )}
    </p>
  )
  const figure = (
    <div className="reveal-lumo-fig">
      <div className="reveal-lumo-rise reveal-piece">
        <div className="reveal-lumo-hop reveal-piece" data-hop={hops === 0 ? undefined : hops % 2 === 1 ? 'a' : 'b'}>
          <span key={swap.current} className="reveal-lumo-layer reveal-piece" data-state={swap.fading ? 'leave' : 'current'}>
            <Lumo pose={swap.current} px={sizes.base} sizes={sizesHint} loading={loading} className="reveal-lumo-img" />
          </span>
          {swap.next ? (
            <span
              key={swap.next}
              ref={nextRef}
              className="reveal-lumo-layer reveal-piece"
              data-state={swap.fading ? 'enter' : 'next'}
              onAnimationEnd={handleFadeEnd}
            >
              <Lumo pose={swap.next} px={sizes.base} sizes={sizesHint} className="reveal-lumo-img" />
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
  return (
    <div
      ref={gateRef}
      data-side={side}
      data-bust={BUSTS.has(swap.next ?? swap.current) ? '' : undefined}
      className={cn('reveal-lumo flex items-end gap-3', className)}
      style={withVars({
        '--lumo-px-base': toPx(sizes.base),
        '--lumo-px-md': toPx(sizes.md),
        '--lumo-px-xl': toPx(sizes.xl),
        '--lumo-px-wide': toPx(sizes.wide),
        '--reveal-delay': `${Math.round(delay)}ms`,
      })}
    >
      {side === 'bubble-left' ? bubble : figure}
      {side === 'bubble-left' ? figure : bubble}
    </div>
  )
}
