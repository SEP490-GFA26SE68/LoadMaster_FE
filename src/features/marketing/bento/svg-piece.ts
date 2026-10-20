import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Lớp và mốc của một mảnh hình SVG chạy một lần khi ô hiện ra (`sections.css`: `lp-pop`, `lp-lift`, `lp-fade`, `lp-draw`, `lp-pulse`);
 * `at` là mili giây sau lúc ô bắt đầu. Chuyển động tắt: chỉ còn lớp gốc, phần tử y như hình tĩnh.
 */
export function svgPiece(motion: boolean, effect: string, at: number, className?: string): { className?: string; style?: CSSProperties } {
  if (!motion) return { className }
  return { className: cn(className, effect, 'reveal-piece'), style: { '--at': `${at}ms` } as CSSProperties }
}
