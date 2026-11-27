/**
 * Kiểu thân xe khai ở loại xe: chỉ đổi hình xe minh hoạ ở khung 3D (dáng thân, mũi, đuôi), không vào phép tính, request tối ưu
 * hay luật nào. Vắng là tự chọn theo kích thước lòng thùng và tải trọng (`viewer3d/scene/vehicle-class.ts`). Chỉ liệt kê kiểu
 * khung 3D đang vẽ được (D-20).
 */
export const VEHICLE_BODY_STYLES = ['VAN_MINI_FLAT', 'VAN_MINI_HOOD', 'VAN_MID', 'VAN_LARGE'] as const

export type VehicleBodyStyle = (typeof VEHICLE_BODY_STYLES)[number]
