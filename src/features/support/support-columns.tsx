import { createColumnHelper } from '@tanstack/react-table'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { SupportTicket } from '@/lib/mock-db'
import { TicketKindBadge, TicketStatusBadge } from './TicketBadges'

const helper = createColumnHelper<BaseTableFeatures, SupportTicket>()

/**
 * Cột bảng yêu cầu hỗ trợ (FE-8-07). Ô không giữ trạng thái nên dựng cột theo ngôn ngữ và tên công ty được (AGENTS mục 5, Bảng dữ liệu);
 * thứ tự là thứ tự kho trả — hoạt động gần nhất trước — nên không cột nào sắp xếp.
 */
export function createTicketColumns(t: TFunction, format: Formatter, companyNames: ReadonlyMap<string, string>) {
  return helper.columns([
    helper.display({
      id: 'ticket',
      header: t('support.page.columns.ticket'),
      meta: { width: '38%' } satisfies ColumnMeta,
      cell: (info) => {
        const ticket = info.row.original
        return (
          <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
            <span className="line-clamp-2 font-medium text-ink-strong">{ticket.title}</span>
            <span className="text-small text-ink-3"><span className="font-mono text-caption">{ticket.id}</span> · {ticket.senderName}</span>
          </span>
        )
      },
    }),
    helper.display({
      id: 'company',
      header: t('support.page.columns.company'),
      meta: { width: '24%' } satisfies ColumnMeta,
      cell: (info) => <span className="line-clamp-2 whitespace-normal text-ink-1">{companyNames.get(info.row.original.companyId) ?? info.row.original.companyId}</span>,
    }),
    helper.display({ id: 'kind', header: t('support.page.columns.kind'), meta: { width: '110px' } satisfies ColumnMeta, cell: (info) => <TicketKindBadge kind={info.row.original.kind} /> }),
    helper.display({ id: 'status', header: t('support.page.columns.status'), meta: { width: '140px' } satisfies ColumnMeta, cell: (info) => <TicketStatusBadge status={info.row.original.status} /> }),
    helper.display({
      id: 'updated',
      header: t('support.page.columns.updated'),
      cell: (info) => <span className="text-ink-1 tabular-nums">{format.date(info.row.original.updatedAt)} {format.time(info.row.original.updatedAt)}</span>,
    }),
  ])
}
