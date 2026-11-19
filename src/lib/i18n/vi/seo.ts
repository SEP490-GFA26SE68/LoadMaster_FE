/**
 * Mô tả của từng trang công khai cho công cụ tìm kiếm và ô xem trước khi chia sẻ liên kết (`app/route-title.ts` → `lib/seo`). Khoá trùng
 * `SEO_PAGES` (`lib/seo/site-files.ts`). `landing` cũng là mô tả mặc định: `index.html` chép đúng câu đó cho bộ cào không chạy JavaScript
 * (`lib/seo/index-html.test.ts` canh), và màn không lập chỉ mục dùng lại nó. Mỗi câu nói đúng điều trang đang có — không lời khen, không số.
 */
export const seo = {
  pages: {
    landing:
      'LoadMaster giúp doanh nghiệp vận tải vừa và nhỏ lập chuyến, tối ưu tuyến và xếp hàng 3D lên thùng xe; kho xếp và tài xế dỡ theo cùng một phương án đã duyệt.',
    pricing: 'Các gói cước LoadMaster đang bán: giá mỗi tháng, credit mỗi tháng và hạng tối ưu của từng gói.',
    privacy: 'LoadMaster thu dữ liệu nào, dùng vào việc gì, gửi tới đâu, lưu ở đâu, và cách bạn yêu cầu xem, sửa hoặc xoá dữ liệu của mình.',
    terms: 'Điều khoản sử dụng LoadMaster: tài khoản, dùng thử, gói cước và credit, và trách nhiệm của bạn khi dùng kết quả tối ưu.',
    samplePlan: 'Phương án xếp hàng 3D của một chuyến mẫu, do bộ tối ưu mô phỏng của LoadMaster tính ngay trên trình duyệt.',
  },
} as const
