import type { CSSProperties, ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { useRevealMotion, words } from './reveal'
import { StatementTruck } from './StatementTruck'

/** Từng từ sáng dần theo cuộn: `--p` là vị trí của từ trong câu (0 → 1), dời khoảng cuộn của từ đó (`sections.css`). */
function litWords(text: string): ReactNode[] {
  const parts = words(text)
  const last = Math.max(1, parts.filter((part) => part.word).length - 1)
  const nodes: ReactNode[] = []
  let index = 0
  for (const [key, part] of parts.entries()) {
    if (part.word) {
      const style = { '--p': (index / last).toFixed(3) } as CSSProperties
      nodes.push(<span key={key} className="lp-statement-word" style={style}>{part.word}</span>)
      index += 1
    }
    if (part.space) nodes.push(part.space)
  }
  return nodes
}

/**
 * Dải nguyên tắc xếp hàng giữa Tính năng và Cách hoạt động: nền tối đặc `--panel-dark`, một câu Archivo 700 cỡ `section` — hàng giao
 * sau lên xe trước, hàng giao trước sát cửa — và hình xe tải nhìn ngang nói đúng điều đó (`StatementTruck`, `aria-hidden`): từ 1.024 px
 * câu bên trái, hình bên phải; hẹp hơn hình nằm dưới câu, rộng tối đa 28rem. Chuyển động bật (`RevealProvider`): một bản `sr-only` cho
 * trình đọc màn hình và các từ `aria-hidden` sáng dần từ `--sky-text-2` lên trắng theo cuộn, từng khối hàng của hình vào qua cửa sau cùng
 * nhịp đó — điểm 4 trước, điểm 1 vào chỗ khi câu sáng hẳn (CSS view timeline, `sections.css`); trình duyệt không có view timeline thì đứng
 * yên, sáng hẳn, đủ bốn khối. Theo cuộn nên không tự chạy; câu không chữ số.
 */
export function StatementBand() {
  const t = useT()
  const motion = useRevealMotion()
  const text = t('landingStory.statement')
  return (
    <div className="landing-statement lp-statement px-4 py-20 md:px-shell lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
        <div className="min-w-0">
          <span aria-hidden className="mb-8 block h-px w-10 bg-cyan-300" />
          <p className="m-0 max-w-240 font-display text-section font-bold tracking-[-0.02em] text-balance text-sky-text font-stretch-112%">
            {motion ? (
              <>
                <span className="sr-only">{text}</span>
                <span aria-hidden="true">{litWords(text)}</span>
              </>
            ) : (
              text
            )}
          </p>
        </div>
        <StatementTruck motion={motion} className="w-full max-w-md lg:max-w-none" />
      </div>
    </div>
  )
}
