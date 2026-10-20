import { useContext, useState, type AnimationEvent, type HTMLAttributes, type ReactNode } from 'react'
import { useLocale } from '@/lib/i18n'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { delayValue, RevealScopeContext, withVars } from './reveal-runtime'
import { flowStagger, flowWords } from './split-text'

type FlowHeadingProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'id'> & {
  /** Thẻ vẽ ra: tiêu đề, đoạn chữ, hay `span` khi nằm trong một phần tử chữ khác. */
  as: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'span'
  /** Chữ của tiêu đề — đã dịch, nguyên văn (khoảng trắng không ngắt giữ từ ghép trên một dòng). */
  text: string
  /** Nội dung đứng trước chữ, ngoài hiệu ứng — vd. tiền tố `sr-only` "Bước 1:". Có mặt ở cả hai chế độ. */
  before?: ReactNode
  /** Mili giây sau lúc cổng mở, cộng dồn với mốc của khối bao quanh. */
  delay?: number
  id?: string
  className?: string
}

/**
 * Tiêu đề "chảy chữ": khi lộ ra, từng grapheme (dấu tiếng Việt không bao giờ rời chữ — `graphemes` sau NFC) nhô lên từ 0,55 em, hiện dần
 * và đi qua màu sóng (`--reveal-ink-wave`: `--primary` trên nền sáng, `--cyan-300` trên nền tối) rồi về màu của chính tiêu đề — một con sóng
 * chạy từ chữ đầu tới chữ cuối, cả tiêu đề so le không quá 720 ms (`flowStagger`). Chạy một lần, chỉ transform, opacity và màu.
 *
 * - Chuyển động tắt (jsdom, giảm chuyển động, ngoài `RevealProvider` như `/bang-gia`): đúng `<as>{before}{text}</as>`.
 * - Bật: `before`, một bản `sr-only select-none` giữ tên truy cập đúng từng chữ, và một bản `aria-hidden` tách grapheme — mỗi từ một
 *   `span` không ngắt dòng bên trong (chỉ xuống dòng ở khoảng trắng như chữ thường), mỗi grapheme một `inline-block`. Cấu trúc giữ nguyên
 *   sau khi chạy (không đổi bố cục, không CLS); chạy xong nhận `data-flow-done` để bỏ animation.
 * - Đứng riêng thì tự làm cổng (lộ 15 % mới chạy); trong `Reveal group` hay khối `Reveal` khác thì chạy theo cổng đó, mốc cộng dồn.
 *   Gắn lại với `key` mới (vd. đổi bước trong khung dính) khi cổng đã mở: chạy lại ngay.
 */
export function FlowHeading({ as: Tag, text, before, delay = 0, id, className, style, onAnimationEnd, ...rest }: FlowHeadingProps) {
  const motion = useRevealMotion()
  const { locale } = useLocale()
  const parent = useContext(RevealScopeContext)
  const gateRef = useRevealRef<HTMLElement>()
  const [settled, setSettled] = useState(false)
  const { parts, count } = flowWords(text, locale)

  if (!motion || count === 0) {
    return (
      <Tag id={id} className={className} style={style} onAnimationEnd={onAnimationEnd} {...rest}>
        {before}
        {text}
      </Tag>
    )
  }

  const pieces: ReactNode[] = []
  for (const [key, { chars, space, start }] of parts.entries()) {
    if (chars.length > 0) {
      pieces.push(
        <span key={key} className="reveal-flow-word">
          {chars.map((char, offset) => {
            const index = start + offset
            return (
              <span key={offset} className="reveal-flow-char reveal-piece" style={withVars({ '--c': index })} data-last={index === count - 1 ? '' : undefined}>
                {char}
              </span>
            )
          })}
        </span>,
      )
    }
    if (space) pieces.push(space)
  }
  const scope = { steps: parent?.steps ?? 0, ms: (parent?.ms ?? 0) + delay }
  const handleAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    onAnimationEnd?.(event)
    if (event.target instanceof Element && event.target.hasAttribute('data-last')) setSettled(true)
  }
  return (
    <Tag
      ref={parent ? undefined : gateRef}
      id={id}
      className={className}
      style={withVars({ '--reveal-delay': delayValue(scope), '--flow-step': `${flowStagger(count).toFixed(2)}ms` }, style)}
      data-flow-done={settled ? '' : undefined}
      onAnimationEnd={handleAnimationEnd}
      {...rest}
    >
      {before}
      <span className="sr-only select-none">{text}</span>
      <span aria-hidden="true" data-flow="" key={text}>
        {pieces}
      </span>
    </Tag>
  )
}
