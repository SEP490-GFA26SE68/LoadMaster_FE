/**
 * Dải "Vì sao xếp tay không xuể" cuối khối tối mở đầu của trang giới thiệu (`features/marketing/why`): khách chọn số điểm giao và số
 * kiện, trang đếm tại chỗ số thứ tự đi qua các điểm (n!) và số cách chọn hướng đặt (sáu hướng mỗi kiện) — phép đếm thuần ở
 * `why-count.ts`, không phải số đo của ai. Số lớn viết gọn "a × 10^b"; `approx` là cách đọc cho trình đọc màn hình.
 */
export const landingWhy = {
  title: 'Vì sao xếp tay không xuể',
  stops: {
    label: 'Số điểm giao',
    value: { one: '{count} điểm giao', other: '{count} điểm giao' },
  },
  packages: {
    label: 'Số kiện',
  },
  orders: { one: 'Thứ tự đi qua {count} điểm giao', other: 'Thứ tự đi qua {count} điểm giao' },
  orientations: { one: 'Cách chọn hướng đặt cho {count} kiện', other: 'Cách chọn hướng đặt cho {count} kiện' },
  /** Số lớn đọc thành lời: "khoảng 6,5 nhân 10 mũ 77". */
  approx: 'khoảng {mantissa} nhân 10 mũ {exponent}',
  digits: { one: 'số dài {count} chữ số', other: 'số dài {count} chữ số' },
  closing: {
    one: 'Mỗi kiện có {base} hướng đặt, chưa kể vị trí trong thùng. Bộ tối ưu của LoadMaster xét thay bạn và trả về {count} phương án.',
    other: 'Mỗi kiện có {base} hướng đặt, chưa kể vị trí trong thùng. Bộ tối ưu của LoadMaster xét thay bạn và trả về {count} phương án.',
  },
} as const
