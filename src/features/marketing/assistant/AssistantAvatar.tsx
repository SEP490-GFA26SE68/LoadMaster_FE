import { Lumo, type LumoPose } from '@/components/brand/Lumo'
import { cn } from '@/lib/utils'

const SIZES = {
  /** Cạnh câu trả lời trong khung chat: ô 28 px, ảnh 34 px. */
  xs: { box: 'size-7', px: 34 },
  /** Nút "Trợ lý AI" trên thanh điều hướng: ô 32 px trong vòng gradient 2 px — đủ 36 px như mọi nút của thanh. */
  rail: { box: 'size-8', px: 38 },
  /** Nút mở: ô 36 px, ảnh 42 px. */
  sm: { box: 'size-9', px: 42 },
  /** Đầu khung chat: ô 40 px, ảnh 48 px. */
  md: { box: 'size-10', px: 48 },
  /** Màn chào của khung chat: ô 64 px, ảnh 76 px. */
  lg: { box: 'size-16', px: 76 },
} as const

/**
 * Ảnh đại diện của trợ lý: Lumo bán thân trong ô vuông bo góc nền tint, cạnh dưới ô che phần đáy ảnh như cạnh ngang mà tư thế bán thân
 * được vẽ để ló lên. Tư thế giữ nghĩa cố định: `wink` ở nút mở — mời hỏi; `explain` ở đầu khung và cạnh câu trả lời — đang giải thích;
 * `idea` ở màn chào — gợi ý câu hỏi. Trang trí: chữ cạnh bên nói đủ nghĩa.
 */
export function AssistantAvatar({ pose, size = 'sm', className }: { pose: Extract<LumoPose, 'explain' | 'idea' | 'wink'>; size?: keyof typeof SIZES; className?: string }) {
  const { box, px } = SIZES[size]
  return (
    <span aria-hidden className={cn('relative flex-none overflow-hidden rounded-md bg-tint-blue', box, className)}>
      <Lumo pose={pose} px={px} sizes={`${px}px`} className="absolute top-0.5 left-1/2 max-w-none -translate-x-1/2" />
    </span>
  )
}
