/**
 * Dòng mô tả dưới tiêu đề màn (`components/PageHero.tsx`, V2). Một câu nói màn dùng để làm gì — không số liệu, không
 * trạng thái: những thứ đó nằm trong nội dung màn và phải truy được về kho (AGENTS mục 6).
 */
export const pageHero = {
  breadcrumb: 'Vị trí trang',
  trips: 'Chuyến trong kỳ, trạng thái phương án và việc cần xử lý trước khi bàn giao kho.',
  tripForm: 'Nhập thông tin chuyến, chọn xe và sắp thứ tự điểm giao.',
  optimization: 'Khai báo yêu cầu xếp và kiểm tra đầu vào trước khi chạy tối ưu.',
  fleet: 'Trạng thái đội xe và xe đang phục vụ chuyến nào.',
  dashboard: 'Chuyến, tỷ lệ lấp đầy và khối lượng đã giao trong kỳ đang xem.',
  users: 'Tài khoản, vai trò và quyền trong hệ thống.',
  audit: 'Sự kiện ghi lại từ các thao tác có ghi dữ liệu.',
  profile: 'Thông tin cá nhân và mật khẩu đăng nhập.',
  // Review 1 (LM-104)
  packageTypes: 'Khuôn kích thước, khối lượng và cách xếp để đăng ký kiện.',
  packages: 'Kiện của công ty đã đăng ký, mã QR và trạng thái tới khi giao.',
  labels: 'Nhãn QR của kiện đã đăng ký, in để dán lên từng kiện.',
  shipments: 'Nhóm kiện đã đăng ký và bàn giao cho công ty logistics.',
  shipment: 'Kiện trong lô và tiến độ công ty logistics quét nhận.',
  receiving: 'Quét mã QR từng kiện để xác nhận đã nhận lô hàng.',
  orders: 'Đơn vận chuyển từ kiện đã nhận, gán vào điểm giao của chuyến.',
  review: 'Phương án tối ưu đang chờ quản lý duyệt, từ chối hoặc yêu cầu tối ưu lại.',
  vehicleTypes: 'Kích thước lòng thùng và tải trọng theo loại xe.',
  tripReport: 'Kiện đã giao, sự cố và thời gian xếp, giao của chuyến.',
} as const
