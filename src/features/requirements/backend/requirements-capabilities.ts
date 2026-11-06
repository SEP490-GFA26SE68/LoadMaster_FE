/**
 * Việc màn Yêu cầu giao làm được khi đọc ghi máy chủ (D-20: không nút giả, không âm thầm ghi vào kho mẫu).
 *
 * - `manage` — tạo, sửa (cả hạn và ưu tiên, gia hạn), xoá: `POST`, `PATCH`, `DELETE /api/delivery-requirements` và
 *   `PATCH …/extend-deadline` đòi quyền `DELIVERY_DEMAND_MANAGE` mà máy chủ chưa giao cho vai trò nào (`RolePermissionMapping`), nên mọi
 *   lượt gọi là 403. Máy chủ giao quyền đó cho điều phối viên thì đổi thành `true`.
 * - `unassign` — gỡ yêu cầu khỏi chuyến: máy chủ chưa có endpoint.
 *
 * Đưa vào chuyến (`POST /api/trips/{tripId}/delivery-requirements/{requirementId}`) và thêm toạ độ (`PATCH …/coordinates`) đã nối.
 */
export const REQUIREMENT_SERVER_SUPPORT = {
  manage: false,
  unassign: false,
} as const
