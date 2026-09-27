import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

/**
 * Thanh tiêu đề của màn trong khung ứng dụng, nằm trên **dải trời** V2.3 (`ChuyenHang.jpg`, `v3.css` `.page-head`): tiêu đề Archivo
 * 700 32px rộng 112 % chữ trắng, một dòng mô tả `--sky-text-3`, hành động ở phải; `children` (tab của màn) nằm trong dải, dưới tiêu đề.
 *
 * - Tiêu đề là `<h1>` chỉ chứa chữ tiêu đề: tên truy cập giữ đúng chữ, test đọc tiêu đề bằng `exact: true` không đổi.
 * - Hành động nằm trong cùng `<header>` với tiêu đề — test tìm nút theo `heading.closest('header')`. Trên dải trời, nút phụ dùng
 *   `variant="glass"`; nút chính giữ gradient cyan.
 * - `meta` là số đếm hoặc mã đi kèm tiêu đề (mono, nhỏ); `description` ẩn dưới 768 px.
 * - `overlap`: dải trời kéo thêm `--sky-overlap` (44px) ở đáy để card đầu tiên của vùng cuộn đè lên (vùng cuộn đặt `sky-overlap`).
 *   Chỉ bật khi thứ đầu tiên của vùng cuộn là card nền đặc — chữ trần trên nền trời tối không đọc được.
 *
 * Không dùng cho màn có tiêu đề là dữ liệu (mã chuyến, tên xe) hay thanh 56 px của Planner (AGENTS mục 5).
 */
export function PageHero({
  title,
  meta,
  description,
  actions,
  back,
  overlap = false,
  children,
}: {
  title: string
  meta?: string
  description?: ReactNode
  actions?: ReactNode
  back?: { to: string; label: string }
  overlap?: boolean
  children?: ReactNode
}) {
  return (
    <header
      className={cn(
        'sky flex flex-none flex-col px-shell pt-4 max-sm:px-4',
        children ? 'pb-0' : overlap ? 'pb-[calc(var(--sky-overlap)+20px)]' : 'pb-6',
      )}
    >
      <div className="flex min-w-0 items-end gap-4">
        {back ? (
          <Button variant="glass" size="icon" aria-label={back.label} className="mb-0.5 flex-none" asChild>
            <Link to={back.to}>
              <ChevronLeft strokeWidth={1.5} aria-hidden />
            </Link>
          </Button>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex min-w-0 items-baseline gap-3">
            <h1 className="font-display text-display leading-[1.1] font-bold tracking-[-0.5px] whitespace-nowrap text-sky-text font-stretch-112%">
              {title}
            </h1>
            {meta ? <span className="truncate font-mono text-caption text-sky-text-3">{meta}</span> : null}
          </div>
          {description ? <p className="hidden truncate text-body text-sky-text-3 md:block">{description}</p> : null}
        </div>

        {actions ? <div className="flex flex-none items-center gap-2.5">{actions}</div> : null}
      </div>

      {children ? <div className={cn('-mx-5 mt-3', overlap && 'pb-(--sky-overlap)')}>{children}</div> : null}
    </header>
  )
}
