/**
 * Khung chung của hai trang pháp lý công khai — Chính sách bảo mật `/chinh-sach-bao-mat` và Điều khoản sử dụng `/dieu-khoan-su-dung`
 * (`features/marketing/legal`): bộ chuyển giữa hai tài liệu, ngày cập nhật, khối tóm tắt, mục lục, thẻ đọc cùng và thẻ "Còn câu hỏi?".
 * Nội dung của từng trang ở nhánh `privacy` và `terms`. Dòng email, điện thoại, địa chỉ, mã số thuế chỉ vẽ khi `SITE_INFO` có giá trị.
 */
export const legal = {
  docs: {
    label: 'Điều khoản và chính sách',
    privacy: 'Chính sách bảo mật',
    terms: 'Điều khoản sử dụng',
  },
  updated: 'Cập nhật lần cuối: {date}',
  print: 'In trang này',
  summary: {
    title: 'Tóm tắt nhanh',
    note: 'Phần tóm tắt để đọc nhanh; nội dung đầy đủ nằm ở các mục bên dưới.',
  },
  toc: {
    title: 'Mục lục',
    count: { one: '{count} mục', other: '{count} mục' },
  },
  related: {
    title: 'Đọc cùng',
    privacy: 'Chính sách bảo mật nói LoadMaster thu dữ liệu nào, gửi tới đâu và lưu ở đâu.',
    privacyAction: 'Đọc Chính sách bảo mật',
    terms: 'Điều khoản sử dụng nói về tài khoản, gói cước, credit và trách nhiệm khi dùng kết quả tối ưu.',
    termsAction: 'Đọc Điều khoản sử dụng',
  },
  closing: {
    title: 'Còn câu hỏi?',
    body: 'Gửi câu hỏi về trang này qua form liên hệ ở trang giới thiệu.',
    action: 'Mở form liên hệ',
    email: 'Hoặc viết tới {email}.',
    phone: 'Điện thoại: {phone}',
    address: 'Địa chỉ: {address}',
    taxCode: 'Mã số thuế: {code}',
  },
} as const
