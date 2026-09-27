---
id: LM-105
title: Thương hiệu — logo và linh vật cáo vào giao diện
phase: V2.3
labels: [design, brand]
depends_on: [LM-104]
estimate: 3d
prd: []
---

# LM-105 — Logo và linh vật cáo vào giao diện

Nguồn: `design/Logo and mascot/` (người dùng thêm 27/09/2026): 10 file logo PNG, 6 hình cáo toàn thân 512 px, 8 avatar cáo nửa người.
Mục tiêu: người xem nhận ra LoadMaster ở mọi điểm chạm — tab trình duyệt, màn đăng nhập, thanh điều hướng, giấy in dán lên thùng hàng —
mà không làm rối các màn vận hành dày dữ liệu.

## Nguyên tắc

- **Logo là định danh:** luôn có, nhỏ, cùng một hình ở mọi nơi. **Cáo là cảm xúc:** chỉ xuất hiện lúc không có dữ liệu để bày (rỗng,
  lỗi, chào, xong việc lớn). Không đặt cáo trong bảng, form, Planner 3D, bảng điều khiển, toast hay hộp thoại xác nhận.
- Mỗi tư thế cáo **một nghĩa cố định**, như tint ở AGENTS mục 4, để người dùng đọc được tình huống qua hình.
- Cáo là trang trí: `alt=""` / `aria-hidden`, chữ bên cạnh nói đủ nghĩa. Không động (hoặc chỉ nhịp rất nhẹ, tắt khi reduced-motion).
- Mọi file đi qua bundler (`src/assets/brand/`), không nhúng ảnh gốc 200–400 KB vào app.

## Giai đoạn 0 — chuẩn hoá tài sản

| Việc | Kết quả |
|---|---|
| Dựng lại **biểu tượng khối** thành SVG thật (ba mảng: nắp, chữ L, chữ n; góc bo đều) | `LogoMark` inline SVG, ba tông: màu gốc · trên nền tối · một màu `currentColor` (in) |
| Chữ "LoadMaster" | Chữ thật Archivo 700 (đã có trong app), không dùng ảnh — nét sạch ở mọi cỡ, dịch không vỡ |
| Bộ ghép: ngang (biểu tượng + chữ + khẩu hiệu) và dọc | `Logo lockup="horizontal" \| "stacked"` |
| Favicon và icon cài đặt | `favicon.svg` mới, `apple-touch-icon` 180 px, icon 192/512 px cho tablet kho "Thêm vào màn hình chính" |
| Cáo: chọn 7 tư thế, cắt cùng khung vuông, bỏ mép dính hình khác (`avatar_thinking`) | WebP 256 px và 512 px, mỗi file dưới 40 KB, tải lười theo màn |
| Dọn thư mục nguồn | `design/Logo and mascot/` → `design/brand/` (tên không dấu cách), bỏ các file lỗi mép |

## Chỗ đặt logo

| # | Chỗ | Hiện tại | Đổi thành |
|---|---|---|---|
| 1 | Thanh điều hướng (mọi màn khung ứng dụng) | Ô cyan + icon `Box` của Lucide | `LogoMark` trên nền tối + chữ LoadMaster |
| 2 | Tab trình duyệt | `favicon.svg` mặc định | Biểu tượng khối |
| 3 | Màn đăng nhập | Chữ + hình xe đẳng cự | Logo ngang + khẩu hiệu đầu form; giữ hình xe đẳng cự |
| 4 | Màn lỗi, 404, 403 | `BrandMark` cũ | `LogoMark` mới |
| 5 | **Nhãn QR in dán lên kiện** | Chưa có logo | Biểu tượng một màu ở góc nhãn — thương hiệu đi theo thùng hàng tới kho, tới khách |
| 6 | **Báo cáo chuyến bản in** | Chưa có logo | Logo ngang một màu ở đầu trang |
| 7 | Màn kho và tài xế (thanh 56 px) | Không có | Biểu tượng nhỏ cạnh nút thoát |
| 8 | Trang tài liệu `/kieu-dang`, `/thanh-phan` | — | Mục "Thương hiệu": các bản logo, vùng trống tối thiểu, cỡ nhỏ nhất, các tư thế cáo và nghĩa |
| 9 | `README.md` của repo | Chỉ tiêu đề chữ | Logo ngang đầu trang |

## Chỗ đặt cáo (mỗi tư thế một nghĩa)

