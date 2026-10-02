<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/logo-horizontal-dark.png">
    <img src="design/brand/logo-horizontal.png" alt="LoadMaster — Plan smarter. Load further." width="360">
  </picture>
</p>

# LoadMaster — Frontend

Hệ thống lập kế hoạch và **tối ưu chất xếp hàng hoá 3D** cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam.
Một codebase responsive phục vụ 8 vai trò của một công ty logistics và của nền tảng, từ màn điều phối nhiều cột trên desktop tới màn tài xế một tay trên điện thoại.
Giao diện tiếng Việt, chuyển được sang tiếng Anh ngay trong phiên làm việc.

## Làm được gì

| Vai trò | Thiết bị | Luồng chính |
|---|---|---|
| Điều phối | Desktop | Đăng ký kiện và in nhãn QR, tạo đơn hàng, tạo chuyến, nhập kiện (tay hoặc CSV/.xlsx), chạy tối ưu, xem phương án 3D, chỉnh tay từng kiện, so sánh và **duyệt** |
| Kho | Máy tính bảng | Chọn chuyến đã duyệt, xếp từng kiện theo thứ tự, báo kiện thiếu, xem vị trí kiện trong thùng bằng 3D |
| Tài xế | Điện thoại | Chuyến của tôi, xuất phát, danh sách kiện theo điểm giao, báo sự cố, gọi khách, tổng kết chuyến |
| Quản lý công ty | Desktop | Bảng điều khiển theo kỳ, 5 chỉ số có nguồn, 3 biểu đồ, xuất báo cáo `.xlsx`; xem chuyến và phương án (chỉ đọc) |
| Quản trị hệ thống · Quản trị công ty | Desktop | Người dùng, phân quyền theo ma trận, khoá/mở, đặt lại mật khẩu, nhật ký hệ thống |

Phần 3D dựng bằng Three.js: 1.000 kiện vẫn dưới 100 draw call, có chế độ chỉnh tay với kiểm tra ràng buộc
(chồng lấn, quá tải, chịu tải, hướng đặt, khoảng hở cửa) chạy ngay khi thả kiện.

## Chạy thử

