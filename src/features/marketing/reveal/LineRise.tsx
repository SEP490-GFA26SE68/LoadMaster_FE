import { useContext, useState, type AnimationEvent, type HTMLAttributes, type ReactNode } from 'react'
import { useLocale } from '@/lib/i18n'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { delayValue, RevealScopeContext, withVars } from './reveal-runtime'
import { sentences } from './split-text'

type LineRiseProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className' | 'id'> & {
  /** Thẻ vẽ ra. Mỗi dòng là một khối bên trong nó. */
  as: 'h1' | 'h2' | 'h3' | 'p' | 'div'
  /**
   * Các dòng theo thứ tự, mỗi dòng một khối (dòng dài vẫn tự xuống dòng bên trong). Một chuỗi thì tách theo câu của ngôn ngữ đang chọn
   * (`sentences`): mỗi câu một dòng.
   */
  lines: string | readonly string[]
  /**
   * Nội dung trang trí của một dòng khi chuyển động bật (mặc định: chữ của dòng) — vd. từng từ sáng dần theo cuộn. Bản đọc được là bản
   * `sr-only`, nên nội dung này nằm trong khối `aria-hidden`. Chuyển động tắt: luôn là chữ của dòng.
   */
  renderLine?: (line: string, index: number) => ReactNode
  /** Mili giây sau lúc cổng mở, cộng dồn với mốc của khối bao quanh. */
  delay?: number
  id?: string
  className?: string
}

/**
 * Chữ nhô lên từng dòng: mỗi dòng nằm trong một mặt nạ (`clip-path`, chừa chỗ cho dấu chồng và phần dưới chân chữ), chữ đi lên từ dưới mép
 * mặt nạ và hiện dần, dòng sau cách dòng trước `--stagger-item` × 2 (140 ms). Chạy một lần khi lộ ra; chỉ transform và opacity.
 *
 * - Hai chế độ cùng một bố cục: mỗi dòng luôn là một khối (`reveal-line`), khoảng trắng giữa hai dòng là nút chữ — không CLS khi bật/tắt.
 * - Chuyển động tắt (jsdom, giảm chuyển động, ngoài `RevealProvider`): các dòng là chữ thường, không bản sao nào.
 * - Bật: một bản `sr-only select-none` đọc cả đoạn liền một lần và các dòng `aria-hidden` (nội dung của `renderLine` nếu có). Chạy xong
 *   nhận `data-lines-done`: mặt nạ và animation bỏ hẳn.
 * - Đứng riêng thì tự làm cổng; trong `Reveal group` thì chạy theo nhóm, mốc cộng dồn.
 */
export function LineRise({ as: Tag, lines, renderLine, delay = 0, id, className, style, onAnimationEnd, ...rest }: LineRiseProps) {
  const motion = useRevealMotion()
  const { locale } = useLocale()
  const parent = useContext(RevealScopeContext)
  const gateRef = useRevealRef<HTMLElement>()
  const [settled, setSettled] = useState(false)
  const list = typeof lines === 'string' ? sentences(lines, locale) : [...lines]
  const last = list.length - 1

  const blocks = (live: boolean) =>
    list.flatMap((line, index) => {
      const block = live ? (
        <span key={index} className="reveal-line">
          <span className="reveal-line-inner reveal-piece" style={withVars({ '--l': index })} data-last={index === last ? '' : undefined}>
            {renderLine ? renderLine(line, index) : line}
          </span>
        </span>
      ) : (
        <span key={index} className="reveal-line">
          {line}
        </span>
      )
      return index === last ? [block] : [block, ' ']
    })

  if (!motion || list.length === 0) {
    return (
      <Tag id={id} className={className} style={style} onAnimationEnd={onAnimationEnd} {...rest}>
        {blocks(false)}
      </Tag>
    )
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
      style={withVars({ '--reveal-delay': delayValue(scope) }, style)}
      data-lines-done={settled ? '' : undefined}
      onAnimationEnd={handleAnimationEnd}
      {...rest}
    >
      <span className="sr-only select-none">{list.join(' ')}</span>
      <span aria-hidden="true" className="block" data-lines="">
        {blocks(true)}
      </span>
    </Tag>
  )
}
