/**
 * Khoảng nâng nút "Hỏi Lumo" để không che điều khiển quan trọng của trang (thuần): nút chính của phần mở đầu, nút tạm dừng của khung 3D và
 * nút "Lên đầu trang" của chân trang mang `data-assistant-avoid`. `zone` là chỗ của nút ở vị trí gốc (chưa nâng) — tính từ vị trí gốc nên
 * không tự đuổi theo chính mình. Phần tử nào chồng lên vùng đó (kèm khe `gap` mỗi phía) thì nút nâng lên tới trên mép trên của phần tử,
 * cách `gap`.
 */
export type Box = { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }

export const LIFT_GAP = 12

export function launcherLift(zone: Box, avoid: readonly Box[], gap: number = LIFT_GAP): number {
  let lift = 0
  for (const box of avoid) {
    const overlapsX = box.left < zone.right + gap && box.right > zone.left - gap
    const overlapsY = box.top < zone.bottom + gap && box.bottom > zone.top - gap
    if (overlapsX && overlapsY) lift = Math.max(lift, zone.bottom + gap - box.top)
  }
  return Math.max(0, Math.round(lift))
}
