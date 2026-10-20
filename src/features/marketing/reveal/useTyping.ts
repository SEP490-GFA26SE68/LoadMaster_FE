import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { graphemes, typeStep } from './split-text'

/** Một nhịp vẽ tiến tối đa chừng này: tab ẩn rồi hiện lại thì gõ tiếp, không nhảy hết câu. */
const FRAME_CAP_MS = 64

type TypingOptions = {
  text: string
  /** Ngôn ngữ cho `Intl.Segmenter`. */
  locale: string
  budgetMs: number
  /** Giữ nguyên chữ đang gõ (nút tạm dừng của chuyện trong khung 3D). */
  paused: boolean
  /** Cổng đã mở: bắt đầu gõ (câu đầu chờ thêm `leadMs`); đổi `text` sau đó thì gõ câu mới ngay. */
  started: boolean
  leadMs: number
  /** Hiện đủ ngay, không gõ (chuyển động tắt, mở bằng focus hay lúc in). */
  instant: boolean
  /** Gọi khi gõ xong một câu (không gọi khi hiện ngay). */
  onDone: () => void
}

/** Đổ phần đã gõ và phần còn lại (trong suốt, giữ chỗ) vào hai nút — ghi thẳng DOM, không qua render. */
function paint(typed: HTMLElement | null, rest: HTMLElement | null, parts: readonly string[], shown: number): void {
  if (!typed || !rest) return
  typed.textContent = parts.slice(0, shown).join('')
  rest.textContent = parts.slice(shown).join('')
}

/**
 * Gõ chữ theo thời gian cho bong bóng của `LumoSays`: số grapheme hiện = `min(n, floor(thời gian / typeStep(n, budgetMs)))`. Hai span
 * nhận ref không có con do React vẽ — hook ghi `textContent` của chúng, nên React không bao giờ đụng vào nút chữ đã bị thay. `done` khi
 * câu hiện tại đã gõ xong (hoặc `instant`): nơi gọi thay hai span bằng chữ thường.
 */
export function useTyping({ text, locale, budgetMs, paused, started, leadMs, instant, onDone }: TypingOptions) {
  const typedRef = useRef<HTMLSpanElement>(null)
  const restRef = useRef<HTMLSpanElement>(null)
  const [doneText, setDoneText] = useState<string | null>(null)
  const done = instant || doneText === text
  /** Tiến độ của câu đang gõ, giữ qua lúc tạm dừng; `lines` đếm câu đã bắt đầu để chỉ câu đầu chờ `leadMs`. */
  const progress = useRef({ text: '', elapsed: 0, lines: 0 })
  const handleDone = useRef(onDone)
  useLayoutEffect(() => {
    handleDone.current = onDone
  })

  // Trước lần vẽ đầu của mỗi câu: cả câu nằm ở phần còn lại (trong suốt), bong bóng đã đúng cỡ trước khi gõ.
  useLayoutEffect(() => {
    if (done) return
    const run = progress.current
    const parts = graphemes(text, locale)
    const shown = run.text === text ? Math.min(parts.length, Math.floor(Math.max(0, run.elapsed) / typeStep(parts.length, budgetMs))) : 0
    paint(typedRef.current, restRef.current, parts, shown)
  }, [done, text, locale, budgetMs])

  useEffect(() => {
    if (done || !started || paused) return
    const run = progress.current
    if (run.text !== text) {
      run.elapsed = run.lines === 0 ? -leadMs : 0
      run.lines += 1
      run.text = text
    }
    const parts = graphemes(text, locale)
    const step = typeStep(parts.length, budgetMs)
    let shown = -1
    let last: number | null = null
    let frame = 0
    const tick = (now: number) => {
      run.elapsed += last === null ? 0 : Math.min(FRAME_CAP_MS, now - last)
      last = now
      const next = Math.min(parts.length, Math.floor(Math.max(0, run.elapsed) / step))
      if (next !== shown) {
        shown = next
        paint(typedRef.current, restRef.current, parts, shown)
      }
      if (shown < parts.length) {
        frame = requestAnimationFrame(tick)
        return
      }
      setDoneText(text)
      handleDone.current()
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [done, started, paused, text, locale, budgetMs, leadMs])

  return { done, typedRef, restRef }
}
