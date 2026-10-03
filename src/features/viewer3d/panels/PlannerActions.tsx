import { Check, CircleAlert, Columns2, Pencil } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { PlannerAccess } from '../approval/planner-access'

/**
 * Bên phải thanh trên Planner (LM-094, D-51): "Đã duyệt lúc …" thay nút Duyệt khi bản đã duyệt chưa có chỉnh sửa, nút Chỉnh sửa
 * của hàng gộp (≥ 1.366 px), So sánh phương án, và một nút primary Duyệt ("Duyệt phương án" / "Duyệt bản chỉnh"). Lý do chặn
 * Duyệt nằm trong tooltip và mô tả của nút, không chen chữ đỏ vào thanh (U-5); hộp thoại Duyệt liệt kê đủ.
 * `approvedBy` đổi nhãn thành "Duyệt bởi … lúc" khi kho biết người duyệt (LM-104).
 */
export function PlannerActions({ tripId, access, blockedReason, onApprove, onEdit, approvedBy = null, compareRunId }: {
  tripId: string
  access: PlannerAccess
  blockedReason: string | null
  onApprove: () => void
  /** Vắng khi Planner khoá hoặc đang ở chế độ Chỉnh sửa. */
  onEdit?: () => void
  approvedBy?: string | null
  /** Lần chạy có nhiều phương án ứng viên mà revision đang xem thuộc về: nút So sánh mở ba phương án của lần chạy đó. */
  compareRunId?: string | undefined
}) {
  const t = useT()
  return (
    <div className="flex shrink-0 items-center gap-2">
      {access.approvedAt ? <ApprovedAt at={access.approvedAt} by={approvedBy} /> : null}
      {onEdit ? (
        <Button variant="glass" className="hidden h-9.5 px-3 min-[1366px]:flex" onClick={onEdit}>
          <Pencil strokeWidth={1.5} aria-hidden className="hidden 2xl:block" />
          {t('viewer.toolbar.edit')}
        </Button>
      ) : null}
      <CompareLink tripId={tripId} runId={compareRunId} />
      {access.approve ? <ApproveButton draft={access.approve === 'draft'} blockedReason={blockedReason} onClick={onApprove} /> : null}
    </div>
  )
}

function ApprovedAt({ at, by }: { at: string; by: string | null }) {
  const t = useT()
  const format = useFormat()
  return (
    <p className="flex items-center gap-2 pr-1" data-approved-at>
      {/* V2.3 `.ok .d`: chấm cyan đặc có quầng — trạng thái "đã duyệt" cùng màu chip Đã duyệt */}
      <span aria-hidden className="grid size-5.5 flex-none place-items-center rounded-full bg-cyan-400 text-cyan-950 shadow-[0_0_12px_-2px_var(--cyan-400)]">
        <Check className="size-3.5" strokeWidth={2.5} />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        {/* Nhãn rộng tới 208 px (điện thoại 160 px): đủ cho họ tên ba chữ như "Nguyễn Thanh Tùng" mà hàng gộp vẫn vừa 1.366 px
            (`layout-1366`); tên dài hơn bị cắt bằng dấu ba chấm, tên đầy đủ ở `title`. Từ 1.536 tới dưới 1.760 px nút So sánh có chữ
            nên hàng hết chỗ cho họ tên: chỉ hiện "Đã duyệt lúc", tên người duyệt ở `title` */}
        {by ? (
          <span className="hidden text-note leading-3.5 text-glass-dark-muted 2xl:max-[1759px]:block" title={by}>
            {t('viewer.plan.approvedAt')}
          </span>
        ) : null}
        <span
          className={cn('max-w-40 truncate text-caption leading-4 text-glass-dark-muted md:max-w-52 xl:text-note xl:leading-3.5', by && '2xl:max-[1759px]:hidden')}
          title={by ?? undefined}
        >
          {by ? t('viewer.plan.approvedBy', { name: by }) : t('viewer.plan.approvedAt')}
        </span>
        <span className="font-display text-body leading-5 font-semibold whitespace-nowrap text-sky-text tabular-nums xl:leading-4">
          {t('viewer.plan.approvedAtValue', { time: format.time(at), date: format.dayMonth(at) })}
        </span>
      </span>
    </p>
  )
}

/**
 * Chỉ icon dưới 1.536 px để hàng gộp vừa 1.366 px; tên đầy đủ ở tooltip và tên truy cập. Từ 1.536 px nút có chữ (người dùng yêu cầu,
 * 03/10/2026) — nhãn người duyệt nhường chỗ ở khoảng 1.536–1.759 px (`ApprovedAt`). Có `runId` (revision là phương án ứng viên của
 * một lần chạy) thì mở màn so sánh ba phương án của lần chạy đó; không thì mở ma trận mọi revision như trước.
 */
function CompareLink({ tripId, runId }: { tripId: string; runId: string | undefined }) {
  const t = useT()
  const label = t('viewer.plan.compare')
  const to = runId === undefined ? `/chuyen/${tripId}/so-sanh` : `/chuyen/${tripId}/so-sanh?lan-chay=${encodeURIComponent(runId)}`
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="glass" className="hidden h-9.5 px-2.5 xl:flex 2xl:px-3.5" asChild>
          <Link to={to} aria-label={label}>
            <Columns2 strokeWidth={1.5} />
            <span className="hidden 2xl:inline">{label}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="2xl:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

/** `draft`: đã dời hoặc xoay kiện — bấm là duyệt luôn bản chỉnh (FE-0-07), không có bước lưu riêng. */
function ApproveButton({ draft, blockedReason, onClick }: { draft: boolean; blockedReason: string | null; onClick: () => void }) {
  const t = useT()
  const reasonId = useId()
  const button = (
    <Button
      variant="primary"
      className="h-14 px-4 text-body-lg xl:h-10 xl:text-body"
      aria-describedby={blockedReason ? reasonId : undefined}
      onClick={onClick}
    >
      {blockedReason ? <CircleAlert strokeWidth={1.5} /> : <Check strokeWidth={1.5} />}
      {t(draft ? 'viewer.plan.approveDraft' : 'viewer.plan.approve')}
    </Button>
  )
  if (!blockedReason) return button
  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-72">{blockedReason}</TooltipContent>
      </Tooltip>
      <span id={reasonId} className="sr-only">{blockedReason}</span>
    </>
  )
}