| Tư thế | Nghĩa | Đặt ở |
|---|---|---|
| Chân dung mỉm cười (`fox_avatar`) | Chào | Màn đăng nhập, cạnh lời chào; khối tài khoản demo |
| Bê thùng (`carrying_box`) | Chưa có dữ liệu | Trạng thái rỗng: danh sách chuyến, kiện đã đăng ký, lô hàng, đơn hàng, loại kiện, loại xe |
| Suy nghĩ (`avatar_thinking`) | Không tìm thấy | 404 *(đổi khi làm: lọc không khớp nằm trong bảng, tìm nhanh là hộp thoại — cả hai thuộc chỗ không đặt cáo)* |
| Ngạc nhiên (`avatar_surprised`) | Có sự cố | Lỗi tải dữ liệu, màn lỗi router, 403, chuyến đã huỷ ở kho / tài xế |
| Giơ ngón cái (`fox_thumbs_up`) | Xong việc lớn | Kho xếp xong chuyến, tài xế hoàn tất chuyến, hàng đợi duyệt trống ("đã duyệt hết") |
| Máy quét + checklist (`fox_scanner_checklist`) | Chờ việc ở kho | Kho chưa có chuyến chờ xếp, logistics chưa có lô đang đến |
| Cầm tablet (`fox_tablet`) | Chờ việc của tài xế | "Chuyến của tôi" chưa có chuyến |

Cỡ: 120 px trong trạng thái rỗng desktop, 96 px trên điện thoại, 160 px ở màn đăng nhập, 140 px ở màn xong việc.
**Không** đặt ở: bảng, form, Planner 3D, bảng điều khiển, toast, hộp thoại, thanh điều hướng.

## Kỹ thuật

- `components/brand/LogoMark.tsx` (inline SVG, `tone`), `components/brand/Logo.tsx` (bộ ghép), `components/brand/Mascot.tsx`
  (`pose` → URL WebP, `width`/`height` cố định, `loading="lazy"`, `alt=""`).
- `EmptyState` nhận thêm `mascot={pose}` thay cho `icon`; `BrandMark` cũ thay bằng `LogoMark`.
- Tổng WebP cáo dưới 300 KB, mỗi màn chỉ tải tư thế nó dùng. Không đưa cáo vào chunk chính.
- Test: DOM kiểm cáo `aria-hidden` và tên truy cập không đổi; E2E chụp màn đăng nhập, trạng thái rỗng, 404, nhãn QR bản in.

## Sửa luật AGENTS cùng lúc

- Mục 5 "Bố cục": hình minh hoạ ở màn không có dữ liệu hiện chỉ cho phép "dựng từ chính sản phẩm (đẳng cự)". Thêm: **linh vật cáo là tài
  sản thương hiệu của sản phẩm**, được dùng ở các chỗ trong bảng trên; không mượn ảnh trang trí khác.
- Thêm mục "Thương hiệu": bản logo nào dùng ở nền nào, cỡ nhỏ nhất, bảng tư thế cáo → nghĩa.

## Chia đợt

1. **Nền** (1 ngày): SVG logo, favicon + icon cài đặt, thanh điều hướng, màn đăng nhập, màn lỗi, README, mục Thương hiệu ở `/thanh-phan`.
2. **Cáo** (1 ngày): WebP, `Mascot`, `EmptyState`, 404 / 403 / lỗi, màn xong việc của kho và tài xế, hàng đợi duyệt trống.
3. **In ấn và màn cảm ứng** (1 ngày): nhãn QR, báo cáo chuyến bản in, thanh 56 px của kho và tài xế; đo lại 1.366 px và 390 px.

## Quyết định của người dùng (27/09/2026)

1. **Màu logo: giữ xanh dương gốc** (nắp xanh sáng, chữ L xanh dương đậm, chữ n navy) — màu này chỉ nằm trong logo, giao diện vẫn cyan.
   Trên dải trời tối, chữ n navy chìm nền: bản trên nền tối đổi riêng chữ n sang trắng, giữ hai mảng xanh.
2. **Khẩu hiệu** "Plan smarter. Load further." giữ tiếng Anh ở mọi ngôn ngữ, như tên riêng (không vào từ điển dịch).
3. **Cáo ở màn kho và tài xế:** có, nhưng chỉ ở màn rỗng và màn xong việc; không ở màn đang thao tác.
4. **Tên linh vật: Lumo.** Hiện ở lời chào màn đăng nhập và mục Thương hiệu; tên riêng, không dịch.

## Kết quả

### Đợt 1 — nền (27/09/2026)

Nhánh `feat/lm-105-thuong-hieu` (xếp trên `feat/review1-5-luong`). Ảnh: `docs/screenshots/brand/dot1-*.png`.

- **Biểu tượng SVG** dựng lại trên lưới đẳng cự (cạnh xiên đúng tan 30°), góc bo đều bằng cách co đa giác 26 đơn vị rồi tô viền cùng
  màu dày 52. Màu lấy mẫu từ file gốc: nắp `#0196FD`, chữ L `#0052FC`, chữ n `#00276F` → token `--logo-sky`, `--logo-blue`, `--logo-navy`.
- `components/brand/LogoMark.tsx` (`color` · `dark` chữ n trắng · `mono`) và `Logo.tsx` (chữ Archivo 700 thật, khẩu hiệu tuỳ chọn,
  `role="img"` tên "LoadMaster"). Xoá `app/BrandMark.tsx` và token `--brand-mark*`.
