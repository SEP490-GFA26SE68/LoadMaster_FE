import { Check, CircleAlert, CircleCheck, Columns2 } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/Tooltip'
import { useFormat, useT } from '@/lib/i18n'
import type { PlannerAccess } from '../approval/planner-access'

/**
 * Bên phải thanh trên Planner (LM-094, D-51): "Đã duyệt lúc …" thay nút Duyệt khi bản đã duyệt chưa có chỉnh sửa, nút Chỉnh sửa
 * của hàng gộp (≥ 1.366 px), So sánh phương án, và một nút primary Duyệt ("Duyệt phương án" / "Duyệt bản chỉnh"). Lý do chặn
 * Duyệt nằm trong tooltip và mô tả của nút, không chen chữ đỏ vào thanh (U-5); hộp thoại Duyệt liệt kê đủ.
 * LM-104: `decisions` là thanh quyết định khác của quản lý công ty (Từ chối, Quyết định khác) đứng ngay trước nút Duyệt; `approvedBy`
 * đổi nhãn thành "Duyệt bởi … lúc" khi kho biết người duyệt.
 */
export function PlannerActions({ tripId, access, blockedReason, onApprove, onEdit, approvedBy = null, decisions }: {
  tripId: string
  access: PlannerAccess
  blockedReason: string | null
  onApprove: () => void
  /** Vắng khi Planner khoá hoặc đang ở chế độ Chỉnh sửa. */
  onEdit?: () => void
  approvedBy?: string | null
  decisions?: ReactNode
}) {
  const t = useT()
  return (
    <div className="flex shrink-0 items-center gap-2">
      {access.approvedAt ? <ApprovedAt at={access.approvedAt} by={approvedBy} /> : null}
      {onEdit ? (
        <Button variant="secondary" className="hidden h-11 px-3 min-[1366px]:flex" onClick={onEdit}>
          {t('viewer.toolbar.edit')}
        </Button>
      ) : null}
      <CompareLink tripId={tripId} />
      {decisions}
      {access.approve ? <ApproveButton draft={access.approve === 'draft'} short={Boolean(decisions)} blockedReason={blockedReason} onClick={onApprove} /> : null}
    </div>
  )
}

function ApprovedAt({ at, by }: { at: string; by: string | null }) {
  const t = useT()
  const format = useFormat()
  return (
    <p className="flex items-center gap-2 pr-1" data-approved-at>
      <CircleCheck className="size-5 flex-none text-success" strokeWidth={1.5} aria-hidden />
      <span className="flex min-w-0 flex-col">
        {/* Tên dài bị cắt bằng dấu ba chấm để hàng gộp vẫn vừa 1.366 px; tên đầy đủ ở `title` */}
        <span className="max-w-52 truncate text-caption leading-4 text-text-3 xl:text-[11px] xl:leading-3.5" title={by ?? undefined}>
          {by ? t('viewer.plan.approvedBy', { name: by }) : t('viewer.plan.approvedAt')}
        </span>
        <span className="font-mono text-body leading-5 font-medium whitespace-nowrap xl:leading-4.5">
          {t('viewer.plan.approvedAtValue', { time: format.time(at), date: format.dayMonth(at) })}
        </span>
      </span>
    </p>
  )
}

/** Chỉ icon dưới 1.536 px để hàng gộp vừa 1.366 px; tên đầy đủ ở tooltip và tên truy cập. */
function CompareLink({ tripId }: { tripId: string }) {
  const t = useT()
  const label = t('viewer.plan.compare')
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="secondary" className="hidden h-10 px-2.5 xl:flex 2xl:px-3.5" asChild>
          <Link to={`/chuyen/${tripId}/so-sanh`} aria-label={label}>
            <Columns2 strokeWidth={1.5} />
            <span className="hidden 2xl:inline">{label}</span>
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="2xl:hidden">{label}</TooltipContent>
    </Tooltip>
  )
}

/**
 * `short`: thanh quyết định của quản lý đứng cạnh (LM-104) — trên điện thoại chữ rút còn "Duyệt" để thanh 390 px vẫn một hàng; tên
 * truy cập giữ đủ.
 */
function ApproveButton({ draft, short = false, blockedReason, onClick }: { draft: boolean; short?: boolean; blockedReason: string | null; onClick: () => void }) {
  const t = useT()
  const reasonId = useId()
  const label = t(draft ? 'viewer.plan.approveDraft' : 'viewer.plan.approve')
  const button = (
    <Button
      variant="primary"
      className="h-14 px-4 text-body-lg xl:h-10 xl:text-body"
      aria-label={short ? label : undefined}
      aria-describedby={blockedReason ? reasonId : undefined}
      onClick={onClick}
    >
      {blockedReason ? <CircleAlert strokeWidth={1.5} /> : <Check strokeWidth={1.5} />}
      {short ? <><span className="md:hidden">{t('viewer.plan.approveShort')}</span><span className="hidden md:inline">{label}</span></> : label}
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
