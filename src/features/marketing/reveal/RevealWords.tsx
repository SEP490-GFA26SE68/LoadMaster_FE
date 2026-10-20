import { useContext, useState, type AnimationEvent, type HTMLAttributes, type ReactNode } from 'react'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { delayValue, RevealScopeContext, withVars } from './reveal-runtime'
import { inkStagger, words, wordStagger } from './split-text'

type RevealWordsProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'id' | 'tabIndex'> & {
  as: 'h1' | 'h2' | 'h3' | 'p'
  text: string
  /** `rise`: từng từ nhô lên (tiêu đề) · `ink`: từng từ đậm dần từ 18 % (đoạn văn). */
  mode: 'rise' | 'ink'
  /** Mili giây sau lúc cổng mở, cộng dồn với mốc của khối bao quanh. */
  delay?: number
  id?: string
  className?: string
  tabIndex?: number
}

/**
 * Chữ hiện theo từng từ. Chuyển động tắt (jsdom, giảm chuyển động, ngoài `RevealProvider`): đúng `<as>{text}</as>` như chưa có hệ này.
 * Bật: một bản `sr-only select-none` giữ tên truy cập đúng từng chữ và một bản `aria-hidden` tách theo từ — chữ thường, khoảng trắng là
 * nút chữ thật nên xuống dòng và sao chép như cũ. `rise` giữ nguyên cấu trúc này sau khi chạy (tiêu đề), `ink` chạy xong thì trở lại một
 * nút chữ. Đứng riêng thì tự làm cổng; trong `Reveal group` thì chạy theo nhóm.
 */
export function RevealWords({ as: Tag, text, mode, delay = 0, id, className, tabIndex, style, onAnimationEnd, ...rest }: RevealWordsProps) {
  const motion = useRevealMotion()
  const parent = useContext(RevealScopeContext)
  const gateRef = useRevealRef<HTMLElement>()
  const [settled, setSettled] = useState(false)
  const parts = words(text)
  const count = parts.reduce((sum, part) => sum + (part.word ? 1 : 0), 0)

  if (!motion || count === 0 || (settled && mode === 'ink')) {
    return (
      <Tag id={id} tabIndex={tabIndex} className={className} style={style} onAnimationEnd={onAnimationEnd} {...rest}>
        {text}
      </Tag>
    )
  }

  const pieceClass = mode === 'rise' ? 'reveal-word reveal-piece' : 'reveal-ink reveal-piece'
  const pieces: ReactNode[] = []
  let index = 0
  for (const [key, part] of parts.entries()) {
    if (part.word) {
      pieces.push(
        <span key={key} className={pieceClass} style={withVars({ '--w': index })} data-last={index === count - 1 ? '' : undefined}>
          {part.word}
        </span>,
      )
      index += 1
    }
    if (part.space) pieces.push(part.space)
  }
  const step = mode === 'rise' ? `min(var(--stagger-word), ${wordStagger(count).toFixed(2)}ms)` : `${inkStagger(count).toFixed(2)}ms`
  const scope = { steps: parent?.steps ?? 0, ms: (parent?.ms ?? 0) + delay }

  const handleAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    onAnimationEnd?.(event)
    if (event.target instanceof Element && event.target.hasAttribute('data-last')) setSettled(true)
  }
  return (
    <Tag
      ref={parent ? undefined : gateRef}
      id={id}
      tabIndex={tabIndex}
      className={className}
      style={withVars({ '--reveal-delay': delayValue(scope), '--word-step': step }, style)}
      data-done={settled ? '' : undefined}
      onAnimationEnd={handleAnimationEnd}
      {...rest}
    >
      <span className="sr-only select-none">{text}</span>
      <span aria-hidden="true" data-words={mode} key={text}>
        {pieces}
      </span>
    </Tag>
  )
}
