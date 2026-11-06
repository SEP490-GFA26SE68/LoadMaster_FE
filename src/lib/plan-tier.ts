/**
 * Nhãn hạng đặt cạnh tên gói, hoặc `null` khi tên gói đã nói đúng hạng đó: gói của máy chủ thường tên "Pro", "Basic" trùng hạng (khác
 * hoa thường cũng tính là trùng), hiện cả hai là "Pro Pro". Dùng ở mọi chỗ ghi tên gói kèm hạng.
 */
export function tierBesideName(name: string, tierLabel: string): string | null {
  const same = name.trim().toLocaleLowerCase('vi') === tierLabel.trim().toLocaleLowerCase('vi')
  return same ? null : tierLabel
}
