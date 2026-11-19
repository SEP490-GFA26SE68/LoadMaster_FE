/**
 * Chân trang của các trang công khai — giới thiệu, bảng giá, chính sách bảo mật (`PublicFooter`, `features/marketing/footer`). Thông tin
 * liên hệ chỉ lấy từ `SITE_INFO` (`lib/site-info.ts`): mục nào chưa có (email, điện thoại, địa chỉ, mã số thuế) thì không vẽ dòng đó.
 * Liên kết chỉ trỏ tới thứ đang có: các phần của trang giới thiệu (kể cả Hỏi đáp), Bảng giá, chính sách bảo mật, đăng nhập và — khi khách
 * tự đăng ký được — hai trang đăng ký.
 */
export const landingFooter = {
  title: 'Chân trang',
  /** Tên của vùng chân trang cho trình đọc màn hình. */
  label: 'Thông tin và liên kết của LoadMaster',
  description:
    'Lập kế hoạch và tối ưu xếp hàng 3D cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam: lập chuyến, tối ưu tuyến, rồi kho xếp và tài xế dỡ theo cùng một phương án đã duyệt.',
  /** Khối liên hệ dưới logo: nhãn của từng dòng (trình đọc màn hình đọc kèm giá trị). */
  contact: {
    email: 'Email hỗ trợ',
    phone: 'Điện thoại',
    address: 'Địa chỉ',
  },
  /** Lối gửi yêu cầu liên hệ — nút phụ: nút chính của trang giới thiệu là "Nhận tư vấn" ở phần mở đầu. */
  cta: 'Nhận tư vấn cho đội xe của bạn',
  columns: {
    product: 'Sản phẩm',
    roles: 'Dành cho',
    support: 'Hỗ trợ',
    account: 'Tài khoản',
  },
  links: {
    how: 'Cách hoạt động',
    plans: 'Gói cước',
    pricing: 'Bảng giá',
    faq: 'Hỏi đáp',
    contact: 'Liên hệ tư vấn',
    privacy: 'Chính sách bảo mật',
    terms: 'Điều khoản sử dụng',
    /** Chỉ có khi `SITE_INFO.supportEmail` có giá trị. */
    email: 'Email hỗ trợ',
    signIn: 'Đăng nhập',
    openApp: 'Vào ứng dụng',
    /** Hai lối đăng ký của khách chưa đăng nhập — chỉ khi nhóm `registration` nối máy chủ; cùng chữ với đầu trang. */
    trial: 'Đăng ký trải nghiệm',
    registerNow: 'Đăng ký dùng ngay',
  },
  /** `{year}` truyền vào là chuỗi — năm không nhóm số ("2026", không "2.026"); `{name}` là tên riêng của sản phẩm. */
  copyright: '© {year} {name}',
  taxCode: 'Mã số thuế {code}',
  /** Ghi công thiết kế: giữ nguyên chữ ở mọi ngôn ngữ (tên riêng). */
  credit: 'Design by Kangnahyun',
  backToTop: 'Lên đầu trang',
  /** Chỗ focus dừng lại sau "Lên đầu trang" — chỉ trình đọc màn hình đọc thấy. */
  pageTop: 'Đầu trang',
} as const
