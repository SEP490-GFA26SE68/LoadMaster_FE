import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { DataTable, type BaseTableFeatures, type ColumnMeta, type DataTablePagination } from '@/components/DataTable'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Formatter } from '@/lib/format'
import type { PaymentStatus, PaymentTransaction } from '@/lib/mock-db'
import { paymentPath } from './payment-path'

const helper = createColumnHelper<BaseTableFeatures, PaymentTransaction>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

/** Ngữ pháp chấm của chip trạng thái: chờ người kế tiếp (người dùng bấm Trả) là vòng rỗng, kết quả cuối là chấm đặc. */
const STATUS_LOOK: Record<PaymentStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  PENDING: { tone: 'warning', dot: 'ring' },
  SUCCESS: { tone: 'success', dot: 'solid' },
  FAILED: { tone: 'danger', dot: 'solid' },
}

function columnsOf(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('createdAt', {
      id: 'time',
      header: t('billing.payments.columns.time'),
      meta: { width: '170px' } satisfies ColumnMeta,
      cell: (info) => <span className="text-ink-1 tabular-nums">{format.date(info.getValue())} {format.time(info.getValue())}</span>,
    }),
    helper.accessor('id', { id: 'code', header: t('billing.payments.columns.code'), meta: { width: '140px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{info.getValue()}</span> }),
    helper.accessor('purpose', { id: 'purpose', header: t('billing.payments.columns.purpose'), cell: (info) => <span className="text-ink-1">{t(`billing.payments.purposes.${info.getValue()}`)}</span> }),
    helper.accessor('amountVnd', { id: 'amount', header: t('billing.payments.columns.amount'), meta: { align: 'right', width: '160px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{format.currency(info.getValue())}</span> }),
    helper.accessor('status', {
      id: 'status',
      header: t('billing.payments.columns.status'),
      meta: { width: '180px' } satisfies ColumnMeta,
      cell: (info) => <Badge tone={STATUS_LOOK[info.getValue()].tone} dot={STATUS_LOOK[info.getValue()].dot}>{t(`billing.payments.statuses.${info.getValue()}`)}</Badge>,
    }),
    helper.display({
      id: 'actions',
      header: () => <span className="sr-only">{t('billing.payments.columns.actions')}</span>,
      meta: { align: 'right', width: '96px' } satisfies ColumnMeta,
      cell: (info) => {
        const { id, status } = info.row.original
        if (status !== 'PENDING') return null
        return (
          <Button variant="secondary" size="sm" asChild>
            <Link to={paymentPath(id)} aria-label={t('billing.payFor', { code: id })}>{t('billing.pay')}</Link>
          </Button>
        )
      },
    }),
  ])
}

/** Thanh toán của công ty (FE-8-03): mới nhất trước; thanh toán còn chờ có nút Trả mở trang thanh toán giả lập. */
export function PaymentsTable({ rows, pagination }: { rows: PaymentTransaction[]; pagination: DataTablePagination }) {
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
      emptyMessage={t('billing.payments.empty')}
    />
  )
}
