---
id: LM-107
title: V2.3 đợt 5 — Planner 3D (11 trạng thái)
phase: V2.3
labels: [design, ui, viewer3d]
depends_on: [LM-104]
estimate: 3d
prd: []
---

# LM-107 — V2.3 đợt 5: Planner 3D

Nguồn: [design/v2.3/README.md](../../design/v2.3/README.md) (đợt 5), [CHANGES.md](../../design/v2.3/CHANGES.md) mục 2 "Planner 3D",
[SCREENS.md](../../design/v2.3/SCREENS.md). Nhánh `feat/v2-3-planner` (tách từ `developer`, độc lập với PR đợt 4).

Màn (1536×864): `Planner3D`, `Planner3DChinhSua`, `Planner3DThongTin`, `Planner3DDuyet`, `Planner3DDoHang`, `Planner3DKhongTheDat`,
`Planner3DTatLIFO`, `Planner3DLoiThoi`, `Planner3DKhoa`, `Planner3DQuanLy`, `Planner3DBanChuaDuyet`.

Bản mẫu vẽ trước LM-104: phần LM-104 thêm vào Planner (người duyệt là quản lý công ty, Từ chối / Yêu cầu tối ưu lại / Đề xuất, khoá
`decided`, "Duyệt bởi … lúc …") **giữ nguyên chức năng**.

## Danh sách lệch (chụp trước khi sửa, 1536×864)

Ảnh trước: `docs/screenshots/v2.3/dot5-planner/before-*.png`.

**Toàn màn:** trang trắng và thanh trên trắng 56 px → nền `--canvas-1`, thanh `.glass-dark` nổi, bo góc, vẫn 56 px.

**Thanh trên (`Planner3D`)**
- Mã chuyến mono → `<h1>` tên tuyến (từ 1.680 px) + dòng "TRIP · REV" với tag MOCK RESULT, Đã chỉnh tay, **mới** Lỗi thời, "LIFO: tắt".
- Chỉ số mono → Archivo trên nền tối, có vạch chia; Xếp/Dỡ và ô chọn sáng → nhóm kính và ô chọn kính (góc nhìn có icon từ 1.536 px).
- "Đã duyệt lúc" vòng xanh lá → chấm cyan có quầng, hai dòng; Chỉnh sửa, So sánh, Từ chối, ⋯ dùng `variant="glass"`.

**Trong khung 3D (`Planner3D`)**
- Nhãn neo hộp sáng → thẻ tối hai dòng (vai trò · điểm giao / mã kiện cyan mono) + vòng neo trên điểm 3D; không thêm draw call.
- Bên trái: chữ trần → panel tối liệt kê điểm giao theo thứ tự dỡ kèm số kiện, điểm hiện tại nổi bật, dòng bước và nút "Theo bước".
- Kiện đang chọn: chỉ mở qua hộp thông tin → thẻ nổi bên phải từ 1.280 px (ô `viewer.selected.*`, tỷ lệ đỡ đáy %); hẹp hơn giữ thanh gọn.
- Dòng thời gian trắng → thanh tối, số đếm Archivo, mã kiện hiện tại cyan mono.

**Thông tin phương án (`Planner3DThongTin`):** hộp sáng có lớp phủ → panel tối đặc bên phải không làm mờ cảnh; tab là nhóm tối. Tab "Danh
sách": tab con → ba khối xếp chồng (chưa xếp, đã ghim, đã xếp theo thứ tự xếp kèm tag "Đỡ đáy x%").

**Chỉnh tay (`Planner3DChinhSua`):** thanh công cụ và panel sáng → tối; Hoàn tác / Làm lại có chữ; tag xám "Đã chỉnh thủ công" /
"Nguyên bản"; nhích 6 nút một hàng (2 cột dưới 1.280 px để giữ 56 px); đủ 6 hướng đặt (hướng không cho phép vô hiệu); nút hút lưới kiểu
công tắc; "Khôi phục mọi chỉnh sửa" viền đỏ; HUD góc trái: chip trạng thái + dòng phím tắt.

**Không thể đặt (`Planner3DKhongTheDat`):** chip "Không thể đặt" + dòng vật cản (loại, mã, phạm vi X/Y/Z, chịu tải); ghi chú "đang kéo",
điều khiển mờ và khoá khi kéo; chú giải 3 trạng thái (quyết định 3: đã dời hợp lệ = xanh + tag xám, ràng buộc thật = hổ phách, lỗi cứng =
đỏ); nhãn kéo đỏ "Không thể đặt · Điểm N", tag đỏ trên vật cản. `useEditorValidation` trả thêm `manual`, `obstacleIds`.

**Dỡ hàng (`Planner3DDoHang`):** panel nổi "Thứ tự dỡ" (dòng hiện tại / tiếp theo, ghi chú nhất quán thứ tự, khối "Kiện chắn lối dỡ" có
tag "Kiểm tra LIFO", ghi chú hành lang); HUD trái hộp hổ phách "Lối dỡ bị che kín · Đã tạm dừng" + "Bỏ qua bước trong mô phỏng".

