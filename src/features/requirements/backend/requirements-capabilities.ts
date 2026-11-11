/**
 * Việc màn Yêu cầu giao làm được khi đọc ghi máy chủ (D-20: không nút giả, không âm thầm ghi vào kho mẫu).
 *
 * - `manage` — tạo, sửa (cả hạn và ưu tiên, gia hạn), xoá: `POST`, `PATCH`, `DELETE /api/delivery-requirements` và
 *   `PATCH …/extend-deadline`, quyền `DELIVERY_DEMAND_MANAGE` của điều phối viên.
 * - `unassign` — gỡ yêu cầu khỏi chuyến Nháp / Đã lập kế hoạch: `DELETE /api/trips/{tripId}/delivery-requirements/{requirementId}`.
 *
 * Đưa vào chuyến (`POST /api/trips/{tripId}/delivery-requirements/{requirementId}`) và thêm toạ độ (`PATCH …/coordinates`) cũng đã nối.
 */
export const REQUIREMENT_SERVER_SUPPORT = {
  manage: true,
  unassign: true,
} as const
