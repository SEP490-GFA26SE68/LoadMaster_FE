import carry from '@/assets/brand/lumo/carry.webp'
import done from '@/assets/brand/lumo/done.webp'
import driverWaiting from '@/assets/brand/lumo/driver-waiting.webp'
import empty from '@/assets/brand/lumo/empty.webp'
import error from '@/assets/brand/lumo/error.webp'
import explain from '@/assets/brand/lumo/explain.webp'
import greet from '@/assets/brand/lumo/greet.webp'
import idea from '@/assets/brand/lumo/idea.webp'
import notFound from '@/assets/brand/lumo/not-found.webp'
import point from '@/assets/brand/lumo/point.webp'
import scan from '@/assets/brand/lumo/scan.webp'
import tablet from '@/assets/brand/lumo/tablet.webp'
import warehouseWaiting from '@/assets/brand/lumo/warehouse-waiting.webp'
import wink from '@/assets/brand/lumo/wink.webp'
import { cn } from '@/lib/utils'

/**
 * Tư thế của Lumo — mỗi tư thế **một nghĩa cố định** (LM-105, AGENTS "Thương hiệu"), để người dùng đọc tình huống qua hình:
 * - `greet` chào (màn đăng nhập) · `empty` chưa có dữ liệu · `notFound` lọc / tìm không có kết quả · `error` có sự cố (404, 403, lỗi tải)
 * - `done` xong việc lớn (xếp xong, giao xong, duyệt hết) · `warehouseWaiting` kho chờ hàng · `driverWaiting` tài xế chờ chuyến
 * - toàn thân: `point` chỉ vào việc đang diễn ra · `carry` mang kiện · `scan` đối chiếu kiện · `tablet` phương án trên máy tính bảng
 * - bán thân, ló lên trên một cạnh ngang (cạnh che khoảng 12 % đáy ảnh): `explain` giải thích · `idea` gợi ý · `wink` mời liên hệ
 *
 * Ảnh WebP vuông, nền trong suốt, xuất từ `design/brand/source/` (cắt sát hình, lề 2 %): bảy tư thế đầu 320 px khoảng 20 KB, bốn tư thế
 * toàn thân 512 px và ba tư thế bán thân 400 px khoảng 28–41 KB. Vite trả URL, ảnh chỉ tải khi màn dùng nó hiện ra. Không bao giờ lật
 * ảnh (mũ và áo có chữ "Ln"): `point`, `carry` đứng bên trái việc nó chỉ hay mang tới, `scan` đứng bên phải thứ nó quét.
 */
export const LUMO_POSES = {
  greet, empty, notFound, error, done, warehouseWaiting, driverWaiting,
  point, carry, scan, tablet,
  explain, idea, wink,
} as const

export type LumoPose = keyof typeof LUMO_POSES

/** Cạnh thật của từng ảnh (px); cỡ hiển thị không quá nửa cạnh này. */
export const LUMO_ASSET_PX: Record<LumoPose, 320 | 400 | 512> = {
  greet: 320, empty: 320, notFound: 320, error: 320, done: 320, warehouseWaiting: 320, driverWaiting: 320,
  point: 512, carry: 512, scan: 512, tablet: 512,
  explain: 400, idea: 400, wink: 400,
}

/** Tên riêng, không vào từ điển: câu nói về Lumo dùng tham số `{name}`. */
export const LUMO_NAME = 'Lumo'

const SIZES = {
  sm: 'size-24', // 96 px — trạng thái rỗng trên điện thoại, trong card
  md: 'size-24 sm:size-30', // 96 → 120 px — trạng thái rỗng
  lg: 'size-28 sm:size-35', // 112 → 140 px — màn xong việc, màn lỗi
  xl: 'size-32 sm:size-40', // 128 → 160 px — màn đăng nhập
} as const

type LumoProps = {
  pose: LumoPose
  size?: keyof typeof SIZES
  /** Cỡ hiển thị (px CSS), thay cho `size`. `width` / `height` vẫn là cạnh thật của ảnh để trình duyệt giữ chỗ đúng tỉ lệ. */
  px?: number
  /** `lazy` cho ảnh nằm xa dưới màn đầu (trang giới thiệu); mặc định tải ngay. */
  loading?: 'eager' | 'lazy'
  className?: string
}

/**
 * Linh vật Lumo. Trang trí: `alt=""` + `aria-hidden` — chữ bên cạnh nói đủ nghĩa. Ở mọi màn Lumo đứng yên; chỉ trang giới thiệu
 * (`features/marketing`) cho nó chuyển động — một lần, bằng CSS của trang đó, không phải ở đây.
 */
export function Lumo({ pose, size = 'md', px, loading = 'eager', className }: LumoProps) {
  const edge = LUMO_ASSET_PX[pose]
  return (
    <img
      src={LUMO_POSES[pose]}
      alt=""
      aria-hidden
      data-lumo={pose}
      width={edge}
      height={edge}
      loading={loading}
      decoding="async"
      draggable={false}
      style={px === undefined ? undefined : { width: px, height: px }}
      className={cn('flex-none object-contain select-none', px === undefined && SIZES[size], className)}
    />
  )
}
