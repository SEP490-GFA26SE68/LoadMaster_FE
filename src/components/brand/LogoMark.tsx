import { cn } from '@/lib/utils'

/**
 * Biểu tượng khối LoadMaster (LM-105): nắp, chữ L, chữ n ghép thành một khối hộp nhìn nghiêng. Dựng lại từ
 * `design/brand/source/two_tone_isometric_cube_emblem.png` trên lưới đẳng cự (cạnh xiên đúng tan 30°). Góc bo đều bằng cách co đa
 * giác vào trong 26 đơn vị rồi tô viền cùng màu dày 52 (`stroke-linejoin: round`) — góc ngoài tròn bán kính 26, hình vẫn đúng đường
 * bao gốc. Bản `.svg` tĩnh cùng hình nằm ở `public/favicon.svg` và `design/brand/`.
 */
export const LOGO_MARK_VIEWBOX = '178 188 900 900'

export const LOGO_MARK_PATHS = [
  'M628 219 837.9 340 628 461 418.1 340Z',
  'M222 447.1 279.9 414 408 488 408 733 660 878 660 1020 596 1057 222 841Z',
  'M633 613 968 420 1034 458 1034 813 940 867 940 614.9 774 711 774 989.1 766 993.7 766 835 633 758Z',
] as const

/**
 * - `color`: ba màu gốc, trên nền sáng.
 * - `dark`: trên nền tối (dải trời, khung 3D) — chữ n trắng vì navy chìm vào nền.
 * - `mono`: một màu theo `currentColor` (bản in, nhãn QR).
 */
export type LogoTone = 'color' | 'dark' | 'mono'

const PIECES: Readonly<Record<LogoTone, readonly [string, string, string]>> = {
  color: ['fill-(--logo-sky) stroke-(--logo-sky)', 'fill-(--logo-blue) stroke-(--logo-blue)', 'fill-(--logo-navy) stroke-(--logo-navy)'],
  dark: ['fill-(--logo-sky) stroke-(--logo-sky)', 'fill-(--logo-blue) stroke-(--logo-blue)', 'fill-(--logo-on-dark) stroke-(--logo-on-dark)'],
  mono: ['fill-current stroke-current', 'fill-current stroke-current', 'fill-current stroke-current'],
}

/** Trang trí: luôn `aria-hidden` — tên sản phẩm có chữ hoặc `aria-label` bên cạnh. Cỡ mặc định 32 px, đổi bằng `className`. */
export function LogoMark({ tone = 'color', className }: { tone?: LogoTone; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={LOGO_MARK_VIEWBOX}
      strokeLinejoin="round"
      strokeWidth={52}
      className={cn('size-8 flex-none', className)}
    >
      {LOGO_MARK_PATHS.map((d, index) => (
        <path key={d} d={d} className={PIECES[tone][index]} />
      ))}
    </svg>
  )
}
