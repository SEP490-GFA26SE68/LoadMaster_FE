import { Box } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Ô logo LoadMaster V2.3 (`v3.css` `.brand .mark`): 32px bo 10px, gradient cyan có quầng, khối hộp `--cyan-950`. Dùng ở thanh điều
 * hướng, màn lỗi và dải trời của hai trang tài liệu. Trang trí — tên sản phẩm luôn có chữ hoặc `aria-label` bên cạnh.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('grid size-8 flex-none place-items-center rounded-md bg-(image:--brand-mark) shadow-brand', className)}>
      <Box className="size-4.5 text-cyan-950" strokeWidth={2} />
    </span>
  )
}
