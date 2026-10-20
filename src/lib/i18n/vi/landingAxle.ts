/**
 * Mục tải trục của trang giới thiệu (`LandingAxle`, neo `#tai-truc`): người xem dời khối hàng trong thùng một xe mẫu của seed, số tính bằng
 * mô hình đòn bẩy của domain (`axleLoadsOf`) trên hai trục khai của xe đó, kèm MOCK RESULT. Mọi số đi qua tham số, định dạng theo ngôn ngữ.
 */
export const landingAxle = {
  title: 'Tải trục trong giới hạn',
  lede: 'Dời khối hàng trong thùng xe mẫu và xem tải trên trục trước, trục sau đổi theo — cùng phép tính mà ứng dụng dùng để chặn duyệt phương án vượt trục.',
  /** Nhãn đặt đè lên hình xe nhìn ngang (chữ HTML, hình là trang trí). */
  figure: {
    frontWall: 'Vách trước',
    door: 'Cửa sau',
    center: 'Trọng tâm',
  },
  controls: {
    title: 'Khối hàng',
    center: 'Trọng tâm hàng, tính từ vách trước',
    centerValue: '{value} từ vách trước',
    weight: 'Khối lượng hàng',
  },
  readout: {
    title: 'Tải trên từng trục',
    groups: {
      front: 'Trục trước',
      rear: 'Trục sau',
    },
    load: '{load} / {limit}',
    within: 'Trong giới hạn',
    over: 'Vượt {over}',
    /** Tải của trục tách hai phần: tải khi xe rỗng và phần hàng dồn lên (hàng sau trục sau thì nhấc bớt tải khỏi trục trước). */
    added: 'Xe rỗng {empty} · hàng dồn lên {cargo}',
    lifted: 'Xe rỗng {empty} · hàng nhấc bớt {cargo}',
  },
  /** Câu đọc cho trình đọc màn hình (vùng `aria-live` lịch sự) khi người xem thôi kéo. */
  announce: {
    within: '{group} {load}, trong giới hạn {limit}.',
    over: '{group} {load}, vượt giới hạn {limit} là {over}.',
  },
  model: 'Mô hình đòn bẩy của ứng dụng: trọng tâm hàng càng gần trục nào, trục đó chịu càng nhiều; cộng thêm tải khi xe rỗng. Số là ước lượng, không thay cho cân tải trọng trục thật.',
  source: 'Xe mẫu: thùng {dimensions}, tải trọng {payload}. Trục trước nằm dưới cabin, trước vách trước {front}; trục sau cách vách trước {rear}. Vị trí, tải khi xe rỗng và giới hạn của hai trục là số ước lượng theo cỡ xe, chưa đối chiếu thông số nhà sản xuất.',
} as const
