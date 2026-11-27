import { splitVehicleName } from '@/lib/vehicle-name'

/**
 * Tên xe dạng "Hyundai HD210 · 60C-446.32" (LM-095): khi thiếu chỗ chỉ xuống dòng trước biển số, không bẻ biển số tại dấu gạch.
 * Dùng ở chi tiết chuyến, danh sách chuyến và bảng điều khiển; tên không có " · " thì xuống dòng như chữ thường.
 */
export function VehicleName({ name, className }: { name: string; className?: string }) {
  const { model, plate } = splitVehicleName(name)
  return (
    <span className={className}>
      {plate === null ? name : <>{`${model} ·`} <span className="whitespace-nowrap">{plate}</span></>}
    </span>
  )
}
