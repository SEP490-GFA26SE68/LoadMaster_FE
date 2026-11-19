import carry from '@/assets/brand/lumo/carry.webp'
import carryHalf from '@/assets/brand/lumo/carry-256.webp'
import done from '@/assets/brand/lumo/done.webp'
import doneHalf from '@/assets/brand/lumo/done-160.webp'
import driverWaiting from '@/assets/brand/lumo/driver-waiting.webp'
import driverWaitingHalf from '@/assets/brand/lumo/driver-waiting-160.webp'
import empty from '@/assets/brand/lumo/empty.webp'
import emptyHalf from '@/assets/brand/lumo/empty-160.webp'
import error from '@/assets/brand/lumo/error.webp'
import errorHalf from '@/assets/brand/lumo/error-160.webp'
import explain from '@/assets/brand/lumo/explain.webp'
import explainHalf from '@/assets/brand/lumo/explain-200.webp'
import greet from '@/assets/brand/lumo/greet.webp'
import greetHalf from '@/assets/brand/lumo/greet-160.webp'
import idea from '@/assets/brand/lumo/idea.webp'
import ideaHalf from '@/assets/brand/lumo/idea-200.webp'
import notFound from '@/assets/brand/lumo/not-found.webp'
import notFoundHalf from '@/assets/brand/lumo/not-found-160.webp'
import point from '@/assets/brand/lumo/point.webp'
import pointHalf from '@/assets/brand/lumo/point-256.webp'
import scan from '@/assets/brand/lumo/scan.webp'
import scanHalf from '@/assets/brand/lumo/scan-256.webp'
import tablet from '@/assets/brand/lumo/tablet.webp'
import tabletHalf from '@/assets/brand/lumo/tablet-256.webp'
import warehouseWaiting from '@/assets/brand/lumo/warehouse-waiting.webp'
import warehouseWaitingHalf from '@/assets/brand/lumo/warehouse-waiting-160.webp'
import wink from '@/assets/brand/lumo/wink.webp'
import winkHalf from '@/assets/brand/lumo/wink-200.webp'
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

/**
 * Bản nửa cạnh của từng tư thế (`<tên>-<cạnh>.webp`, thu từ bản gốc, khoảng 7–16 KB). Cỡ hiển thị không quá nửa cạnh gốc, nên ở màn mật
 * độ điểm ảnh 1× bản này luôn đủ nét; màn 2× chỉ dùng nó khi ảnh hiện không quá một phần tư cạnh gốc. Trình duyệt chọn qua `srcset`.
 */
export const LUMO_HALF_POSES: Record<LumoPose, string> = {
  greet: greetHalf, empty: emptyHalf, notFound: notFoundHalf, error: errorHalf, done: doneHalf,
  warehouseWaiting: warehouseWaitingHalf, driverWaiting: driverWaitingHalf,
  point: pointHalf, carry: carryHalf, scan: scanHalf, tablet: tabletHalf,
  explain: explainHalf, idea: ideaHalf, wink: winkHalf,
}

/** Cạnh thật của từng ảnh (px); cỡ hiển thị không quá nửa cạnh này. */
export const LUMO_ASSET_PX: Record<LumoPose, 320 | 400 | 512> = {
  greet: 320, empty: 320, notFound: 320, error: 320, done: 320, warehouseWaiting: 320, driverWaiting: 320,
  point: 512, carry: 512, scan: 512, tablet: 512,
  explain: 400, idea: 400, wink: 400,
}

/** `srcset` của một tư thế: bản nửa cạnh và bản gốc. Nơi tải sẵn ảnh (`new Image()`) dùng cùng chuỗi này kèm `sizes` để khỏi tải hai lần. */
export function lumoSrcSet(pose: LumoPose): string {
  const edge = LUMO_ASSET_PX[pose]
  return `${LUMO_HALF_POSES[pose]} ${edge / 2}w, ${LUMO_POSES[pose]} ${edge}w`
}

/** Tên riêng, không vào từ điển: câu nói về Lumo dùng tham số `{name}`. */
export const LUMO_NAME = 'Lumo'

const SIZES = {
  sm: 'size-24', // 96 px — trạng thái rỗng trên điện thoại, trong card
  md: 'size-24 sm:size-30', // 96 → 120 px — trạng thái rỗng
  lg: 'size-28 sm:size-35', // 112 → 140 px — màn xong việc, màn lỗi
  xl: 'size-32 sm:size-40', // 128 → 160 px — màn đăng nhập
} as const

/** Cùng cỡ với `SIZES`, viết cho thuộc tính `sizes` (bậc `sm` của Tailwind là 640 px). */
const SIZE_HINTS: Record<keyof typeof SIZES, string> = {
  sm: '96px',
  md: '(min-width: 640px) 120px, 96px',
  lg: '(min-width: 640px) 140px, 112px',
  xl: '(min-width: 640px) 160px, 128px',
}

type LumoProps = {
  pose: LumoPose
  size?: keyof typeof SIZES
  /** Cỡ hiển thị (px CSS), thay cho `size`. `width` / `height` vẫn là cạnh thật của ảnh để trình duyệt giữ chỗ đúng tỉ lệ. */
  px?: number
  /**
   * Thuộc tính `sizes` khi dùng `px`: có nó thì trình duyệt được chọn bản nửa cạnh. Không truyền thì chỉ có bản gốc — nơi đã tải sẵn bản gốc
   * bằng `new Image()` không truyền (hoặc tải sẵn bằng `lumoSrcSet` cùng `sizes`), không thì ảnh tải hai lần. Cỡ đặt sẵn (`size`) tự có.
   */
  sizes?: string
  /** `lazy` cho ảnh nằm xa dưới màn đầu (trang giới thiệu); mặc định tải ngay. */
  loading?: 'eager' | 'lazy'
  className?: string
}

/**
 * Linh vật Lumo. Trang trí: `alt=""` + `aria-hidden` — chữ bên cạnh nói đủ nghĩa. Ở mọi màn Lumo đứng yên; chỉ trang giới thiệu
 * (`features/marketing`) cho nó chuyển động — một lần, bằng CSS của trang đó, không phải ở đây.
 */
export function Lumo({ pose, size = 'md', px, sizes, loading = 'eager', className }: LumoProps) {
  const edge = LUMO_ASSET_PX[pose]
  const hint = px === undefined ? SIZE_HINTS[size] : sizes
  return (
    // `loading`, `sizes`, `srcSet` đứng trước `src`: trình duyệt bắt đầu tải khi gặp `src`
    <img
      alt=""
      aria-hidden
      data-lumo={pose}
      width={edge}
      height={edge}
      loading={loading}
      decoding="async"
      sizes={hint}
      srcSet={hint === undefined ? undefined : lumoSrcSet(pose)}
      src={LUMO_POSES[pose]}
      draggable={false}
      style={px === undefined ? undefined : { width: px, height: px }}
      className={cn('flex-none object-contain select-none', px === undefined && SIZES[size], className)}
    />
  )
}
