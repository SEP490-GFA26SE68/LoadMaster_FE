/**
 * Planner 3D theo vật lý (Spec vật lý mục 10): phát theo thời gian thật ước tính × hệ số, giả định bốc tay, trọng tâm hàng G và tải
 * trục theo bước đang xem, thời gian dỡ ước tính của từng điểm giao (`features/viewer3d`).
 */
export const plannerPhysics = {
  duration: {
    seconds: '{seconds} giây',
    minutes: '{minutes} phút',
    minutesSeconds: '{minutes} phút {seconds} giây',
    hoursMinutes: '{hours} giờ {minutes} phút',
  },
  /** Ô thời gian thật ở thanh phát và tờ giả định mở từ nó */
  estimate: {
    loading: 'Xếp ≈ {duration}',
    unloading: 'Dỡ ≈ {duration}',
    caption: 'Thời gian thật ước tính',
    trigger: 'Thời gian thật ước tính của lượt {pass}: {duration}. Xem giả định',
    passes: { loading: 'xếp', unloading: 'dỡ' },
  },
  speed: {
    label: 'Tốc độ phát so với thời gian thật',
    option: '×{scale}',
  },
  assumptions: {
    title: 'Ước tính theo giả định bốc tay — chưa phải số đo của công ty',
    speed: 'Vận tốc bê tối đa {value} m/s',
    acceleration: 'Gia tốc khi bê {value} m/s²',
    handling: 'Thao tác mỗi kiện (cầm, đặt, quét mã) {value} giây',
    distance: 'Quãng bê: từ tâm kiện tới cửa sau, theo chiều dài thùng',
    moved: 'Lượt dỡ cộng hai lượt bê cho mỗi kiện giao sau chắn lối thẳng ra cửa',
    playback: 'Ở ×{scale}, một giây trên màn bằng {scale} giây thật',
  },
  atStep: 'Tại bước {step} / {total}',
  gravity: {
    title: 'Trọng tâm hàng (G)',
    fromFront: 'Cách vách trước {value}',
    lateral: 'Lệch ngang {value}',
    height: 'Cao {value}',
    description: 'Trọng tâm hàng G: cách vách trước {x}, lệch ngang {y} so với giữa thùng, cao {z} trên sàn.',
    empty: 'Chưa có kiện nào trên xe ở bước này.',
  },
  estimateTag: 'Ước tính',
  /** Thời gian dỡ ước tính từng điểm giao ở hộp Chi tiết */
  unloadTime: {
    title: 'Thời gian dỡ ước tính',
    stop: 'Điểm {number} · {name}',
    value: '≈ {duration}',
    moved: { one: 'Dời {count} kiện chắn lối', other: 'Dời {count} kiện chắn lối' },
    total: 'Cả chuyến ≈ {duration}',
    note: 'Chỉ tính thời gian bê trong thùng, chưa gồm đỗ xe, mở thùng, ký nhận.',
  },
} as const
