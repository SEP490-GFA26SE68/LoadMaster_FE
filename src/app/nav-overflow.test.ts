import { expect, test } from 'vitest'
import { visibleNavCount } from './nav-overflow'

const WIDTHS = [100, 100, 100, 100, 100]

test('mọi mục vừa khay thì không có nút Thêm', () => {
  // 5 × 100 + 4 × 2 = 508
  expect(visibleNavCount({ available: 508, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(5)
})

test('thiếu chỗ thì chừa chỗ cho nút Thêm', () => {
  // 3 mục + Thêm: 3 × 102 + 80 = 386
  expect(visibleNavCount({ available: 507, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(4)
  expect(visibleNavCount({ available: 386, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(3)
  expect(visibleNavCount({ available: 385, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(2)
})

test('dung sai nửa điểm ảnh cho số đo lẻ', () => {
  expect(visibleNavCount({ available: 385.6, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(3)
})

test('màn chính luôn hiện, kể cả khi khay quá hẹp', () => {
  expect(visibleNavCount({ available: 50, itemWidths: WIDTHS, gap: 2, moreWidth: 80 })).toBe(1)
})

test('mục đang mở nằm trong Thêm: tính lại với nút mang tên mục đó, chỉ bớt mục', () => {
  // Nút thường 80: 3 mục; mục đang mở là mục 4 (chỉ số 4) nên nút mang tên nó, rộng 150: 3 × 102 + 150 = 456 > 400 → 2 mục
  expect(visibleNavCount({ available: 400, itemWidths: WIDTHS, gap: 2, moreWidth: 80, activeIndex: 4, activeMoreWidth: 150 })).toBe(2)
  // Nút mang tên mục hẹp hơn nút thường: giữ bề rộng lớn hơn, mục đang mở vẫn ở trong Thêm
  expect(visibleNavCount({ available: 386, itemWidths: WIDTHS, gap: 2, moreWidth: 80, activeIndex: 3, activeMoreWidth: 40 })).toBe(3)
})

test('mục đang mở đã hiện trên khay thì không tính lại', () => {
  expect(visibleNavCount({ available: 386, itemWidths: WIDTHS, gap: 2, moreWidth: 80, activeIndex: 0, activeMoreWidth: 300 })).toBe(3)
})
