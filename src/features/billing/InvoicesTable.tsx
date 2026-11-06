import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta, type DataTablePagination } from '@/components/DataTable'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Formatter } from '@/lib/format'
import type { Invoice, InvoiceStatus } from './billing-api'

const helper = createColumnHelper<BaseTableFeatures, Invoice>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

/** Chưa trả là chờ người kế tiếp (vòng rỗng); đã trả, thất bại, huỷ là kết quả cuối (chấm đặc). */
const STATUS_LOOK: Record<InvoiceStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  UNPAID: { tone: 'warning', dot: 'ring' },
  PAID: { tone: 'success', dot: 'solid' },
  FAILED: { tone: 'danger', dot: 'solid' },
  VOID: { tone: 'neutral', dot: 'solid' },
}

function columnsOf(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('createdAt', {
      id: 'time',
      header: t('billing.invoices.columns.time'),
      meta: { width: '170px' } satisfies ColumnMeta,
      cell: (info) => <span className="text-ink-1 tabular-nums">{format.date(info.getValue())} {format.time(info.getValue())}</span>,
    }),
    helper.accessor('number', { id: 'number', header: t('billing.invoices.columns.number'), cell: (info) => <span className={mono}>{info.getValue()}</span> }),
    helper.accessor('period', { id: 'period', header: t('billing.invoices.columns.period'), meta: { width: '110px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{format.monthYear(info.getValue())}</span> }),
    helper.accessor('planName', { id: 'plan', header: t('billing.invoices.columns.plan'), meta: { width: '140px' } satisfies ColumnMeta, cell: (info) => <span className="text-ink-1">{info.getValue()}</span> }),
    helper.accessor('amountVnd', {
      id: 'amount',
      header: t('billing.invoices.columns.amount'),
      meta: { align: 'right', width: '160px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.currency(info.getValue())}</span>,
    }),
    helper.accessor('status', {
      id: 'status',
      header: t('billing.invoices.columns.status'),
      meta: { width: '150px' } satisfies ColumnMeta,
      cell: (info) => <Badge tone={STATUS_LOOK[info.getValue()].tone} dot={STATUS_LOOK[info.getValue()].dot}>{t(`billing.invoices.statuses.${info.getValue()}`)}</Badge>,
    }),
  ])
}

/** Hoá đơn của công ty (chỉ khi nối backend): mới nhất trước, phân trang theo `useListUrlState` của thẻ Lịch sử. */
export function InvoicesTable({ rows, pagination }: { rows: Invoice[]; pagination: DataTablePagination }) {
  const t = useT()
  const format = useFormat()
  const columns = useMemo(() => columnsOf(t, format), [t, format])
  return (
    <DataTable
      data={rows}
      columns={columns}
      getRowId={(row) => row.id}
      density="roomy"
      appearance="paper"
      pagination={pagination}
      emptyMessage={t('billing.invoices.empty')}
    />
  )
}
