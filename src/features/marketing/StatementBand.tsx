import type { CSSProperties, ReactNode } from 'react'
import { useLocale, useT } from '@/lib/i18n'
import { FlowHeading, LineRise, sentences, TextRibbon, useRevealMotion, words } from './reveal'
import { StatementTruck } from './StatementTruck'

/** Hai hàng của dải chữ trôi: việc sản phẩm làm thật trong một chuyến, mỗi hàng bốn cụm. */
const RIBBON_ROWS = [
  ['plan3d', 'qr', 'route', 'approve'],
  ['axle', 'pickup', 'monitor', 'report'],
] as const

const STATEMENT_CLASS = 'm-0 max-w-240 font-display text-section font-bold tracking-[-0.02em] text-balance text-sky-text font-stretch-112%'

/**
 * Từng từ của một câu sáng dần theo cuộn: `--p` là vị trí của từ trong cả đoạn (0 → 1, `offset` là số từ của các câu trước), dời khoảng
 * cuộn của từ đó (`sections.css`).
 */
function litWords(line: string, offset: number, total: number): ReactNode[] {
  const last = Math.max(1, total - 1)
  const nodes: ReactNode[] = []
  let index = offset
  for (const [key, part] of words(line).entries()) {
    if (part.word) {
      const style = { '--p': (index / last).toFixed(3) } as CSSProperties
      nodes.push(
        <span key={key} className="lp-statement-word" style={style}>
          {part.word}
        </span>,
      )
      index += 1
    }
    if (part.space) nodes.push(part.space)
  }
  return nodes
}

/**
 * Dải nguyên tắc xếp hàng giữa Tính năng và Cách hoạt động: nền tối đặc `--panel-dark`; dòng mở "Nguyên tắc xếp hàng" (cyan), câu Archivo 700
 * cỡ `section` — hàng giao sau lên xe trước, hàng giao trước sát cửa — mỗi câu một dòng, và hình xe tải nhìn ngang nói đúng điều đó
 * (`StatementTruck`, `aria-hidden`): từ 1.024 px câu bên trái, hình bên phải; hẹp hơn hình nằm dưới câu, rộng tối đa 28rem. Dưới cùng là
 * dải chữ trôi ngang theo cuộn (`TextRibbon`): việc sản phẩm làm trong một chuyến, hai hàng ngược chiều, tràn hết bề ngang dải.
 *
 * Chuyển động bật (`RevealProvider`): dòng mở chảy từng chữ (`FlowHeading`); từng câu nhô lên khỏi mặt nạ khi dải lộ ra (`LineRise`, một
 * lần), và trong câu từng từ sáng dần từ `--sky-text-2` lên trắng theo cuộn (CSS view timeline, `sections.css`) — trình đọc màn hình đọc bản
 * `sr-only` của cả đoạn; xe xếp hàng, đóng cửa rồi chạy đi theo cuộn của chính hình xe (`steps/truck-motion.css`). Trình duyệt không có view
 * timeline: chữ đứng yên, sáng hẳn; xe chạy chuỗi của nó một lần theo thời gian. Không chữ số nào.
 */
export function StatementBand() {
  const t = useT()
  const { locale } = useLocale()
  const motion = useRevealMotion()
  const text = t('landingStory.statement')
  const lines = sentences(text, locale)
  const counts = lines.map((line) => words(line).filter((part) => part.word).length)
  const total = counts.reduce((sum, count) => sum + count, 0)
  const offsets = counts.map((_, index) => counts.slice(0, index).reduce((sum, count) => sum + count, 0))
  const rows = RIBBON_ROWS.map((row) => row.map((key) => t(`landingMotion.ribbon.${key}`)))
  return (
    <div className="landing-statement lp-statement py-20 lg:py-28">
      <div className="grid items-center gap-12 px-4 md:px-shell lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 xl:gap-24">
        <div className="min-w-0">
          <div className="mb-8 flex items-center gap-3">
            <span aria-hidden className="block h-px w-10 flex-none bg-cyan-300" />
            <FlowHeading as="p" text={t('landingMotion.statement.kicker')} className="m-0 text-body font-semibold text-cyan-300 pointer-coarse:text-body-lg" />
          </div>
          <LineRise as="p" lines={lines} renderLine={(line, index) => litWords(line, offsets[index] ?? 0, total)} className={STATEMENT_CLASS} />
        </div>
        <StatementTruck motion={motion} className="w-full max-w-md lg:max-w-none" />
      </div>
      <TextRibbon
        className="mt-16 border-y border-border-dark py-5 [--ribbon-bg:var(--panel-dark)] lg:mt-24 lg:py-6"
        rows={rows}
        label={t('landingMotion.ribbon.label')}
        rowClassNames={['font-display text-h1 font-bold text-sky-text font-stretch-112%', 'mt-2 text-h2 font-medium text-sky-text-2 [--ribbon-mark:var(--cyan-300)]']}
      />
    </div>
  )
}
