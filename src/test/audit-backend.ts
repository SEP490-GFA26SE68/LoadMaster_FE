/** Bản ghi mẫu của `GET /api/audit-logs` (`AuditLogResponse`) và trang `PageResponse` bọc chúng, cho test Nhật ký nối backend. */
export function serverAuditLog(overrides: Record<string, unknown> = {}) {
  return {
    id: 501, actionType: 'TRIP_STATUS_TRANSITION', entityName: 'Trip', entityId: '42', userId: 7, userName: 'Phạm Minh Khôi',
    userRole: 'DISPATCHER', companyId: 1, companyName: 'Vận tải Long Bình', oldValues: { status: 'PLANNED' },
    newValues: { status: 'LOADING' }, ipAddress: '10.0.0.5', createdAt: '2026-11-04T02:15:00Z', ...overrides,
  }
}

export function auditPage(rows: readonly unknown[], { page = 0, size = 50, totalElements = rows.length } = {}) {
  return {
    success: true, data: rows, page, size, totalElements, totalPages: Math.max(1, Math.ceil(totalElements / size)),
    last: (page + 1) * size >= totalElements,
  }
}
