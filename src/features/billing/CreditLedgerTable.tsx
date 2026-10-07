import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta, type DataTablePagination } from '@/components/DataTable'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { Formatter } from '@/lib/format'
import type { CreditTransaction, CreditTransactionType } from '@/lib/mock-db'

const helper = createColumnHelper<BaseTableFeatures, CreditTransaction>()
const mono = 'font-mono text-caption text-ink-1 tabular-nums'

/** Màu theo nghĩa: cấp và mua là credit vào (xanh lá / cyan), dùng là credit ra (trung tính), hoàn là credit quay lại (thông tin). */
const TYPE_TONE: Record<CreditTransactionType, BadgeTone> = { MONTHLY_GRANT: 'cyan', PURCHASE: 'success', USAGE: 'neutral', REFUND: 'info' }

/** Số có dấu: cấp, mua, hoàn là "+N"; dùng là "-N" (gói không giới hạn: 0). */
function signed(format: Formatter, amount: number): string {
  if (amount > 0) return `+${format.integer(amount)}`
  return amount < 0 ? `-${format.integer(-amount)}` : format.integer(0)
}

function columnsOf(t: TFunction, format: Formatter) {
  return helper.columns([
    helper.accessor('createdAt', {
      id: 'time',
      header: t('billing.ledger.columns.time'),
      meta: { width: '170px' } satisfies ColumnMeta,
      cell: (info) => <span className="text-ink-1 tabular-nums">{format.date(info.getValue())} {format.time(info.getValue())}</span>,
    }),
    helper.accessor('type', {
      id: 'type',
      header: t('billing.ledger.columns.type'),
      meta: { width: '160px' } satisfies ColumnMeta,
      cell: (info) => <Badge tone={TYPE_TONE[info.getValue()]}>{t(`billing.ledger.types.${info.getValue()}`)}</Badge>,
    }),
    helper.accessor('amount', {
      id: 'amount',
      header: t('billing.ledger.columns.amount'),
      meta: { align: 'right', width: '120px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{signed(format, info.getValue())}</span>,
    }),
    helper.accessor('reference', { id: 'reference', header: t('billing.ledger.columns.reference'), meta: { width: '150px' } satisfies ColumnMeta, cell: (info) => <span className={mono}>{info.getValue()}</span> }),
    helper.display({
      id: 'note',
      header: t('billing.ledger.columns.note'),
      cell: (info) => {
        const { usageStatus, tripId } = info.row.original
        const note = [usageStatus === undefined ? '' : t(`billing.ledger.usage.${usageStatus}`), tripId ?? ''].filter((part) => part !== '').join(' · ')
        return <span className="text-ink-2">{note}</span>
      },
    }),
  ])
}

/** Sổ cái credit của công ty (FE-8-03): mới nhất trước, phân trang theo `useListUrlState` của màn. */
export function CreditLedgerTable({ rows, pagination }: { rows: CreditTransaction[]; pagination: DataTablePagination }) {
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
      emptyMessage={t('billing.ledger.empty')}
    />
  )
}
