/**
 * Phản hồi mẫu của `GET /api/manager/dashboard` (`ManagerDashboardResponse`) cho test bảng điều khiển nối backend. Số không có nguồn là
 * `null` như máy chủ trả; BigDecimal có cả dạng số lẫn chuỗi.
 */
export function serverDashboard(overrides: Record<string, unknown> = {}) {
  return {
    from: '2026-10-07',
    to: '2026-11-05',
    tripCount: 12,
    completedCount: 5,
    cancelledCount: 1,
    tripsByStatus: { DRAFT: 0, PLANNED: 3, LOADING: 1, IN_TRANSIT: 2, DELIVERED: 5, CANCELLED: 1 },
    fill: { averagePercent: null, planCount: 0 },
    deliveredWeightKg: '3250.50',
    delivery: { cleanPercent: 87.5, cleanItems: 70, finishedItems: 80 },
    vehicles: { total: 9, inService: 2, available: 4, maintenance: 1, retired: 2 },
    fillByDay: [{ date: '2026-11-03', averagePercent: '72.40', planCount: 2 }],
    weightByVehicle: [
      { vehicleId: 7, vehicleName: 'Hino 500 · 51C-123.45', tripCount: 4, deliveredWeightKg: 2000, averageFillPercent: null },
    ],
    recentTrips: [{
      tripId: 42, tripCode: 'TRIP-20261104-01', tripName: 'Tuyến Biên Hoà – Dĩ An', departureTime: '2026-11-04T07:30:00+07:00',
      status: 'IN_TRANSIT', vehicleName: 'Hino 500 · 51C-123.45', driverName: 'Lê Văn Tài', fillPercent: null,
    }],
    ...overrides,
  }
}
