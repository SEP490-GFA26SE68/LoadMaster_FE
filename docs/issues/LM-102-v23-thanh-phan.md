---
id: LM-102
title: V2.3 đợt 2 — thành phần dùng chung, dải trời + thanh điều hướng, /kieu-dang, /thanh-phan
phase: V2.3
labels: [design, ui, components]
depends_on: []
estimate: 3d
prd: []
---

# LM-102 — V2.3 đợt 2: thành phần

Nguồn: [design/v2.3/README.md](../../design/v2.3/README.md) (đợt 2), [CHANGES.md](../../design/v2.3/CHANGES.md) mục 1,
`design/v2.3/tokens/v3.css`. Đợt 1 (token) đã gộp ngày 26/09/2026. Nhánh `feat/v2-3-thanh-phan`.

Màn đối chiếu của đợt (SCREENS.md, nhóm Hệ thống): `Main` (/kieu-dang), `ThanhPhan` (/thanh-phan), `TrangThaiChung` (trạng thái dùng
chung), `MenuToanCuc` (chuông, tài khoản, ngôn ngữ), `TimNhanh` (Ctrl K). `HopThoaiChuyen` / `HopThoaiQuanTri` chỉ dùng để lấy kiểu
hộp thoại; nội dung từng hộp thoại thuộc đợt của màn chứa nó.

## Danh sách lệch (chụp 26/09/2026, 1536 px, trước khi sửa)

### Khung ứng dụng — `ChuyenHang.jpg`, `MenuToanCuc.jpg`, `TimNhanh.jpg`

| # | Hiện tại | V2.3 |
|---|---|---|
| K1 | Thanh điều hướng 56 px nền `--chrome` trắng, viền dưới | 60 px trên **dải trời** `--sky` (hai vệt cyan + lưới chấm), không viền |
| K2 | Logo ô `--primary` đặc + "LoadMaster" mực đậm | Ô 32 px gradient cyan có quầng, chữ Archivo 700 rộng 112 %: "Load" trắng, "Master" `--cyan-300` |
| K3 | Nhóm mục trên kính sáng, chỉ báo kính trắng trượt theo con trỏ, mục mở chữ xanh | Kính **tối** (`.glass-nav`): mục 36 px chữ trắng 72 %; mục mở nền cyan trong + viền cyan + quầng, chữ trắng 600 |
| K4 | Nút tìm nhanh chỉ icon | Ô `.glass-search` "Tìm nhanh · Ctrl K" (desktop rộng), icon ở màn hẹp |
| K5 | Ngôn ngữ: icon + hai nút VI/EN | Một nút kính "VI" mở menu "Ngôn ngữ giao diện" (Tiếng Việt / English, dấu tích) |
| K6 | Chuông, ảnh đại diện nền tint | Nút kính 36 px; chấm hổ phách khi có tin chưa đọc; ảnh đại diện tròn gradient cyan chữ `--cyan-950` |
| K7 | `PageHero` 72 px nền trắng, ô icon `.hero-icon`, h1 24 px | Trên dải trời: h1 **32 px Archivo 700** trắng, mô tả `--cyan-100` 78 %, không ô icon; hành động bên phải |
| K8 | Nội dung bắt đầu dưới viền của thanh tiêu đề | Dải trời kéo dài thêm 44 px, card đầu tiên **đè lên** dải (`margin-top: -44px`) |
| K9 | Tab của màn (Người dùng) trên nền trắng dưới tiêu đề | Tab nằm **trong** dải trời: chữ trắng 70 %, tab mở chữ trắng + vạch `--cyan-400`, số đếm pill |
| K10 | Chuông: popover trắng, tin là một dòng chấm + chữ | Tiêu đề + chip "4 chưa đọc", mỗi tin có ô icon tint, tiêu đề 600, giờ phải, dòng phụ mono mã chuyến; tin chưa đọc nền `--cyan-50` |
| K11 | Menu tài khoản: tên, email, vai trò chữ | Ảnh đại diện 40 px + tên + email, chip vai trò trung tính + kho; mục có icon |
| K12 | Tìm nhanh: hộp trắng, dòng chọn nền `--primary-bg` | Hộp **kính tối**, chữ trắng, số kết quả + phím Esc ở ô nhập, dòng chọn viền cyan + "Enter mở", phần khớp tô cyan |

### Thành phần — `ThanhPhan.jpg`, `Main.jpg`, `TrangThaiChung.jpg`

