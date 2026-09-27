---
id: LM-103
title: V2.3 đợt 3 — Chuyến hàng: danh sách, tạo/sửa, chi tiết (7 trạng thái), kiện
phase: V2.3
labels: [design, ui, trips]
depends_on: [LM-102]
estimate: 4d
prd: []
---

# LM-103 — V2.3 đợt 3: Chuyến hàng

Nguồn: [design/v2.3/README.md](../../design/v2.3/README.md) (đợt 3), [CHANGES.md](../../design/v2.3/CHANGES.md) mục 2 "Chi tiết chuyến",
[SCREENS.md](../../design/v2.3/SCREENS.md) nhóm Điều phối. Nhánh `feat/v2-3-chuyen`, tách từ `developer` sau khi gộp đợt 2 (PR #3).

Màn của đợt: `ChuyenHang` (/chuyen), `TaoChuyen` (/chuyen/moi), `SuaChuyenKhoa` (/chuyen/TRIP-011/sua), `ChiTietChuyen` và sáu trạng thái
(`Nhap`, `CanXemLai`, `DangXep`, `DangGiao`, `HoanThanh`, `Huy`), `ChiTietChuyenKien`, `ChiTietChuyenKienDayDu`, và các hộp thoại chuyến của
`HopThoaiChuyen` (huỷ chuyến, xoá kiện, nhập file, rời trang, khôi phục).

Phần dùng chung làm trước: `PageHero` có `crumbs` (đường dẫn) và `badge` (chip cạnh tiêu đề), `Button variant="skyGhost"`.

## Danh sách lệch (chụp trước khi sửa, 1536 px)

Ảnh trước: `docs/screenshots/v2.3/dot3-chuyen/before-*.png`.

**Danh sách chuyến (`ChuyenHang`)**
- Câu mô tả dưới tiêu đề → dòng số đếm "15 chuyến · 3 đang chạy · 2 cần bạn xử lý".
- Hàng ba ô số liệu → sáu tab giai đoạn có số đếm trên dải trời ("Cần xử lý" hổ phách).
- Ô tìm lớn + bộ lọc có nhãn + hai ô ngày luôn hiện → ô tìm 340 px + chip "Ngày chạy / Xe / Tài xế", "Xoá lọc", ghi chú nhóm.
- Cột ngày chạy → dòng nhóm theo ngày chạy ("Thứ Ba, 29/09 · 1 chuyến", tag Hôm nay / Ngày mai).
- Cột "Chuyến và tuyến", xe hai dòng "tên · biển", tài xế chữ trần, số kiện kèm số điểm → Tuyến (tên + "N điểm · điểm → điểm"), xe tên + biển
  mono, tài xế ô chữ tắt + tên / "Chưa gán tài xế", kiện chỉ số, mũi tên cuối dòng.

**Tạo / sửa chuyến (`TaoChuyen`, `SuaChuyenKhoa`, hộp thoại rời trang)**
- Nút quay lại, không hành động ở đầu, thanh Lưu/Huỷ cuối form → đường dẫn + "Huỷ" và nút chính trên dải trời.
- Form rộng tối đa 1.200 px, cột phải 288 px → rộng hết, cột phải 416 px.
- Số mục viền mảnh → ô số đậm 28 px, tiêu đề Archivo, số điểm giao, tag "Đã khoá".
- Thiếu dấu bắt buộc, "(không bắt buộc)", gợi ý ngày chạy ("Thứ Sáu · ngày mai"); khối xe không có trạng thái.
- Điểm giao nhãn dài, khoá thì là ô vô hiệu hai dòng → nhãn ngắn; khoá thì bảng chỉ đọc bốn cột.
- Danh sách kiểm tĩnh bốn dòng xám → thẻ đọc trực tiếp form: số lỗi, từng mục đạt / lỗi / khoá, câu lỗi và "Tới ô cần sửa".
- Tóm tắt hai dòng không tiêu đề → thẻ "Tóm tắt chuyến" (xe, lòng thùng, tải trọng, điểm giao, kiện + khối lượng khi sửa).

**Chi tiết chuyến (7 trạng thái + hộp thoại huỷ)**
- Header trắng 72 px, tiêu đề là mã chuyến → dải trời: đường dẫn, tên tuyến, chip trạng thái, dòng ngày · xe · tài xế.
- Thẻ tiến trình trắng → bước tiến trình trong dải trời (giờ + người thực hiện từ dữ liệu, "Tiếp theo").
- Chỉ một nút theo `runnable` → quyết định 1: có phương án thì "Xem phương án 3D" (chính) + "Chạy tối ưu" (kính); nháp chỉ "Chạy tối ưu".
- Cột trái tổng + danh sách điểm giao dọc → thẻ tuyến ngang đè dải trời; cột phải "Tải và thể tích" + "Xe và tài xế".
- Cần xem lại: không có banner → banner nói **vì sao** lỗi thời (mục đổi, trước → sau, giờ, người sửa) + "Tới Thiết lập tối ưu", bước Duyệt
  gắn "Lỗi thời". Đang xếp: thêm "Vẫn sửa được tên, ngày chạy và tài xế" + tiến độ kho. Đang giao / hoàn thành: tổng điểm, kiện đã dỡ, sự
  cố. Đã huỷ: bước huỷ đỏ, "Chỉ xem".
- Hộp thoại huỷ: thêm ô icon và bộ đếm ký tự.

**Kiện hàng (`ChiTietChuyenKien`, `ChiTietChuyenKienDayDu`, hộp thoại xoá kiện, nhập file)**
- Khối viền phẳng → Card; nút 36 px → `sm`; chip viên thuốc → chip bo 10 bật cyan; ô lọc điểm giao theo kiểu V2.3.
- Tên kiện cắt "…" → tối đa hai dòng; chip yêu cầu 22 px một dòng; mốc điểm giao Archivo; dòng đang chọn có vạch trái.
- Panel: tiêu đề mono + ảnh lớn → đầu gọn (hình đẳng cự có kích thước, mã, tên, điểm giao, khối lượng, thể tích); thêm cảnh báo "Lưu thay
  đổi sẽ làm REV-… lỗi thời"; độ dễ vỡ thành nút chọn; chân panel hai hàng (Lưu kiện, Lưu và thêm tiếp / Nhân bản, Xoá kiện viền đỏ).
- Hộp thoại xoá / nhập file: `DialogHeader` có ô icon và nút ×; lỗi nhập thành bảng Dòng · Kiện · Lỗi.

## Kết quả (27/09/2026)

Làm song song bốn phần trong worktree riêng (danh sách, form, chi tiết, kiện), không chung file; người điều phối gộp và kiểm trên nhánh gộp.
Ảnh sau + ghép với ảnh đích: `docs/screenshots/v2.3/dot3-chuyen/after-*.png`, `docs/screenshots/v2.3/dot3-chuyen/so-sanh/`.

- CHANGES quyết định 2: kho ghi **trước → sau** khi sửa chuyến / kiện (`lib/mock-db/trip-changes.ts`, có test); banner "Cần xem lại" đọc
  từ đó. Nhật ký hiển thị nhãn cho bốn tham số mới.
- Dấu `*` bắt buộc của `FieldLabel` thành `aria-hidden`, ô nhập có `aria-required`: tên truy cập của ô giữ đúng chữ nhãn.

**Lệch có chủ ý**
- Không tím: chip "Đang xếp hàng" dùng xanh lam như mọi chỗ khác.
- Dòng số đếm "15 chuyến" không kèm "trong 30 ngày": app không có bộ lọc mặc định 30 ngày, ghi vậy là bịa số.
- Tên tuyến giữ nguyên dữ liệu ("Tuyến Q.7 – …"), không tự cắt "Tuyến" hay đổi dấu gạch thành mũi tên.
- Chip ngày chạy mở một hàng hai ô ngày thay vì popover chọn nhanh (chưa có Popover dùng chung); dòng nhóm nền phẳng, không gradient.
- Số đo trong bảng (kg, số lượng, kích thước) giữ JetBrains Mono theo AGENTS; mockup dùng Archivo.
- Chi tiết chuyến: thiếu tên kho xuất phát (chuyến chưa có trường này); ngày chạy chưa có thứ trong tuần (`lib/format` chưa có hàm này);
  giữ hàng Kiện / Thể tích / Khối lượng trên hai ô tỷ lệ (Spec 15 cần tổng); giữ kéo đổi thứ tự và xoá điểm giao ngay trên thẻ tuyến (LM-046).
- Ô lọc điểm giao của bảng kiện giữ `<select>` gốc (test và danh sách điểm giao dùng chung state).
- Hộp thoại "Khôi phục mọi chỉnh sửa" nằm trong Planner (`viewer3d/editor`) — để đợt 5.

**Còn lại cho thành phần dùng chung**
- `DataTable` chưa có dòng nhóm (danh sách chuyến tự dựng bảng trên cùng API) và chưa đánh dấu dòng chọn bằng `aria-selected`.
- `FilterBar` chưa có kiểu chip; chưa có Popover; `Button` chưa có biến thể nguy hiểm nhẹ; `FormSection` và `ConfirmDialog` chưa theo
  V2.3 (form chuyến tự dựng bản cục bộ); `SelectField` chưa nối lỗi vào `aria-describedby`.
- `PageHero`: hành động canh theo đáy khối tiêu đề (mockup canh theo hàng tiêu đề); tiêu đề không cắt chữ khi quá dài. Dải trời của Chi tiết
  chuyến cao ~300 px ở 1366×768 vì có bước tiến trình và banner.
