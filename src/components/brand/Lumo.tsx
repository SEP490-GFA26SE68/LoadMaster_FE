import done from '@/assets/brand/lumo/done.webp'
import driverWaiting from '@/assets/brand/lumo/driver-waiting.webp'
import empty from '@/assets/brand/lumo/empty.webp'
import error from '@/assets/brand/lumo/error.webp'
import greet from '@/assets/brand/lumo/greet.webp'
import notFound from '@/assets/brand/lumo/not-found.webp'
import warehouseWaiting from '@/assets/brand/lumo/warehouse-waiting.webp'
import { cn } from '@/lib/utils'

/**
 * Tư thế của Lumo — mỗi tư thế **một nghĩa cố định** (LM-105, AGENTS "Thương hiệu"), để người dùng đọc tình huống qua hình:
 * - `greet` chào (màn đăng nhập) · `empty` chưa có dữ liệu · `notFound` lọc / tìm không có kết quả · `error` có sự cố (404, 403, lỗi tải)
 * - `done` xong việc lớn (xếp xong, giao xong, duyệt hết) · `warehouseWaiting` kho chờ hàng · `driverWaiting` tài xế chờ chuyến
 *
 * Ảnh WebP 320 px, vuông, nền trong suốt, mỗi tư thế khoảng 20 KB, xuất từ `design/brand/source/` (cắt sát hình, lề 2 %). Vite trả URL,
 * ảnh chỉ tải khi màn dùng nó hiện ra.
 */
export const LUMO_POSES = {
  greet,
  empty,
  notFound,
  error,
  done,
  warehouseWaiting,
  driverWaiting,
} as const

export type LumoPose = keyof typeof LUMO_POSES

const SIZES = {
  sm: 'size-24', // 96 px — trạng thái rỗng trên điện thoại, trong card
  md: 'size-24 sm:size-30', // 96 → 120 px — trạng thái rỗng
  lg: 'size-28 sm:size-35', // 112 → 140 px — màn xong việc, màn lỗi
  xl: 'size-32 sm:size-40', // 128 → 160 px — màn đăng nhập
} as const

/** Linh vật Lumo. Trang trí: `alt=""` + `aria-hidden` — chữ bên cạnh nói đủ nghĩa. Không động. */
export function Lumo({ pose, size = 'md', className }: { pose: LumoPose; size?: keyof typeof SIZES; className?: string }) {
  return (
    <img
      src={LUMO_POSES[pose]}
      alt=""
      aria-hidden
      data-lumo={pose}
      width={320}
      height={320}
      decoding="async"
      draggable={false}
      className={cn('flex-none object-contain select-none', SIZES[size], className)}
    />
  )
}
