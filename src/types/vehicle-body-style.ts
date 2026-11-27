/**
 * Kiểu thân xe khai ở loại xe: chỉ đổi hình xe minh hoạ ở khung 3D (dáng thân, mũi, đuôi), không vào phép tính, request tối ưu
 * hay luật nào. Vắng là tự chọn theo kích thước lòng thùng và tải trọng (`viewer3d/scene/vehicle-class.ts`). Chỉ liệt kê kiểu
 * khung 3D đang vẽ được (D-20). Bốn kiểu van là thân liền khối; bốn kiểu xe tải là thân đặt sau cabin trên khung sườn.
 */
export const VAN_BODY_STYLES = ['VAN_MINI_FLAT', 'VAN_MINI_HOOD', 'VAN_MID', 'VAN_LARGE'] as const

export const TRUCK_BODY_STYLES = ['TRUCK_BOX', 'TRUCK_CANVAS', 'TRUCK_FLATBED', 'TRUCK_REEFER'] as const

export const VEHICLE_BODY_STYLES = [...VAN_BODY_STYLES, ...TRUCK_BODY_STYLES] as const

export type VanBodyStyle = (typeof VAN_BODY_STYLES)[number]

export type TruckBodyStyle = (typeof TRUCK_BODY_STYLES)[number]

export type VehicleBodyStyle = (typeof VEHICLE_BODY_STYLES)[number]

const VAN_STYLE_SET: ReadonlySet<string> = new Set(VAN_BODY_STYLES)
const BODY_STYLE_SET: ReadonlySet<string> = new Set(VEHICLE_BODY_STYLES)

export function isVanBodyStyle(style: VehicleBodyStyle | undefined): style is VanBodyStyle {
  return style !== undefined && VAN_STYLE_SET.has(style)
}

export function isTruckBodyStyle(style: VehicleBodyStyle | undefined): style is TruckBodyStyle {
  return style !== undefined && !VAN_STYLE_SET.has(style)
}

/** Đọc kiểu thân từ dữ liệu ngoài (máy chủ): giá trị lạ hay vắng là `undefined` — khung 3D tự chọn theo số. */
export function parseVehicleBodyStyle(value: unknown): VehicleBodyStyle | undefined {
  return typeof value === 'string' && BODY_STYLE_SET.has(value) ? (value as VehicleBodyStyle) : undefined
}
