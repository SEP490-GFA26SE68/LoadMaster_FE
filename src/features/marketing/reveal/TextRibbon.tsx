import { cn } from '@/lib/utils'
import { useRevealMotion } from './RevealProvider'
import { withVars } from './reveal-runtime'
import { useScrollProgress } from './scroll-link'

/** Số bản lặp của mỗi hàng: đủ phủ khung nhìn rộng nhất cả khi hàng đã trôi hết quãng chạy. */
const COPIES = 4

type TextRibbonProps = {
  /** Các hàng chữ, mỗi hàng một danh sách cụm ngắn (đã dịch, không chữ số). Hàng thứ nhất trôi sang trái khi cuộn xuống, hàng sau ngược lại. */
  rows: readonly (readonly string[])[]
  /** Tên của danh sách cho trình đọc màn hình — mỗi cụm được đọc đúng một lần, theo thứ tự hàng. */
  label: string
  /** Lớp của khung ngoài (lề, viền). */
  className?: string
  /** Lớp chữ của từng hàng theo thứ tự (cỡ, màu, độ đậm); màu của dấu ngăn lấy `--ribbon-mark` (mặc định `--cyan-400`). */
  rowClassNames?: readonly string[]
  /** Quãng chạy của một hàng suốt lúc dải đi qua khung nhìn, tính bằng phần của một bản lặp (0–1, mặc định 0,5). */
  travel?: number
}

/**
 * Dải chữ trôi ngang theo cuộn: một hoặc hai hàng cụm chữ ngắn, hàng lẻ trôi ngược hàng chẵn, **chỉ chuyển động khi người xem cuộn** (gắn với
 * vị trí cuộn, không tự chạy nên không cần nút dừng). Trình duyệt có view timeline: CSS thuần (`reveal.css`); không có: `useScrollProgress`
 * ghi `--scroll-p` trong lúc dải nằm trong khung nhìn. Chỉ transform.
 *
 * - Trình đọc màn hình đọc một danh sách `sr-only` (mỗi cụm một lần); các hàng nhìn thấy (bốn bản lặp) nằm trong khối `aria-hidden`.
 * - Khung ngoài cắt theo chiều ngang (`overflow-x: clip`): không bao giờ làm trang cuộn ngang.
 * - Chuyển động tắt (giảm chuyển động, ngoài `RevealProvider`, jsdom): các hàng đứng yên ở đầu hàng. Bố cục hai chế độ như nhau.
 */
export function TextRibbon({ rows, label, className, rowClassNames, travel = 0.5 }: TextRibbonProps) {
  const motion = useRevealMotion()
  const ref = useScrollProgress<HTMLDivElement>(motion)
  const shift = `${((-100 / COPIES) * Math.min(1, Math.max(0, travel))).toFixed(3)}%`
  return (
    <div ref={ref} className={cn('reveal-ribbon', className)} style={withVars({ '--ribbon-shift': shift })}>
      <ul className="sr-only" aria-label={label}>
        {rows.flat().map((phrase, index) => (
          <li key={index}>{phrase}</li>
        ))}
      </ul>
      <div aria-hidden="true" className="reveal-ribbon-rows">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className={cn('reveal-ribbon-track', rowClassNames?.[rowIndex])} data-dir={rowIndex % 2 === 0 ? 'left' : 'right'}>
            {Array.from({ length: COPIES }, (_, copy) =>
              row.map((phrase, index) => (
                <span key={`${copy}-${index}`} className="reveal-ribbon-item">
                  <span className="reveal-ribbon-mark" />
                  {phrase}
                </span>
              )),
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
