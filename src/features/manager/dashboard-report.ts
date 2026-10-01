import type { Cell, Row } from 'write-excel-file/browser'
import { roundKg } from '@/domain/geometry'
import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import { tripSubStatusLabel } from '@/lib/trip-sub-status'
import type { DashboardSummary } from './dashboard-summary'

/**
 * Nội dung báo cáo .xlsx của bảng điều khiển (LM-090, D-48): ba sheet Tổng quan, Chuyến, Theo xe dựng từ đúng
 * `DashboardSummary` màn đang hiện. Hàm thuần — chỉ `import type` từ `write-excel-file`, thư viện chỉ tải khi bấm xuất
 * (`dashboard-export.ts`). Số giữ là số để Excel tính tiếp được; chữ theo ngôn ngữ đang chọn.
 */
export type ReportSheet = { readonly sheet: string; readonly columns: readonly { readonly width: number }[]; readonly data: Row[] }

/** Mã định dạng số của Excel. */
const COUNT = '#,##0'
const KG = '#,##0.00'
const PERCENT = '0.0'

/**
 * Cột của sheet Chuyến. `statusDetail` là dòng phụ của trạng thái (FE-0-05): chờ duyệt / đã duyệt / lỗi thời, tiến độ kho — cột riêng
 * để cột Trạng thái chỉ có sáu giá trị, lọc được trong Excel.
 */
const TRIP_COLUMNS = [
  'id', 'name', 'date', 'vehicle', 'driver', 'status', 'statusDetail', 'packages', 'cargoWeight', 'volume', 'delivered', 'issues',
] as const

const bold = (value: string): Cell => ({ value, fontWeight: 'bold' })
const numberCell = (value: number | null, format: string): Cell => (value === null ? null : { value, format })

export function reportSheets(summary: DashboardSummary, t: TFunction, format: Formatter, exportedAt: Date): ReportSheet[] {
  const dateCell = (date: string): Cell => ({ value: new Date(`${date}T00:00:00.000Z`), format: t('manager.export.excelDateFormat') })
  return [
    { sheet: t('manager.export.sheets.overview'), columns: [{ width: 32 }, { width: 24 }, { width: 10 }, { width: 70 }], data: overview(summary, t, format, exportedAt) },
    {
      sheet: t('manager.export.sheets.trips'),
      columns: [14, 42, 14, 34, 24, 16, 28, 10, 20, 28, 22, 12].map((width) => ({ width })),
      data: [
        TRIP_COLUMNS.map((key) => bold(t(`manager.export.trips.${key}`))),
        ...summary.trips.map((row): Row => [
          row.id, row.name, dateCell(row.scheduledDate), row.vehicleName, row.driverName, t(`status.${row.status}`),
          row.sub ? tripSubStatusLabel(row.sub, t, format) : null,
          numberCell(row.packageCount, COUNT), numberCell(roundKg(row.cargoWeightKg), KG), numberCell(row.volumePercent, PERCENT),
          numberCell(roundKg(row.deliveredWeightKg), KG), numberCell(row.issueCount, COUNT),
        ]),
      ],
    },
    {
      sheet: t('manager.export.sheets.vehicles'),
      columns: [14, 34, 12, 22, 22].map((width) => ({ width })),
      data: [
        (['id', 'name', 'trips', 'delivered', 'fill'] as const).map((key) => bold(t(`manager.export.vehicles.${key}`))),
        ...summary.byVehicle.map((vehicle): Row => [
          vehicle.vehicleId, vehicle.vehicleName, numberCell(vehicle.tripCount, COUNT), numberCell(vehicle.deliveredWeightKg, KG),
          numberCell(vehicle.averageFillPercent, PERCENT),
        ]),
      ],
    },
  ]
}

function overview(summary: DashboardSummary, t: TFunction, format: Formatter, exportedAt: Date): Row[] {
  const { fill, delivery, vehicles } = summary
  const units = {
    trips: t('manager.export.units.trips'),
    vehicles: t('manager.export.units.vehicles'),
  }
  return [
    [bold(t('manager.export.overview.title'))],
    [t('manager.export.overview.period'), t('manager.period.range', { from: format.date(summary.period.from), to: format.date(summary.period.to) })],
    [t('manager.export.overview.exportedAt'), t('manager.dateTime', { time: format.time(exportedAt), date: format.date(exportedAt) })],
    [],
    [bold(t('manager.export.overview.metric')), bold(t('manager.export.overview.value')), bold(t('manager.export.overview.unit')), bold(t('manager.export.overview.source'))],
    [t('manager.export.overview.tripCount'), numberCell(summary.tripCount, COUNT), units.trips, t('manager.kpi.tripsNote')],
    [t('manager.kpi.trips'), numberCell(summary.completedCount, COUNT), units.trips, null],
    [
      t('manager.kpi.fill'), numberCell(fill.averagePercent, PERCENT), t('manager.export.units.percent'),
      fill.averagePercent === null ? t('manager.kpi.fillEmpty') : t('manager.kpi.fillNote', { count: fill.planCount }),
    ],
    [t('manager.kpi.delivered'), numberCell(summary.deliveredWeightKg, KG), t('manager.export.units.kg'), t('manager.kpi.deliveredNote')],
    [
      t('manager.kpi.clean'), numberCell(delivery.cleanPercent, PERCENT), t('manager.export.units.percent'),
      delivery.cleanPercent === null
        ? t('manager.kpi.cleanEmpty')
        : t('manager.kpi.cleanNote', { clean: format.integer(delivery.cleanItems), total: format.integer(delivery.finishedItems) }),
    ],
    [t('manager.kpi.vehicles'), numberCell(vehicles.inUse, COUNT), units.vehicles, t('manager.kpi.vehiclesNote')],
    ...(fill.isMockResult ? [[], ['MOCK RESULT', null, null, t('manager.export.overview.mockNote')]] : []),
  ]
}
