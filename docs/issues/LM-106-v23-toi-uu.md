---
id: LM-106
title: V2.3 đợt 4 — Tối ưu: thiết lập, đang tối ưu, lỗi, so sánh phương án
phase: V2.3
labels: [design, ui, optimization]
depends_on: [LM-103, LM-104]
estimate: 2d
prd: []
---

# LM-106 — V2.3 đợt 4: Tối ưu

Nguồn: [design/v2.3/README.md](../../design/v2.3/README.md) (đợt 4), [SCREENS.md](../../design/v2.3/SCREENS.md). Nhánh `feat/v2-3-toi-uu`.

Màn của đợt: `ThietLapToiUu` (1536×1265), `ThietLapToiUuLoi` (1536×1339), `DangToiUu`, `HopThoaiToiUu` (1536×864) ở
`/chuyen/:id/toi-uu`; `SoSanhPhuongAn` (1536×1312) ở `/chuyen/TRIP-2026-0914/so-sanh`, `SoSanhPhuongAnTrong` (1536×864) ở
`/chuyen/TRIP-012/so-sanh`.

Bản mẫu vẽ trước LM-104: phần LM-104 thêm vào Thiết lập tối ưu (mục tiêu, thuật toán, bảng "Lần chạy tối ưu", banner quyết định của quản lý)
**giữ nguyên chức năng**, chỉ đưa về giao diện V2.3.

## Danh sách lệch (chụp trước khi sửa)

Ảnh trước: `docs/screenshots/v2.3/dot4-toi-uu/before-*.png`.

**Thiết lập tối ưu (`ThietLapToiUu`)**
- Nút quay lại + mã chuyến + câu mô tả → đường dẫn "Chuyến hàng / mã / Thiết lập tối ưu", chip trạng thái (+ dòng phụ), dòng dữ liệu
  tên · ngày chạy · xe · tài xế; banner khoá và banner quyết định của quản lý nằm trong dải trời.
- Cột phải 340 → 416 px; mục viền mảnh → mục đánh số V2.3 (ô số 28 px, tiêu đề Archivo).
- Ba số đầu vào mono → Archivo 28 px chia vạch; ô điểm giao thêm tuyến "đầu → cuối".
- Dòng mono thông số xe → ô thông số nền cyan-50 (lòng thùng, tải tối đa, cửa, vật cản) + chip trạng thái xe; hai liên kết sửa có icon.
- "Thiết lập nâng cao": tam giác mặc định → ô mũi tên, tiêu đề Archivo; mục tiêu / thuật toán (LM-104) thành danh sách chọn có viền.
- Kiểm tra trước khi tối ưu: danh sách issue trần → dải kết luận + danh sách kiểm theo nhóm Xe / Kiện / Tải trọng.
- "Sau khi chạy": một câu → ba bước đánh số.

**Thiết lập tối ưu có lỗi (`ThietLapToiUuLoi`)**
- Nút Tối ưu tắt không nói lý do → câu "Chưa chạy được: N lỗi cần sửa ở …" trên nút, nối `aria-describedby`.
- Vượt tải: thanh hổ phách → đỏ, "· vượt N kg"; mục lỗi có nhãn Lỗi / Cảnh báo, nút "Đổi xe", "Sửa kiện".

**Đang tối ưu (`DangToiUu`)**
- Hộp thoại 640 px không icon, "0 / 0" khi service chưa báo → 500 px, ô icon xoay xanh lam, tổng kiện lấy từ chuyến, thanh xanh lam,
  dòng thời gian đã chạy / giới hạn, khung thiết lập của lần chạy, "Huỷ thì không tạo phương án mới".

**Lỗi và thông báo (`HopThoaiToiUu`)**
- Thiếu lề dưới, không nút đóng góc → `DialogHeader` có ô icon, nút × góc, rộng 456 px; lỗi đầu vào mỗi dòng có icon và mức.

**So sánh phương án (`SoSanhPhuongAn`)**
- Nút quay lại + mã → đường dẫn, chip trạng thái chuyến, dòng tuyến · số phương án · xe.
- Khối viền phẳng → Card; chú giải "Tốt nhất"; radio gốc → radio V2.3; nhãn trạng thái thành tag (lỗi thời hổ phách thay đỏ).
- Cột đang chọn: chỉ tô đầu cột → tô cả cột + vạch 3 px + ảnh viền cyan; cả ô mono → chỉ phần số mono.
- Tốt nhất: nền cyan + tích cyan → chữ 600 + tích xanh lá (không trùng nền cột đang chọn).
- Thanh chân 64 px ngoài vùng cuộn → chân trong Card, dính đáy vùng cuộn.

**So sánh — chưa đủ phương án (`SoSanhPhuongAnTrong`)**
- Trạng thái rỗng trần trên nền trang → trong Card đè dải trời; thêm mục "Phương án đã lưu (1)" với ảnh, số liệu và thiết lập của bản
  duy nhất (đọc từ revision).

## Kết quả (27/09/2026)

Hai phần làm song song trong worktree riêng (Thiết lập tối ưu + hộp thoại; So sánh phương án), không chung file; người điều phối gộp,
thêm hai tuỳ chọn dùng chung và kiểm trên nhánh gộp. Ảnh sau + ghép với ảnh đích: `after-*.png`, `so-sanh/`.

- Dùng chung: `EmptyState wide` (mô tả tới 520 px), `PlanThumbnail className` (176 px trong ma trận, 150 px ở thẻ bản lưu).
- Kiểm tra: tsc, lint, build sạch; 973/973 unit/DOM (thêm `setup-checklist`, hộp thoại lỗi, thẻ bản lưu); 94/94 E2E.

**Lệch có chủ ý**
- Không tím: "đang tối ưu" dùng xanh lam; không có chip "Đang tối ưu" (từ LM-104 là tiến trình job, không phải trạng thái).
- Danh sách "Phương pháp" năm dòng của bản mẫu → hai danh sách Mục tiêu / Thuật toán của LM-104; "Thiết lập nâng cao" vẫn gập mặc định.
- Nút Tối ưu canh hàng tiêu đề thay vì đáy dải trời: thấp như bản mẫu thì con trỏ sau khi bấm đè toast (offset 152), toast không tự tắt.
- Ảnh phương án giữ SVG đẳng cự (AGENTS §7); số giữ JetBrains Mono; độ đậm tốt nhất 600 (Be Vietnam Pro chỉ 400/500/600).
- Seed chỉ có REV-001, REV-002 (bản mẫu có REV-028): hai cột, không ô nào "tốt nhất" vì mọi chỉ số bằng nhau.
- Chip xe "Sẵn sàng" xanh lá theo `VehicleStatusBadge`; trạng thái rỗng giữ Lumo `empty`.

**Còn lại cho thành phần dùng chung**
- `PageHero` chưa có tuỳ chọn canh hành động theo hàng tiêu đề (màn này tự đặt lề); dải trời cao hơn bản mẫu khoảng 15 px.
- `DialogHeader` và `ProgressBar` chưa có tông `azure` (hộp thoại đang chạy tự dựng đầu); nút × góc hộp thoại có hai bản cục bộ.
- Mục đánh số (`TripFormSection` của trips) nên đưa lên `components/` thay `FormSection` V2.
