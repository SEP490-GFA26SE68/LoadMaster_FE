import { useContext, useState, type AnimationEvent } from 'react'
import { useRevealMotion, useRevealRef } from './RevealProvider'
import { delayValue, RevealScopeContext, withVars } from './reveal-runtime'
import { odometerParts } from './split-text'

/** Dải số của một ô: 0–9 hai lần, mỗi số một dòng; ô dừng ở số của nó trong lượt thứ hai (lăn hơn một vòng). */
const STRIP = Array.from('01234567890123456789').join('\n')

/**
 * Số lăn kiểu đồng hồ cơ, một lần: mỗi chữ số ASCII một ô cao đúng một dòng, rộng đúng chữ số của nó (chữ số trong suốt giữ chỗ và đường
 * chân chữ), nên chuỗi không đổi bề rộng; chữ khác hiện dần. Chạy xong trở lại đúng chuỗi đã format — trình đọc màn hình chỉ nhận chuỗi đó
 * (bản `sr-only`) suốt lúc lăn. Chuyển động tắt hay chuỗi không có chữ số: chữ thường. Trong `Reveal group` thì chạy theo nhóm.
 */
export function Odometer({ value, delay = 0 }: { value: string; delay?: number }) {
  const motion = useRevealMotion()
  const parent = useContext(RevealScopeContext)
  const gateRef = useRevealRef<HTMLSpanElement>()
  const [settled, setSettled] = useState(false)
  const parts = odometerParts(value)
  const cells = parts.reduce((sum, part) => sum + (part.kind === 'digit' ? 1 : 0), 0)

  if (!motion || settled || cells === 0) return <>{value}</>

  const scope = { steps: parent?.steps ?? 0, ms: (parent?.ms ?? 0) + delay }
  const handleAnimationEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target instanceof Element && event.target.hasAttribute('data-last')) setSettled(true)
  }
  return (
    <span
      ref={parent ? undefined : gateRef}
      className="reveal-odo"
      style={withVars({ '--reveal-delay': delayValue(scope) })}
      onAnimationEnd={handleAnimationEnd}
    >
      <span className="sr-only select-none">{value}</span>
      <span aria-hidden="true" key={value}>
        {parts.map((part, key) =>
          part.kind === 'digit' ? (
            <span key={key} className="reveal-odo-cell">
              <span className="reveal-odo-ghost">{part.digit}</span>
              <span
                className="reveal-odo-strip reveal-piece"
                style={withVars({ '--d': part.digit, '--k': part.cell })}
                data-last={part.cell === cells - 1 ? '' : undefined}
              >
                {STRIP}
              </span>
            </span>
          ) : (
            <span key={key} className="reveal-odo-text reveal-piece" style={withVars({ '--k': part.cell })}>
              {part.text}
            </span>
          ),
        )}
      </span>
    </span>
  )
}
