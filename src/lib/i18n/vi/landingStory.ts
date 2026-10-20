/**
 * Lời của linh vật Lumo trên trang giới thiệu công khai `/gioi-thieu` (`features/marketing`, bong bóng `LumoSays`) và câu của dải nguyên
 * tắc xếp hàng (`StatementBand`). Mỗi phần của trang tối đa một Lumo, một câu hướng dẫn thật về sản phẩm; lời dẫn khung 3D (`lumo.hero`)
 * đổi theo pha của chuyến mẫu. Không chữ số nào — số chỉ nằm ở chỗ có nguồn —, lời dẫn khung 3D tối đa 80 ký tự, câu khác tối đa 120, không
 * mời đăng ký hay mua gói (`landing-story-copy.test.ts` canh). Tên Lumo là tên riêng, không dịch: câu dùng tham số `{name}`.
 */
export const landingStory = {
  lumo: {
    /** Tiền tố `sr-only` đứng trước mọi bong bóng, để trình đọc màn hình biết ai đang nói. */
    says: '{name} nói:',
    /** Lời dẫn của khung 3D theo pha của chuyện: chuẩn bị, nhập kiện, tối ưu, xếp, xếp xong (hết hay còn kiện chưa xếp), hình dự phòng. */
    hero: {
      preparing: 'Mình đang nhờ bộ tối ưu mô phỏng tính một chuyến mẫu.',
      intake: 'Kiện của mỗi điểm giao chờ ở một làn, cùng màu với điểm đó.',
      optimize: 'Thùng được chia vùng: điểm cuối nằm sâu nhất, điểm đầu sát cửa.',
      loading: 'Hàng của điểm cuối lên trước. Kiện rời làn đúng lúc vào thùng.',
      ready: 'Xếp xong, chờ xuất phát. Số bên dưới là của chính lần chạy này.',
      readyPartial: 'Có kiện chưa xếp được. Số bên dưới ghi đúng lần chạy này.',
      fallback: 'Khung xe không hiện được ở đây, nên mình gửi bạn hình minh hoạ.',
    },
    /** Dải số liệu `#con-so`. */
    facts: 'Đây là các con số cố định của chính ứng dụng, không phải số của một chuyến hàng nào.',
    /** Cách hoạt động `#cach-hoat-dong`: một câu cho mỗi bước của danh sách, thêm câu cho lúc chuyến đã giao xong. */
    how: {
      intake: 'Mỗi kiện có nhãn QR riêng, nên lúc soạn, xếp hay dỡ đều đối chiếu được.',
      plan: 'Điểm giao sinh ra từ yêu cầu giao; tối ưu tuyến xếp thứ tự đi và tính giờ đến dự kiến.',
      optimize: 'Bạn xem các phương án cạnh nhau, chỉnh tay nếu cần rồi mới duyệt — kho chỉ nhận bản đã duyệt.',
      operate: 'Kho đối chiếu từng kiện khi xếp, tài xế đối chiếu khi dỡ — đều theo phương án đã duyệt.',
      done: 'Giao xong điểm cuối là có báo cáo chuyến.',
    },
    /** Gói cước `#goi-cuoc`. */
    plans: 'Chưa chắc gói nào hợp? Gửi yêu cầu, đội LoadMaster tư vấn theo đội xe của bạn.',
    /** Liên hệ `#lien-he`: chỉ tới ô "Bạn cần gì" của form (`landing.contact.form.type`). */
    contact: 'Cần báo giá, xem demo hay hỏi hợp đồng? Chọn ở ô “Bạn cần gì” để đội LoadMaster trả lời đúng việc.',
  },
  /** Dải nguyên tắc xếp hàng giữa Tính năng và Cách hoạt động. */
  statement: 'Hàng giao sau lên xe trước. Hàng giao trước nằm sát cửa. Tới điểm nào, lấy hàng điểm đó.',
} as const