- Đã thay: thanh điều hướng, thanh của hai trang tài liệu, màn đăng nhập (logo ngang + khẩu hiệu thay ô vuông cũ), màn lỗi / 404 / 403.
- `public/favicon.svg` thay tia sét tím mặc định của Vite (chữ n đổi trắng khi trình duyệt tối); thêm `apple-touch-icon.png`,
  `icon-192.png`, `icon-512.png`, `manifest.webmanifest`, `theme-color`. Xoá `public/icons.svg` (file mẫu Vite không dùng).
- `design/Logo and mascot/` → `design/brand/source/`; bản xuất `design/brand/logo-mark{,-dark,-mono}.svg`,
  `logo-horizontal{,-dark}.png` (README dùng `<picture>` theo nền sáng / tối).
- `/thanh-phan` có thẻ **Thương hiệu**: logo trên nền sáng và dải trời, biểu tượng 16 · 24 · 32 · 48 px, bản một màu, ba màu gốc, luật dùng.
- AGENTS: mục "Thương hiệu" mới; mục 5 "Bố cục" cho phép Lumo ở màn không có dữ liệu; cây thư mục thêm `components/brand/`.
- Kiểm tra: tsc, lint sạch; 963/963 unit/DOM (thêm 3 test `Logo`); E2E `layout-1366`, `i18n-en`, `rbac`, `plan-compare-404`, `profile`,
  `warehouse` 19/19.

**Lệch có chủ ý:** khẩu hiệu viết như câu thay vì viết hoa giãn chữ (luật "Cấm tuyệt đối"); chữ "LoadMaster" dùng Archivo của app thay vì
nét chữ tròn của ảnh gốc (ảnh gốc là raster, không có font); trên nền tối "Master" dùng xanh nắp thay xanh chữ L để đủ tương phản.

### Đợt 2 — Lumo (27/09/2026)

Ảnh: `docs/screenshots/brand/dot2-*.png`.

- **Ảnh:** 7 tư thế xuất từ `design/brand/source/` bằng canvas của Chromium (cắt sát hình theo kênh alpha, vuông 320 px, lề 2 %, WebP
  chất lượng 0,82): 19–24 KB mỗi ảnh, tổng khoảng 150 KB, ở `src/assets/brand/lumo/`. Vite phát riêng từng file, màn nào dùng mới tải.
  Tư thế "suy nghĩ" xoá mẩu tai dính ở mép trái của file gốc.
- `components/brand/Lumo.tsx` (`pose`, `size` sm 96 · md 96→120 · lg 112→140 · xl 128→160 px); `EmptyState` nhận `mascot` và `compact`.
- **Gắn vào:**
  - Chưa có dữ liệu (`empty`): danh sách chuyến, kiện trong chuyến (`compact`), đội xe, đơn hàng, kiện đã đăng ký, nhãn QR, loại kiện, lô
    hàng, loại xe, Planner khi chưa có phương án, So sánh phương án, mẫu ở `/thanh-phan`.
  - Có sự cố (`error`): lỗi tải ở nhật ký, người dùng, đội xe, bảng điều khiển, báo cáo chuyến, loại xe, Planner, danh sách kho / tài xế;
    403; lỗi render; phiên kho không tải hoặc không bắt đầu được, chuyến đã huỷ.
  - Không tìm thấy (`notFound`): 404.
  - Xong việc (`done`): kho xếp xong chuyến, tài xế giao xong chuyến (thay icon tích xanh), hàng đợi duyệt trống.
  - Chờ việc: `warehouseWaiting` ở danh sách kho rỗng, phiên kho chưa có bản duyệt / bản duyệt lỗi thời, logistics chưa có lô đang đến;
    `driverWaiting` ở "Chuyến của tôi" rỗng và điểm giao chưa có phương án.
  - Chào (`greet`): màn đăng nhập, cạnh "Xin chào, mình là Lumo!" (câu trong từ điển, tên không dịch).
- Xoá `trips/EmptyTripsIllustration.tsx` (không còn chỗ dùng). Thẻ Thương hiệu ở `/thanh-phan` có hàng 7 tư thế kèm nghĩa.
- Kiểm tra: tsc, lint, build sạch; 966/966 unit/DOM (thêm 3 test `Lumo`); E2E 30/30 (`layout-1366`, `i18n-en`, `rbac`,
  `plan-compare-404`, `warehouse`, `warehouse-progress`, `driver-delivery`, `driver-approved-plan`, `review1-approve`, `review1-execute`,
  `trip-lifecycle`).

**Không đặt Lumo** (theo nguyên tắc): bảng điều khiển khi kỳ không có dữ liệu, bảng lọc không khớp, tìm nhanh không có kết quả, màn tạo
chuyến, mọi hộp thoại.
