import { createElement, useCallback, useContext, useMemo, type AnimationEvent, type HTMLAttributes, type ReactNode, type Ref, type RefCallback } from 'react'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { delayValue, RevealScopeContext, withVars } from './reveal-runtime'

/** Kiểu hiện ra của một khối (`reveal.css`): nhô lên, hiện dần, bật nhẹ, mở ngang (không cắt dấu chồng), vạch kéo từ trái sang. */
export type RevealKind = 'rise' | 'fade' | 'pop' | 'wipe' | 'fill-x'

/** Thẻ HTML mà `Reveal` vẽ: khối, mục danh sách, đoạn chữ. Cần bọc component thì đặt component bên trong `Reveal`. */
export type RevealTag =
  | 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'figure' | 'figcaption'
  | 'ul' | 'ol' | 'li' | 'dl' | 'dt' | 'dd' | 'p' | 'span' | 'h3' | 'h4' | 'small' | 'strong'

type RevealProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'className'> & {
  as?: RevealTag
  kind?: RevealKind
  /** Nhóm: không tự chuyển động, chỉ làm cổng chung — các `Reveal`, `RevealWords`, `Odometer` bên trong chạy theo lúc nhóm lộ. */
  group?: boolean
  /** Mili giây sau lúc cổng mở, cộng dồn với mốc của khối bao quanh. */
  delay?: number
  /** Thứ tự trong nhóm: so le `index × --stagger-item` (70 ms) và đặt `--i` cho CSS riêng. */
  index?: number
  /**
   * Ngưỡng lộ riêng (0–1) thay 15 %, chỉ khi khối tự làm cổng (`data-reveal-at`). Observer chung báo ở 0, 7 % và 15 %, nên ngưỡng khác
   * mở ở bậc kế tiếp từ dưới lên.
   */
  at?: number
  className?: string
  children?: ReactNode
  ref?: Ref<HTMLElement>
}

/** Gắn phần tử vào ref của nơi gọi, trả cleanup. Hàm thường (ngoài hook): ghi `ref.current` ở đây không phải sửa tham số của hook. */
function attachRef(ref: Ref<HTMLElement> | undefined, el: HTMLElement | null): (() => void) | undefined {
  if (typeof ref === 'function') {
    const cleanup = ref(el)
    return typeof cleanup === 'function' ? cleanup : () => ref(null)
  }
  if (!ref) return undefined
  ref.current = el
  return () => {
    ref.current = null
  }
}

/** Gộp ref cổng (nếu có) với ref của nơi gọi thành một ref callback (React 19: ref callback trả cleanup). */
function useMergedRef(gate: RefCallback<HTMLElement> | null, outer: Ref<HTMLElement> | undefined): RefCallback<HTMLElement> {
  return useCallback(
    (el: HTMLElement | null) => {
      const gateCleanup = gate?.(el)
      const outerCleanup = attachRef(outer, el)
      return () => {
        if (typeof gateCleanup === 'function') gateCleanup()
        outerCleanup?.()
      }
    },
    [gate, outer],
  )
}

/**
 * Khối hiện ra một lần khi cuộn tới. Đứng riêng thì tự làm cổng (theo dõi chính nó); nằm trong `Reveal group` (hay khối `Reveal` khác)
 * thì chạy theo cổng bao quanh, mốc cộng dồn. Chuyển động tắt: vẽ đúng phần tử như không bọc gì. Chạy xong nhận `data-done` — CSS bỏ hẳn
 * animation, phần tử về đúng style của nó.
 */
export function Reveal({ as = 'div', kind = 'rise', group = false, delay = 0, index, at, className, children, style, ref, onAnimationEnd, ...rest }: RevealProps) {
  const motion = useRevealMotion()
  const parent = useContext(RevealScopeContext)
  const gateRef = useRevealRef<HTMLElement>()
  const mergedRef = useMergedRef(parent ? null : gateRef, ref)
  const steps = (parent?.steps ?? 0) + (index ?? 0)
  const ms = (parent?.ms ?? 0) + delay
  const scope = useMemo(() => ({ steps, ms }), [steps, ms])

  if (!motion) return createElement(as, { ...rest, ref: mergedRef, className, style, onAnimationEnd }, children)

  const handleAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    onAnimationEnd?.(event)
    const name = event.animationName
    if (!group && event.target === event.currentTarget && typeof name === 'string' && name.startsWith('reveal-')) {
      event.currentTarget.setAttribute('data-done', '')
    }
  }
  return (
    <RevealScopeContext value={scope}>
      {createElement(
        as,
        {
          ...rest,
          ref: mergedRef,
          'data-reveal': group ? undefined : kind,
          'data-reveal-group': group ? '' : undefined,
          'data-reveal-at': at !== undefined && !parent ? at : undefined,
          className,
          style: withVars({ '--reveal-delay': delayValue(scope), '--i': index }, style),
          onAnimationEnd: handleAnimationEnd,
        },
        children,
      )}
    </RevealScopeContext>
  )
}
