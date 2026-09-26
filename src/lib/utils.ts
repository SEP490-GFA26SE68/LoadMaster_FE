import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Cỡ chữ của `@theme` trong `src/index.css` (`--text-display` … `--text-caption`).
 * Không khai báo thì tailwind-merge coi `text-body` là màu chữ và bỏ `text-white`
 * đứng trước nó (LM-055). Thêm token cỡ chữ mới vào `@theme` thì thêm tên vào đây.
 */
const THEME_FONT_SIZES = ['display', 'h1', 'h2', 'h3', 'body-lg', 'body', 'caption', 'micro', 'note', 'lede', 'small', 'fine']

/**
 * Họ chữ của `@theme` ngoài `sans`/`mono` mặc định. Thiếu khai báo thì tailwind-merge không xếp `font-display` (Archivo,
 * V2.3) vào nhóm họ chữ, nên `cn('font-mono', 'font-display')` giữ cả hai thay vì để lớp sau thắng.
 */
const THEME_FONT_FAMILIES = ['display']

const twMerge = extendTailwindMerge({
  extend: {
    theme: { text: THEME_FONT_SIZES, font: THEME_FONT_FAMILIES },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