**Hộp thoại Duyệt (`Planner3DDuyet`, `Planner3DTatLIFO`):** tiêu đề trần → `DialogHeader` có ô icon và nút ×; ô số Archivo; dòng "Không
có lỗi chặn duyệt"; hộp hổ phách liệt kê 3 cảnh báo đầu + "… và N cảnh báo khác"; kiện đã chỉnh là chip; MOCK RESULT ở chân. Tắt LIFO:
"Cả N cảnh báo đến từ kiểm tra LIFO …" + nút "Xem mô phỏng dỡ hàng" (đóng hộp thoại, rời Chỉnh sửa, chuyển sang Dỡ hàng).

**Lỗi thời (`Planner3DLoiThoi`):** dải hổ phách một câu → thanh nêu mục đã đổi (trước → sau, giờ, người sửa), số kiện phương án ↔ chuyến,
chênh theo điểm giao, "Kho chỉ xếp được khi quản lý công ty duyệt lại", "Tới Thiết lập tối ưu" (khi có quyền chạy tối ưu).

**Khoá theo pha (`Planner3DKhoa`):** dải xám → thanh cyan với lý do + "Kho đã xếp 110 / 280 kiện · bắt đầu … · người".

**Chỉ xem (`Planner3DQuanLy`):** từ LM-104 quản lý là người duyệt, nên trạng thái chỉ xem nay là của **điều phối viên** — thanh kính
trung tính cùng câu "Chờ quản lý công ty duyệt".

**Bản chưa duyệt (`Planner3DBanChuaDuyet`) — mới:** thanh "Đang xem REV-001 — kết quả tối ưu lúc …, chưa duyệt. Kho và tài xế đang đọc bản
đã duyệt REV-002 (…)" + nút "Mở bản đã duyệt REV-002"; bản đã duyệt lỗi thời thì dòng hai nói vậy.

## Kết quả (28/09/2026)

Hai phần song song trong worktree riêng (thanh trên + duyệt + thanh thông báo; phần trong khung 3D + chỉnh tay + dỡ hàng), không chung file;
người điều phối gộp, sửa trên nhánh gộp rồi chụp lại các màn của phần 1. Ảnh sau + ghép: `after-*.png`, `so-sanh/`.

- Sửa trên nhánh gộp: tiêu đề thanh trên không cắt chữ (`layout-1366` đỏ ở 1.366 / 1.600 px); khoảng trắng giữa số và đơn vị, khối lượng
  một chữ số thập phân như trước ("200,0 kg", nghiệm thu §15 trong `spec-flow`); khối "Kiện chưa xếp" là vùng có tên thay tab con;
  `review1-approve` chờ màn chính dựng xong mới điều hướng (đỏ ngẫu nhiên 2/5 lần).
- Kiểm tra: tsc, lint, build sạch; 970/970 unit/DOM; E2E đủ bộ lần đầu 91/94 (3 đỏ ở `spec-flow`, đã sửa); chạy lại `spec-flow` 7/7,
  `layout-1366` + `planner-compact` 7/7, `viewer-ui` + `viewer-scene-first-ui` + `i18n-en` xanh.

**Lệch có chủ ý**
- Không gradient trên nút nhấn giữ (Xếp/Dỡ, Theo bước): nền cyan mờ + viền trong (AGENTS §5). Nút Phát là nút kính, không tròn cyan (một nút
  chính mỗi màn; không bo tròn nút hành động).
- Ô dòng thời gian cao bằng nhau (AGENTS §7, có E2E), không phóng ô hiện tại.
- Hộp Chi tiết / Hiển thị là panel tối đặc (bề mặt đọc lâu), không kính; nhãn neo nền đặc 85 % thay `backdrop-filter`.
- Số đo và mã giữ JetBrains Mono; bản mẫu dùng Archivo.
- Ô chọn điểm giao giữ trên thanh trên (E2E và test "một hàng" cần), nên tên tuyến chỉ hiện từ 1.680 px.
- Thanh thông báo nằm trong luồng trang, không nổi đè lên cảnh.
- "Chỉ kiện này" → "Tập trung vào kiện" (Planner không có chế độ chỉ hiện một kiện).
- Dữ liệu theo seed: TRIP-013 là REV-027, TRIP-011 REV-024, ngày neo hôm nay; seed không có phương án tắt LIFO nên ảnh Tắt LIFO dùng một lần
  chạy tạo trong script (71 cảnh báo, bản mẫu 72) và ảnh Dỡ hàng bị che dùng `?debug&packages=132`.
- Camera chừa chỗ cho panel nổi nên xe nhỏ hơn bản mẫu một chút; thẻ kiện đang chọn tự cuộn khi cao hơn khung 864 px.

**Còn lại**
- Số chênh theo điểm giao trong danh sách điểm bên trái (bản mẫu "Điểm 1 hiện có 146 kiện (+6 …)"): `planTripDelta` đã có, `SceneHud` chưa
  nhận `source` từ `ViewerSession` — thanh thông báo lỗi thời đã nêu chênh theo điểm.
- Dùng chung: `Dialog` chưa có kiểu panel không lớp phủ (hộp Chi tiết tự dựng); `Badge` chưa có tông cho nền tối (`panels/scene-ui.tsx`
  có bản cục bộ); `DecisionSummary` cần `tone="dark"`; chưa có token kính tối hổ phách / đỏ (đang dùng thang token kèm độ mờ).
