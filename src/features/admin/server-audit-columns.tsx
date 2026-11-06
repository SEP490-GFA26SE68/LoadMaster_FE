import { createColumnHelper } from '@tanstack/react-table'
import { UserRound } from 'lucide-react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { RoleBadge } from '@/components/RoleBadge'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { ChangeChip, TINT } from './audit-columns'
import type { ServerAuditRow } from './server-audit-rows'

const helper = createColumnHelper<BaseTableFeatures, ServerAuditRow>()

/**
 * Cột của Nhật ký máy chủ: cùng hình với bảng kho mẫu (giờ · người làm · hành động · đối tượng · chi tiết), thêm cột Công ty cho quản
 * trị hệ thống. Máy chủ sắp sẵn mới nhất trước và phân trang nên không cột nào sắp xếp được; đối tượng không là liên kết.
 */
export function serverAuditColumns(t: TFunction, format: Formatter, withCompany: boolean) {
  return helper.columns([
    helper.accessor('at', {
      header: t('audit.log.columns.at'),
      meta: { width: '120px' } satisfies ColumnMeta,
      cell: (info) => (
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
    ...(withCompany ? [helper.accessor('company', {
      header: t('audit.log.company'),
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: (info) => <span className="line-clamp-2 whitespace-normal text-ink-1">{info.getValue()}</span>,
    })] : []),
    helper.accessor('action', {
      header: t('audit.log.columns.action'),
      meta: { width: '232px' } satisfies ColumnMeta,
      cell: (info) => <ActionCell row={info.row.original} />,
    }),
    helper.accessor('target', {
      header: t('audit.log.columns.target'),
      meta: { width: '200px' } satisfies ColumnMeta,
      cell: (info) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-ink-1">{info.getValue()}</span>
          {info.row.original.targetRef ? <>{' '}<span className="font-mono text-caption text-ink-3">{info.row.original.targetRef}</span></> : null}
        </span>
      ),
    }),
    helper.accessor('details', {
      header: t('audit.log.columns.details'),
      cell: (info) => {
        const { change, details } = info.row.original
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
      },
    }),
  ])
}

function ActorCell({ row }: { row: ServerAuditRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={`grid size-7 flex-none place-items-center rounded-md text-micro font-semibold ${TINT.slate}`}>
        {row.actorInitials ?? <UserRound className="size-4" strokeWidth={1.5} />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium text-ink-strong">{row.actor}</span>
        {row.actorRole ? <>{' '}<span className="mt-0.5 flex max-w-full"><RoleBadge role={row.actorRole} size="sm" /></span></> : null}
      </span>
    </span>
  )
}

function ActionCell({ row }: { row: ServerAuditRow }) {
  const Icon = row.icon
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className={`grid size-8 flex-none place-items-center rounded-md ${TINT[row.tone]}`}>
        <Icon className="size-4" strokeWidth={1.5} />
      </span>
      <span className="line-clamp-2 whitespace-normal font-medium text-ink-1">{row.action}</span>
    </span>
  )
}