| # | Hiện tại | V2.3 |
|---|---|---|
| T1 | Nút phụ/ghost/nguy hiểm bo 10 (token), không bóng | Phụ: viền `--border` + bóng 1 px; nguy hiểm `--red-700` + quầng đỏ nhẹ; thêm biến thể **kính** (trên dải trời / khung 3D), cỡ `sm` 32 px |
| T2 | Badge viên thuốc 22 px, chấm cho "đang diễn ra" | Chip trạng thái bo 8, cao 26, chữ 12,5/600 — **ngữ pháp chấm**: chấm đặc = trạng thái · vòng rỗng = chờ người kế tiếp · quầng = đang chạy |
| T3 | Màu trạng thái: đã tối ưu xanh, đã xếp xong xanh lá, đang giao/xếp cyan | Đã tối ưu hổ phách vòng rỗng; đã duyệt cyan; đang xếp / đang giao / đang tối ưu **tím** có quầng; đã xếp xong tím vòng rỗng; đã huỷ gạch ngang chấm đỏ |
| T4 | Card bo 8 (nay 14), không bóng, tiêu đề 16/500 | Bo 14 + `--card-shadow`; đầu card 14×18 px, tiêu đề **Archivo 650 16 px**, ghi chú `--ink-3` 13 px cùng dòng |
| T5 | Ô nhập viền `--border`, focus vòng ngoài 2 px | Viền `--line-strong` (3:1), nhãn 13/600 `--ink-2`, dấu * đỏ; focus viền `--cyan-500` + quầng 3 px; lỗi viền đỏ + quầng đỏ nhạt; chỉ đọc nền `--n-50` |
| T6 | Checkbox/radio/switch màu primary (nay cyan-700) | Giữ, đúng kích thước 18 px / switch 36×20 |
| T7 | Tab gạch chân `--primary`, số đếm mono pill | Vạch `--cyan-500`, số đếm Archivo 600 pill `--n-100` (mở: `--cyan-50`); thêm bản **trên dải trời** |
| T8 | SegmentedControl viền + bóng | `.seg`: rãnh `--n-100`, ô đang chọn trắng có bóng nhẹ |
| T9 | Hộp thoại bo 12, lớp phủ xám | Bo 18, lớp phủ `--cyan-950` 50 %; ô icon 40 px theo nghĩa; chân hộp thoại nền `--n-25` |
| T10 | Toast: nền trắng, icon trơn | Bo 14, bóng `--e2`, ô icon 30 px tint theo nghĩa, tiêu đề 600 + dòng phụ |
| T11 | Menu thả xuống bo 8 | Bo 12, padding 6, mục 36 px bo 8, mục nguy hiểm đỏ, lý do bị chặn ở phải |
| T12 | Tooltip nền `--text` | Nền `--cyan-950`, chữ `--cyan-50`, bo 8 |
| T13 | Trạng thái rỗng: khung nét đứt | Không khung; ô minh hoạ 64 px bo 18 nền `--cyan-50` (hổ phách / đỏ theo nghĩa), tiêu đề Archivo 18/700 |
| T14 | Banner khoá chuyến nền `--surface` | `.banner` bo 12, bốn tông info / warn / danger / neutral, chữ đậm đầu câu, hành động ở phải |
| T15 | Ô số liệu kính sáng (`.glass-tile`) | Card nền đặc (ngoài dải); bản kính tối chỉ trên dải trời của Bảng điều khiển; số Archivo |
| T16 | Thanh tiến độ đặc `--primary` | Gradient `--cyan-300 → --cyan-600`; vượt ngưỡng đỏ |
| T17 | /kieu-dang, /thanh-phan: tài liệu dài một cột, nền trắng, sáu–bảy mục đánh số | Dải trời + lưới card hai cột theo `Main.jpg`, `ThanhPhan.jpg` (bảng màu cyan / xám, trạng thái vòng đời, tương phản đã đo, chữ, thành phần) |

### Không làm ở đợt này

- Bố cục từng màn (bảng chuyến nhóm theo ngày, tab trạng thái, chi tiết chuyến…): đợt 3–7.
- Header riêng của Chi tiết chuyến, form xe, Planner 3D: giữ nền trắng tới đợt của màn đó.

## Kết quả (26/09/2026)

Đã làm K1–K12, T1–T17. Ảnh trước / sau / đích (1536 px): [`docs/screenshots/v2.3/dot2-thanh-phan/`](../screenshots/v2.3/dot2-thanh-phan/).
Luật mới ghi ở AGENTS mục 1, 4, 5 ("Thành phần V2.3", "Thanh tiêu đề màn").

