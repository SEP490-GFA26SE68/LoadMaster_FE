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
  packageTypes: 'Khuôn kích thước, khối lượng và cách xếp gắn cho kiện của kho kiện.',
  packages: 'Kiện của công ty: thêm lẻ hoặc nhập file, in nhãn QR, theo dõi trạng thái tới khi giao.',
  labels: 'Nhãn QR của kiện trong kho kiện, in để dán lên từng kiện.',
  lookup: 'Quét hoặc gõ mã để xem kiện đang ở trạng thái nào, thuộc chuyến nào và in lại nhãn.',
  requirements: 'Việc cần giao: kiện từ kho kiện tới một điểm đến trước hạn, chờ điều phối viên đưa vào chuyến.',
  vehicleTypes: 'Kích thước lòng thùng và tải trọng theo loại xe.',
  tripReport: 'Kiện đã giao, sự cố và thời gian xếp, giao của chuyến.',
} as const
