/**
 * Hộp thoại chạy tối ưu xếp hàng của máy chủ (đồng hồ, các bước, số sống, đầu vào của lần chạy) và phần thêm của màn So sánh theo lần
 * chạy bản máy chủ (ảnh cách xếp, hồ sơ, biểu đồ điểm, tải trục so giới hạn, phương án trùng). Số đều là số máy chủ trả hoặc của chuyến.
 */
export const serverRun = {
  /** Thời gian tính dễ đọc: dưới 1 giây ghi ms, từ 1 giây ghi giây một chữ số lẻ. */
  time: {
    ms: '{ms} ms',
    seconds: '{seconds} giây',
  },
  clock: {
    label: 'Thời gian đã chạy',
    limit: 'Giới hạn {limit}',
    finishing: 'Đã tới giới hạn thời gian — dịch vụ tối ưu đang hoàn tất…',
  },
  steps: {
    label: 'Các bước của lần chạy',
    queue: { label: 'Chờ tới lượt', note: 'Lần chạy đang chờ dịch vụ tối ưu nhận việc.' },
    compute: { label: 'Tính ba phương án', note: 'Dịch vụ tối ưu đang xếp hàng của chuyến vào thùng xe.' },
    build: { label: 'Xếp thử các cách đầu tiên', note: 'Đang thử đặt kiện vào thùng theo nhiều cách khác nhau.' },
    improve: { label: 'Tìm cách xếp tốt hơn', note: 'Đang tìm cách xếp được nhiều hàng hơn, cân hơn từ các cách đã có.' },
    select: { label: 'Chọn ba phương án và chấm điểm', note: 'Đang chọn ba phương án A · B · C và chấm điểm theo hồ sơ của từng phương án.' },
    save: { label: 'Kiểm lại và lưu kết quả', note: 'Đang kiểm lại ràng buộc của từng phương án rồi lưu.' },
  },
  algorithm: 'Thuật toán đang chạy',
  live: {
    layouts: 'Cách xếp đã thử',
    placed: 'Xếp được nhiều nhất',
    placedValue: '{placed} / {total} kiện',
    volume: 'Lấp đầy cao nhất',
  },
  inputs: {
    title: 'Đầu vào của lần chạy',
    packages: 'Số kiện',
    stops: 'Điểm giao',
    vehicle: 'Xe',
  },
  compare: {
    runComputation: 'Thời gian tính của lần chạy',
    placed: 'Kiện xếp được',
    placedValue: '{placed} / {total}',
    placedRange: '{min}–{max} / {total}',
    thumbnail: 'Cách xếp của phương án {label}: {placed} / {total} kiện trong thùng, nhìn từ phía cửa sau',
    profile: {
      A: 'Ưu tiên chở được nhiều hàng nhất trong một chuyến.',
      B: 'Ưu tiên tải đặt an toàn: trọng tâm thấp và giữa thùng, hai trục cân bằng.',
      C: 'Ưu tiên dỡ nhanh ở từng điểm giao: ít kiện phải dỡ ra rồi xếp lại.',
      default: 'Hồ sơ mặc định: cân giữa lượng hàng chở được và các khoản trừ.',
    },
    bars: {
      title: 'Điểm cộng và điểm trừ',
      plus: '+{points}',
      minus: '−{points}',
      biggest: 'Khoản trừ lớn nhất: {name}, {points} điểm.',
      noPenalty: 'Không khoản trừ nào lấy điểm của phương án này.',
    },
    axle: {
      usage: '{load} / {limit}',
      over: 'Vượt {kg}',
    },
    sameAs: {
      text: 'Cùng cách xếp với phương án {label}: ảnh và chỉ số giống hệt. Điểm có thể khác vì phương án này được chấm theo hồ sơ của nó.',
    },
  },
} as const
