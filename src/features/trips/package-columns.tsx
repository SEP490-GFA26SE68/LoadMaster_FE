import { createColumnHelper } from '@tanstack/react-table'
import { AlertCircle } from 'lucide-react'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import type { CargoPackage } from '@/domain/models'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { packageRequirements, type PackageRequirement } from './package-requirements'
import { PackageStopMarker } from './PackageStopMarker'

const mono = 'font-mono text-caption text-ink-1'
/** Tên điểm giao xuống tối đa hai dòng thay vì cắt bằng dấu ba chấm (LM-095). */
const WRAP_2 = 'line-clamp-2 whitespace-normal leading-4.5'
/** Hai chip đầu hiện trên một hàng, còn lại gom thành "+n". */
const MAX_CHIPS = 2

export type PackageRow = CargoPackage & { readonly errorCount: number; readonly warningCount: number; readonly stopName: string }

/**
 * Cột bảng kiện (LM-044, V2.3 `ChiTietChuyenKien`): Kiện hàng (tên 600, tối đa hai dòng thay vì cắt — LM-095 / mã · D × R × C) · Khối lượng · Số lượng · Điểm giao (mốc +
 * tên) · Yêu cầu (chip đọc được ngay: dễ vỡ hổ phách, giữ đứng, không xếp chồng, được xoay) · Lỗi. Bề rộng cột theo bản mẫu.
 */
export function createPackageColumns(t: TFunction, format: Formatter) {
  const helper = createColumnHelper<BaseTableFeatures, PackageRow>()
  return helper.columns([
    helper.accessor('name', {
      header: t('trips.packages.columns.package'),
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col whitespace-normal">
          <span className="line-clamp-2 text-body leading-5 font-semibold text-ink-strong">{row.original.name}</span>
          {/* Khoảng trắng không hiện trong flex nhưng tách tên và mã trong tên truy cập của dòng */}
          {' '}
          <span className="mt-0.75 truncate font-mono text-caption text-ink-3">
            {row.original.id} · {format.dimensions(row.original.lengthCm, row.original.widthCm, row.original.heightCm)}
          </span>
        </span>
      ),
    }),
    helper.accessor('weightKg', {
      header: t('trips.packages.columns.weight'),
      meta: { align: 'right', width: '104px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.weight(info.getValue())}</span>,
    }),
    helper.accessor('quantity', {
      header: t('trips.packages.columns.quantity'),
      meta: { align: 'right', width: '92px' } satisfies ColumnMeta,
      cell: (info) => <span className={mono}>{format.integer(info.getValue())}</span>,
    }),
    helper.display({
      id: 'stop',
      header: t('trips.packages.columns.stop'),
      // Theo tỷ lệ bảng, tên điểm giao tối đa hai dòng; cột Kiện hàng nhận phần còn lại
      meta: { width: '25%' } satisfies ColumnMeta,
      cell: ({ row }) => <span className="flex min-w-0 items-center gap-2.25">
        <PackageStopMarker number={row.original.deliveryStop} />
        <span className={WRAP_2}><span className="sr-only">{t('trips.packages.columns.stop')} {row.original.deliveryStop}: </span>{row.original.stopName}</span>
      </span>,
    }),
    helper.display({
      id: 'requirements',
      header: t('trips.packages.columns.requirements'),
      meta: { width: '176px' } satisfies ColumnMeta,
      cell: ({ row }) => <RequirementChips requirements={packageRequirements(row.original)} />,
    }),
    helper.display({
      id: 'issues',
      header: t('trips.packages.columns.issues'),
      meta: { width: '96px' } satisfies ColumnMeta,
      cell: ({ row }) => <PackageIssueCell errorCount={row.original.errorCount} warningCount={row.original.warningCount} />,
    }),
  ])
}

/** Chip yêu cầu V2.3 (`.req`): cao 22, bo 6, chữ 12/500; dễ vỡ nền hổ phách, còn lại xám. */
function RequirementChips({ requirements }: { requirements: readonly PackageRequirement[] }) {
  const t = useT()
  const shown = requirements.slice(0, MAX_CHIPS)
  const hidden = requirements.slice(MAX_CHIPS)
  return (
    <span className="flex items-center gap-1 overflow-hidden">
      {shown.map((requirement) => (
        <span
          key={requirement}
          className={cn(
            'inline-flex h-5.5 flex-none items-center rounded-sm px-2 text-caption font-medium whitespace-nowrap',
            requirement === 'fragile' ? 'bg-amber-50 text-amber-700' : 'bg-n-100 text-ink-2',
          )}
        >
          {t(`trips.packages.req.${requirement}`)}
        </span>
      ))}
      {hidden.length > 0 ? (
        <span className="text-caption text-ink-3" title={hidden.map((requirement) => t(`trips.packages.req.${requirement}`)).join(', ')}>
          {t('trips.packages.req.more', { count: hidden.length })}
        </span>
      ) : null}
    </span>
  )
}

function PackageIssueCell({ errorCount, warningCount }: { errorCount: number; warningCount: number }) {
  const t = useT()
  if (errorCount === 0 && warningCount === 0) return <span className="text-fine text-ink-3">{t('trips.packages.noIssues')}</span>
  const danger = errorCount > 0
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-fine font-medium', danger ? 'text-red-700' : 'text-amber-700')}>
      <AlertCircle className="size-3.5 flex-none" strokeWidth={2} aria-hidden />
      {danger
        ? t('trips.packages.issueCount', { count: errorCount })
        : t('trips.packages.warningCount', { count: warningCount })}
    </span>
  )
}