**Lệch có chủ ý so với mockup**

- `/kieu-dang`, `/thanh-phan` vẫn công khai (không đăng nhập) nên dải trời không có mục điều hướng, chỉ logo và ngôn ngữ.
- Tiêu đề `/kieu-dang` 32 px (mockup 44 px) theo thang chữ; hàng "Số trong bảng" giữ JetBrains Mono vì AGENTS vẫn yêu cầu mono cho số
  đo trong bảng. `/thanh-phan` cao 2.949 px (mockup 2.716) vì câu tiếng Việt thật dài hơn.
- Thước đo "104 % · vượt 380 kg" bỏ vì seed không có chuyến quá tải; thay bằng chuyến tải cao nhất TRIP-008 (79,1 %). Toast "Kết quả một
  phần" bỏ vì không có số trong seed.
- Nút chính vô hiệu hoá nền xám (luật mục 5), không phải cyan mờ 45 %.
- Ảnh đại diện trong nội dung giữ ô vuông bo góc (luật V2); tròn chỉ ở thanh điều hướng.
- Tìm nhanh hiện chữ "Tìm nhanh · Ctrl K" từ 1.440 px (không phải 1.340): ở 1.366 px nút rộng đẩy "Nhật ký" khỏi thanh của quản trị.
  Hộp tìm nhanh tối hơn `.glass-dark` một lớp cho giống mockup; dòng đang chọn không có gradient và quầng (luật "Cấm tuyệt đối").
- Popover chuông không có mũi nhọn (wrapper DropdownMenu chưa có Arrow).
- Bảng điều khiển và Hồ sơ **chưa** đè card lên dải trời: thứ đầu tiên của vùng cuộn là chữ trần (dòng chọn kỳ, cột thông tin cá nhân),
  đặt lên nền trời thì không đọc được. Bảng điều khiển đưa bộ chọn kỳ vào dải ở đợt của màn đó.
- Vòng focus trên dải trời là `--cyan-300`, không phải `--primary`: cyan-700 không đủ tương phản trên nền tối.
- Hover nút chính: gradient trượt một bậc cyan (mockup không vẽ).

**Người dùng duyệt và yêu cầu sửa (26/09/2026)**

- Giữ **chỉ báo kính trượt theo con trỏ** trên thanh điều hướng (bản đầu đợt 2 đã bỏ): khôi phục `useGlassFollow`, vật liệu kính cyan
  `--nav-on`; mục đang mở không nền riêng.
- **Bỏ tím** khỏi app: "đang chạy" (đang tối ưu / xếp / đã xếp xong / giao, xe đang phục vụ chuyến), tint "phân tích phụ", tag "Đã chỉnh
  tay", ô icon "Xếp xong" của chuông và nhật ký chuyển sang thang xanh lam `--azure-*` (#1D4FAE trên #ECF3FF 6,8:1). `@theme` xoá thang
  `violet`/`purple` của Tailwind.
- **Đã huỷ**: chip đỏ trọn, không gạch chữ.
- **"Mở phương án"** ở bảng chuyến trong kỳ (Bảng điều khiển): nút phụ cỡ `sm` có icon khối 3D, không còn là chữ liên kết.

**Phát hiện thêm:** bảng tương phản của `/kieu-dang` (tính từ token lúc mở trang) cho thấy chữ trắng trên mốc điểm giao 3, 6, 7 chỉ
3,1–3,9:1. Đã sửa `lib/stops.ts` chọn chữ tối cho các mốc đó (4,6–5,8:1), test khoá ngưỡng 4,5:1 cho cả tám mốc.

**Còn lại cho đợt sau**

- Token kính tối đặc hơn cho hộp tìm nhanh (`--glass-dark-strong`), `DropdownMenuArrow`, thành phần phím tắt (`kbd`) dùng chung.
- Button biến thể nguy hiểm nhẹ (`.btn-danger-soft`), chip lọc (`.chip`) dùng chung, vạch cyan cho dòng đang chọn của `DataTable`.
- `features/admin/audit-look.ts` còn tô "Xếp xong" xanh lá; V2.3 dùng tím cho "đã xếp xong" (chuông đã theo V2.3).
- Header trắng của Chi tiết chuyến, form xe, So sánh; bộ chọn kỳ của Bảng điều khiển: lên dải trời ở đợt của màn.
