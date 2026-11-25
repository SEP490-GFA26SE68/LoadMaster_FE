/**
 * Mẫu "priority+" của thanh điều hướng (`NavRail`): khay kính hiện những mục vừa chỗ theo thứ tự của `NAV_ITEMS` (màn chính đứng đầu
 * nên luôn hiện), mục còn lại dồn vào nút "Thêm" ở cuối khay. Hàm thuần — số đo do `NavRail` đọc từ bản đo ẩn.
 */
export type NavOverflowInput = {
  /** Bề rộng dành cho nội dung khay (đã trừ lề trong và viền của khay). */
  readonly available: number
  /** Bề rộng thật của từng mục, theo thứ tự hiển thị. */
  readonly itemWidths: readonly number[]
  /** Khoảng cách giữa hai phần tử của khay. */
  readonly gap: number
  /** Bề rộng nút "Thêm" ở dạng thường (chữ "Thêm"). */
  readonly moreWidth: number
  /** Mục đang mở (chỉ số trong `itemWidths`), -1 khi màn không thuộc mục nào. */
  readonly activeIndex?: number
  /** Bề rộng nút "Thêm" khi mang tên mục đang mở (mục đó nằm trong "Thêm"). */
  readonly activeMoreWidth?: number
}

/** Dung sai số đo lẻ điểm ảnh: bề rộng đọc từ `getBoundingClientRect` có phần thập phân. */
const TOLERANCE = 0.5

function fitting(available: number, itemWidths: readonly number[], gap: number, moreWidth: number): number {
  const total = itemWidths.reduce((sum, width) => sum + width, 0) + gap * Math.max(itemWidths.length - 1, 0)
  if (total <= available + TOLERANCE) return itemWidths.length
  // k mục + nút "Thêm": k khoảng cách
  let used = moreWidth
  let count = 0
  for (const width of itemWidths) {
    if (used + width + gap > available + TOLERANCE) break
    used += width + gap
    count += 1
  }
  // Màn chính luôn hiện, kể cả khi khay hẹp tới mức không còn chỗ (thực tế mục chỉ còn icon từ dưới 1.340 px)
  return Math.min(Math.max(count, 1), itemWidths.length)
}

/**
 * Số mục hiện trên khay; các mục từ chỉ số đó trở đi nằm trong nút "Thêm". Mục đang mở rơi vào "Thêm" thì nút mang tên mục đó — tính lại
 * với bề rộng lớn hơn của hai dạng nút, nên số mục chỉ giảm và mục đang mở vẫn nằm trong "Thêm" (không nhảy qua lại giữa hai kết quả).
 */
export function visibleNavCount({ available, itemWidths, gap, moreWidth, activeIndex = -1, activeMoreWidth }: NavOverflowInput): number {
  const count = fitting(available, itemWidths, gap, moreWidth)
  if (count === itemWidths.length || activeIndex < count || activeMoreWidth === undefined) return count
  return fitting(available, itemWidths, gap, Math.max(moreWidth, activeMoreWidth))
}
