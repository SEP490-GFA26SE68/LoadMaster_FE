import { createColumnHelper } from '@tanstack/react-table'
import { ArrowRight, UserRound } from 'lucide-react'
import { Link } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { KpiTone } from '@/components/KpiTile'
import { RoleBadge } from '@/components/RoleBadge'
import type { Formatter } from '@/lib/format'
import { useT, type TFunction } from '@/lib/i18n'
import { auditActionLook } from './audit-look'
import type { AuditLogRow } from './audit-log'
import type { AuditChange, AuditTableRow } from './audit-change'

const helper = createColumnHelper<BaseTableFeatures, AuditTableRow>()

/** Nền + chữ của năm cặp tint (AGENTS mục 4) cho ô icon trong bảng — cùng bảng màu với `KpiTile`. */
const TINT: Record<KpiTone, string> = {
  blue: 'bg-tint-blue text-tint-blue-fg',
  green: 'bg-tint-green text-tint-green-fg',
  amber: 'bg-tint-amber text-tint-amber-fg',
  azure: 'bg-tint-azure text-tint-azure-fg',
  slate: 'bg-tint-slate text-tint-slate-fg',
}

/**
 * Cột bảng nhật ký (LM-091, V2): thời điểm (giờ trên, ngày dưới) · người làm (ô chữ tắt, tên, vai trò) · hành động (icon theo nhóm
 * trên nền tint theo nghĩa) · đối tượng · chi tiết. Chữ đã dịch sẵn trong `AuditLogRow`; tiêu đề và ngày giờ theo ngôn ngữ nên
 * dựng trong component. Ô icon và chữ tắt là `aria-hidden`: tên người làm và tên hành động đã nói đủ.
 */
export function auditColumns(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('at', {
      header: t('audit.log.columns.at'),
      enableSorting: true,
      sortDescFirst: true,
      meta: { width: '120px' } satisfies ColumnMeta,
      cell: (info) => (
        // Hai dòng nhưng vẫn là một cụm "giờ ngày" khi đọc máy hay chép (khoảng trắng giữa hai phần)
        <span className="flex flex-col font-mono whitespace-nowrap">
          <span className="text-body font-medium text-ink-strong">{format.time(info.getValue())}</span>
          {' '}
          <span className="text-caption text-ink-3">{format.date(info.getValue())}</span>
        </span>
      ),
    }),
    helper.accessor('actor', {
      header: t('audit.log.columns.actor'),
      meta: { width: '216px' } satisfies ColumnMeta,
      cell: (info) => <ActorCell row={info.row.original} />,
    }),
    helper.accessor('action', {
      header: t('audit.log.columns.action'),
      meta: { width: '232px' } satisfies ColumnMeta,
      cell: (info) => <ActionCell row={info.row.original} />,
    }),
    helper.accessor('target', {
      header: t('audit.log.columns.target'),
      // Đủ một dòng cho tên tuyến dài nhất của seed ở 1.366 px (LM-095); chi tiết nhận phần còn lại, tối đa hai dòng
      meta: { width: '360px' } satisfies ColumnMeta,
      cell: (info) => <TargetCell target={info.getValue()} />,
    }),
    helper.accessor('details', {
      header: t('audit.log.columns.details'),
      cell: (info) => <DetailsCell row={info.row.original} />,
    }),
  ])
}

/**
 * Chi tiết của sự kiện. Sự kiện sửa một giá trị (`before` + `after`) hiện chip "80 → 86" cạnh tên trường; chữ đầy đủ ("Trước: …")
 * vẫn nằm ở `title` và ở bản đọc cho trình đọc màn hình. Sự kiện khác hiện chuỗi tham số như trước.
 */
function DetailsCell({ row }: { row: AuditTableRow }) {
  const { change, details } = row
  return (
    <span className="line-clamp-2 whitespace-normal text-ink-2" title={details}>
      {change === null ? details : (
        <>
          {change.rest ? <>{change.rest}{' · '}</> : null}
          {change.field ? <>{change.field}{' '}</> : null}
          <ChangeChip change={change} />
        </>
      )}
    </span>
  )
}

function ChangeChip({ change }: { change: AuditChange }) {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1 rounded-sm bg-tint-slate px-1.5 align-middle font-mono text-caption text-ink-3">
      <span aria-hidden className="inline-flex items-center gap-1">
        <span>{change.before || NO_VALUE}</span>
        <ArrowRight className="size-3 flex-none" strokeWidth={1.5} />
        <span className="font-semibold text-ink-strong">{change.after || NO_VALUE}</span>
      </span>
      <span className="sr-only">{t('audit.log.change', { before: change.before || NO_VALUE, after: change.after || NO_VALUE })}</span>
    </span>
  )
}

/** Giá trị trước hoặc sau để trống (trường chưa từng có giá trị): hiện gạch thay cho chip rỗng. */
const NO_VALUE = '—'

/** Ô chữ tắt 28 px; người làm không còn là tài khoản (hệ thống, chưa đăng nhập, đã xoá) thì là icon người trung tính. */
function ActorCell({ row }: { row: AuditTableRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={`grid size-7 flex-none place-items-center rounded-md text-micro font-semibold ${TINT.slate}`}>
        {row.actorInitials ?? <UserRound className="size-4" strokeWidth={1.5} />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink-strong">{row.actor}</span>
        {/* Vai trò hiện tại nằm dưới tên; khoảng trắng giữ "tên vai trò" khi đọc máy hay chép */}
        {row.actorRoleCode ? <>{' '}<span className="mt-0.5 flex max-w-full"><RoleBadge role={row.actorRoleCode} size="sm" /></span></> : null}
      </span>
    </span>
  )
}

function ActionCell({ row }: { row: AuditLogRow }) {
  const { icon: Icon, tone } = auditActionLook(row.actionCode)
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={`grid size-8 flex-none place-items-center rounded-md ${TINT[tone]}`}>
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <span className="line-clamp-2 whitespace-normal font-medium text-ink-1">{row.action}</span>
    </span>
  )
}

/**
 * Tên đối tượng trên, mã dưới (hai dòng để tên dài không cắt mất mã — ô tìm tìm theo mã). Còn trang để mở thì tên là liên kết:
 * chuyến, xe, danh sách người dùng lọc đúng người. Khoảng trắng giữa hai dòng chỉ để chữ đọc liền mạch khi chép hoặc đọc máy.
 */
function TargetCell({ target }: { target: AuditLogRow['target'] }) {
  const name = target.label ?? target.id
  return (
    <span className="flex min-w-0 flex-col">
      {target.href ? (
        <Link
          to={target.href}
          className="truncate rounded-sm font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {name}
        </Link>
      ) : (
        <span className="truncate text-ink-1">{name}</span>
      )}
      {target.label ? <>{' '}<span className="truncate font-mono text-caption text-ink-3">{target.id}</span></> : null}
    </span>
  )
}
