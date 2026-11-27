/**
 * Tên xe theo quy ước "Tên · biển số" (LM-095, ví dụ "Hyundai HD210 · 60C-446.32"): cắt tại dấu " · " **cuối cùng**. Tên không có
 * dấu đó thì không có biển số — không đoán biển số từ chữ.
 */
export function splitVehicleName(name: string): { model: string; plate: string | null } {
  const cut = name.lastIndexOf(' · ')
  if (cut === -1) return { model: name, plate: null }
  const plate = name.slice(cut + 3).trim()
  return { model: name.slice(0, cut), plate: plate || null }
}
