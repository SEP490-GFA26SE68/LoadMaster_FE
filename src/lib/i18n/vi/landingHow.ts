/**
 * "Tính thế nào?" trên các con số của trang công khai (nút `components/HowComputed`, chữ của nút ở `common.howComputed`): khung 3D mở đầu, "Thử với hàng của bạn" (thẻ
 * phương án, tab Tải trục) và trang `/phuong-an-mau`. Mỗi câu nói công thức bằng lời thường, tham số là số đã tính của chính lần chạy.
 * Không tên thuật toán; trang công khai gọi là "bộ tối ưu mô phỏng".
 */
export const landingHow = {
  source: 'Mọi số do bộ tối ưu mô phỏng của LoadMaster tính trên trình duyệt của bạn, từ đúng lần chạy này.',
  placed: {
    label: 'Xếp được',
    text: 'Đếm kiện có chỗ trong thùng: {placed} trên {total} kiện của lần chạy.',
  },
  volume: {
    label: 'Lấp đầy thể tích',
    text: 'Tổng thể tích {placed} kiện đã xếp ({used}) ÷ thể tích lòng thùng ({total}) = {value}.',
  },
  payload: {
    label: 'Tải trọng đã dùng',
    text: 'Tổng khối lượng {placed} kiện đã xếp ({used}) ÷ tải trọng xe ({max}) = {value}.',
  },
  axleGap: {
    label: 'Chênh tải hai trục',
    text: 'Mức dùng của mỗi nhóm trục = tải ÷ giới hạn. Trước: {frontLoad} ÷ {frontLimit} = {front}. Sau: {rearLoad} ÷ {rearLimit} = {rear}. Chênh nhau {value} điểm %.',
  },
  rehandling: {
    label: 'Kiện dỡ-xếp lại',
    text: 'Sàn thùng chia thành vùng theo điểm giao, điểm giao đầu sát cửa. Kiện có tâm nằm trong vùng của điểm khác tính một lần dỡ-xếp lại: {value} trên {placed} kiện đã xếp.',
  },
  unplaced: {
    label: 'Chưa xếp',
    text: '{total} kiện của lần chạy − {placed} kiện đã xếp = {value}.',
  },
  balance: {
    label: 'Trọng tâm lệch giữa thùng',
    text: 'Trọng tâm hàng cách vách trước {center}; giữa chiều dài thùng là {middle}. Lệch nhau {value}.',
  },
  /** Tab Tải trục: mô hình đòn bẩy trên hai trục của xe mẫu. */
  axle: {
    shareLabel: 'Hàng chia cho hai trục',
    share: 'Trục sau nhận {mass} × khoảng cách từ trọng tâm tới trục trước ({arm}) ÷ khoảng cách hai trục ({wheelbase}) = {rear}. Phần còn lại, {front}, dồn lên trục trước.',
    shareLift: 'Trục sau nhận {mass} × khoảng cách từ trọng tâm tới trục trước ({arm}) ÷ khoảng cách hai trục ({wheelbase}) = {rear}. Trọng tâm nằm sau trục sau nên hàng nhấc bớt {front} khỏi trục trước.',
    frontLabel: 'Tải trục trước',
    rearLabel: 'Tải trục sau',
    load: 'Tải khi xe rỗng {empty} + phần hàng {cargo} = {value}; giới hạn của trục là {limit}.',
  },
} as const