Yêu cầu Node ≥ 22 và pnpm (khai trong `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Tài khoản demo — mật khẩu chung `loadmaster`, màn đăng nhập có nút chọn nhanh chia theo nền tảng và từng công ty:

| Vai trò | Email | Mở ra |
|---|---|---|
| Quản trị hệ thống | `quantri@loadmaster.vn` | `/nguoi-dung` |
| Quản lý nền tảng | `nentang@loadmaster.vn` | `/ho-so` — chưa có màn riêng, gõ email (không nằm trong ô chọn nhanh) |
| Hỗ trợ khách hàng | `hotro@loadmaster.vn` | `/ho-so` — chưa có màn riêng, gõ email (không nằm trong ô chọn nhanh) |
| Quản trị công ty | `qtcongty@loadmaster.vn` | `/nguoi-dung` |
| Quản lý công ty | `quanly@loadmaster.vn` | `/` |
| Điều phối | `dieuphoi@loadmaster.vn` | `/chuyen` |
| Kho | `kho@loadmaster.vn` | `/kho` |
| Tài xế | `taixe@loadmaster.vn` | `/tai-xe` |

Các tài khoản trên (trừ ba tài khoản nền tảng) thuộc Công ty TNHH Vận tải Long Bình. Công ty thứ hai, Giao nhận Phương Nam, cũng đủ năm
vai trò công ty: `qtcongty@`, `quanly@`, `dieuphoi@`, `taixe@phuongnam.vn` và nhân viên kho `viet.lam@phuongnam.vn`.

Thêm `?lang=en` vào URL để xem bản tiếng Anh.

## Trạng thái

- Các vai trò nối thành một vòng khép kín trên cùng một kho dữ liệu: điều phối đăng ký kiện, in nhãn QR, tạo đơn từ kiện đã ở kho, lập
  chuyến, gán đơn, chạy tối ưu, chỉnh tay và duyệt → kho quét QR xếp, tài xế quét QR dỡ → báo cáo chuyến. Quản trị hệ thống và quản trị
  công ty quản lý tài khoản và đọc nhật ký. Giao diện theo bản thiết kế V2.3 "Cyan kính".
- Đang chuyển sang 8 vai trò của backend v2: ma trận quyền và tài khoản mẫu đã có đúng tám vai trò và hai công ty logistics; quản trị hệ thống
  không còn quyền vận hành; điều phối viên là người duyệt phương án, quản lý công ty chỉ xem (không còn hàng đợi duyệt). Khách hàng của app là
  công ty logistics: hai vai trò Nhà sản xuất, Logistics của Review 1 cùng lô hàng và luồng quét nhận hàng giữa hai bên đã bỏ; kiện đăng ký
  thuộc công ty của người đăng ký. Dữ liệu cách ly theo công ty ngay ở kho: người của Long Bình và Phương Nam không thấy chuyến, xe, kiện,
  đơn, người dùng hay nhật ký của nhau, và tài khoản nền tảng không đọc được dữ liệu vận hành. Người dùng và nhật ký chia hai phạm vi: quản
  trị hệ thống thấy mọi công ty, tạo tài khoản nền tảng, khoá / mở khoá / đặt lại mật khẩu mọi người; quản trị công ty tạo, sửa, khoá người
  của công ty mình và đọc nhật ký của công ty mình. Màn của quản lý nền tảng và hỗ trợ khách hàng, và kho kiện theo mô hình backend làm ở
  các bước sau.
- **Chưa nối backend.** Dữ liệu nằm trong kho in-memory (`src/lib/mock-db`) và mất khi tải lại trang; đăng nhập,
  phân quyền, nhật ký đều là bản giả lập ở frontend. Mọi kết quả tối ưu mang nhãn **MOCK RESULT**.
- Đơn vị toàn hệ thống là cm/kg theo Build Spec; không có chuỗi tiếng Việt cứng ngoài từ điển (có test chặn).

## Kiến trúc

```text
src/domain                 logic thuần theo Spec: hình học cm, 6 hướng đặt, ràng buộc (trả mã lỗi), chỉ số
src/services/optimization  interface OptimizationService; bản mock tất định chạy trong Web Worker
src/lib/mock-db            kho in-memory thay backend: xe, chuyến, kiện, phương án, người dùng, nhật ký
src/features/<màn>         <màn>-api.ts (nơi duy nhất biết nguồn dữ liệu) → hook TanStack Query → component
src/features/viewer3d      toàn bộ Three.js; một SceneCanvas dùng chung cho Planner, kho và tài xế
```

Nối backend thật: thay thân hàm trong `features/*/*-api.ts` và `createOptimizationService`; hook và component giữ nguyên.

## Kiểm thử

```bash
pnpm lint          # oxlint
pnpm build         # tsc -b + vite build
pnpm test          # Vitest: 1.335 test unit + DOM
pnpm test:e2e      # Playwright: 105 test trên desktop / tablet / phone (CI chia ba phần chạy song song)
pnpm test:bench    # cổng ngân sách hiệu năng của bộ kiểm ràng buộc
```

Lần chạy gần nhất (02/10/2026, nhánh `developer`): lint, build, 1.335/1.335 unit, 105/105 E2E — xanh trên CI (`.github/workflows/ci.yml`).

## Làm việc trên repo

| Nhánh | Dùng làm gì |
|---|---|
| `main` | bản đã nghiệm thu; vào bằng pull request, không push thẳng |
| `developer` | nhánh phát triển hằng ngày |
| `feat/**`, `fix/**` | một việc một nhánh, gộp về `developer` |

CI chạy lint, kiểm kiểu, unit và E2E cho cả bốn kiểu nhánh trên.
Luật viết code, đặt tên, design token, quy ước 3D và quy ước git nằm trong [AGENTS.md](AGENTS.md).

## Tài liệu

| Tài liệu | Nội dung |
|---|---|
| [AGENTS.md](AGENTS.md) | Luật của repo: design token, luật thành phần, quy ước 3D, cách viết test |

Tài liệu nội bộ của nhóm — Build Spec, PRD, issue, bàn giao, nghiệm thu, nhật ký tiến độ, ảnh chụp màn — nằm trong thư mục `docs/`
trên máy của nhóm và **không đưa lên repo** (AGENTS mục 13). Cần bản nào thì hỏi nhóm.

Hai trang tài liệu giao diện chạy được trong app: `/kieu-dang` (style sheet) và `/thanh-phan` (bảng thành phần).
