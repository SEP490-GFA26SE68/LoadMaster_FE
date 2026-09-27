import { expect, test } from 'vitest'
import { cargo, DASHBOARD_PERIOD, dashboardData, revision, trip } from '@/test/dashboard-data'
import { summarizeDashboard } from './dashboard-summary'

/** Kho thu nhỏ và bảng số tính tay: `src/test/dashboard-data.ts`. */

test('KPI của kỳ: chuyến hoàn thành / tổng, lấp đầy trung bình bản đã duyệt, khối lượng đã giao, kiện không sự cố, xe đang chạy', () => {
  const summary = summarizeDashboard(dashboardData(), DASHBOARD_PERIOD)

  expect(summary.period).toStrictEqual(DASHBOARD_PERIOD)
  // 101, 102, 103, 104, 105, 107, 108 — 106 ngoài kỳ; hoàn thành: 101, 108
  expect(summary.tripCount).toBe(7)
  expect(summary.completedCount).toBe(2)
  // (40 + 60 + 50 + 30) / 4 — bỏ chuyến huỷ 103 và 107 chưa duyệt
  expect(summary.fill).toStrictEqual({ averagePercent: 45, planCount: 4, isMockResult: true })
  // 101: 3 × 10 + 1 × 20 = 50 · 102: 3 × 5 + 1 × 15 = 30 · 108: 2 × 8 = 16
  expect(summary.deliveredWeightKg).toBe(96)
  // Điểm đã hoàn tất: 101 có 5 kiện (1 từ chối), 102 điểm 1 có 3 kiện (kiện thiếu ở kho không tính), 108 có 2 kiện
  // (sự cố cả điểm) → 4 + 3 + 0 sạch trên 10
  expect(summary.delivery).toStrictEqual({ cleanPercent: 70, cleanItems: 7, finishedItems: 10 })
  // A đang chạy, B sẵn sàng, C bảo dưỡng — cùng ba trạng thái màn Đội xe đếm
  expect(summary.vehicles).toStrictEqual({ inUse: 1, total: 3, byStatus: { available: 1, in_use: 1, maintenance: 1 } })
})

test('đội xe: xe chưa có trạng thái trong kho là sẵn sàng, như màn Đội xe', () => {
  const data = dashboardData()
  const summary = summarizeDashboard(
    { ...data, vehicleStates: data.vehicleStates.filter((state) => state.vehicleId !== 'VEHICLE-A') },
    DASHBOARD_PERIOD,
  )
  expect(summary.vehicles).toStrictEqual({ inUse: 0, total: 3, byStatus: { available: 2, in_use: 0, maintenance: 1 } })
})

test('ba chuỗi biểu đồ: lấp đầy theo ngày, chuyến theo trạng thái, theo xe', () => {
  const summary = summarizeDashboard(dashboardData(), DASHBOARD_PERIOD)

  expect(summary.fillByDay).toStrictEqual([
    { date: '2026-09-08', averagePercent: null, planCount: 0 },
    { date: '2026-09-09', averagePercent: null, planCount: 0 },
    { date: '2026-09-10', averagePercent: 40, planCount: 1 },
    { date: '2026-09-11', averagePercent: 30, planCount: 1 },
    { date: '2026-09-12', averagePercent: 60, planCount: 1 },
    { date: '2026-09-13', averagePercent: null, planCount: 0 },
    { date: '2026-09-14', averagePercent: 50, planCount: 1 },
  ])
  // Thứ tự vòng đời, chỉ trạng thái có chuyến
  expect(summary.tripsByStatus).toStrictEqual([
    { status: 'nhap', count: 1 },
    { status: 'da_toi_uu', count: 1 },
    { status: 'da_duyet', count: 1 },
    { status: 'dang_van_chuyen', count: 1 },
    { status: 'hoan_thanh', count: 2 },
    { status: 'da_huy', count: 1 },
  ])
  // A: 50 + 30 kg, lấp đầy (40 + 60) / 2 · B: 16 kg, (50 + 30) / 2 · C: chỉ chuyến nháp
  expect(summary.byVehicle).toStrictEqual([
    { vehicleId: 'VEHICLE-A', vehicleName: 'Xe A', tripCount: 3, deliveredWeightKg: 80, averageFillPercent: 50 },
    { vehicleId: 'VEHICLE-B', vehicleName: 'Xe B', tripCount: 3, deliveredWeightKg: 16, averageFillPercent: 40 },
    { vehicleId: 'VEHICLE-C', vehicleName: 'Xe C', tripCount: 1, deliveredWeightKg: 0, averageFillPercent: null },
  ])
})

test('dòng chuyến trong kỳ: ngày chạy mới nhất trước, đủ số của từng chuyến', () => {
  const { trips } = summarizeDashboard(dashboardData(), DASHBOARD_PERIOD)

  expect(trips.map((row) => row.id)).toStrictEqual(['TRIP-104', 'TRIP-105', 'TRIP-107', 'TRIP-102', 'TRIP-108', 'TRIP-101', 'TRIP-103'])
  expect(trips.find((row) => row.id === 'TRIP-101')).toMatchObject({
    name: 'Tuyến TRIP-101', scheduledDate: '2026-09-10', vehicleName: 'Xe A', driverName: 'Phạm Quốc Dũng', status: 'hoan_thanh',
    packageCount: 5, cargoWeightKg: 70, volumePercent: 40, deliveredWeightKg: 50, issueCount: 1,
    plan: { tripId: 'TRIP-101', jobId: 'JOB-REV-101', revisionId: 'REV-101' },
  })
  // Chưa duyệt: không có tỷ lệ lấp đầy, Planner mở bản tối ưu mới nhất; nháp không có phương án
  expect(trips.find((row) => row.id === 'TRIP-107')).toMatchObject({ status: 'da_toi_uu', volumePercent: null, plan: { revisionId: 'REV-107' } })
  expect(trips.find((row) => row.id === 'TRIP-105')).toMatchObject({ status: 'nhap', volumePercent: null, plan: undefined, driverName: null })
})

test('kỳ không có chuyến: mọi tổng bằng 0, tỷ lệ không có, chuỗi rỗng', () => {
  const summary = summarizeDashboard(dashboardData(), { from: '2026-07-01', to: '2026-07-03' })

  expect(summary).toMatchObject({
    tripCount: 0, completedCount: 0, deliveredWeightKg: 0,
    fill: { averagePercent: null, planCount: 0, isMockResult: false },
    delivery: { cleanPercent: null, cleanItems: 0, finishedItems: 0 },
    tripsByStatus: [], byVehicle: [], trips: [],
  })
  expect(summary.fillByDay.every((day) => day.averagePercent === null)).toBe(true)
  // Xe đang chạy là trạng thái lúc này, không theo kỳ
  expect(summary.vehicles).toStrictEqual({ inUse: 1, total: 3, byStatus: { available: 1, in_use: 1, maintenance: 1 } })
})

test('không gắn MOCK RESULT khi mọi bản đã duyệt trong kỳ là kết quả thật', () => {
  const real = trip('TRIP-201', '2026-09-10', 'VEHICLE-A', [cargo('PKG-001', 10, 1)])
  const summary = summarizeDashboard(
    { ...dashboardData(), trips: [{ trip: real, revisions: [revision('REV-201', real, 25, { isMockResult: false })] }] },
    DASHBOARD_PERIOD,
  )
  expect(summary.fill).toStrictEqual({ averagePercent: 25, planCount: 1, isMockResult: false })
})
