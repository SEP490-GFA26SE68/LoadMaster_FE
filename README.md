<p>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="design/brand/logo-horizontal-dark.png">
    <img src="design/brand/logo-horizontal.png" alt="LoadMaster — Plan smarter. Load further." width="360">
  </picture>
</p>

# LoadMaster — Frontend

Hệ thống lập kế hoạch và **tối ưu chất xếp hàng hoá 3D** cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam.
Một codebase responsive phục vụ 7 vai trò, từ màn điều phối nhiều cột trên desktop tới màn tài xế một tay trên điện thoại.
Giao diện tiếng Việt, chuyển được sang tiếng Anh ngay trong phiên làm việc.

![Xem phương án 3D](docs/screenshots/handoff/vi-planner-success.png)

## Làm được gì

| Vai trò | Thiết bị | Luồng chính |
|---|---|---|
| Điều phối | Desktop | Tạo chuyến, nhập kiện (tay hoặc CSV/.xlsx), chạy tối ưu, xem phương án 3D, chỉnh tay từng kiện, so sánh và **duyệt** |
| Kho | Máy tính bảng | Chọn chuyến đã duyệt, xếp từng kiện theo thứ tự, báo kiện thiếu, xem vị trí kiện trong thùng bằng 3D |
| Tài xế | Điện thoại | Chuyến của tôi, xuất phát, danh sách kiện theo điểm giao, báo sự cố, gọi khách, tổng kết chuyến |
| Quản lý | Desktop | Bảng điều khiển theo kỳ, 5 chỉ số có nguồn, 3 biểu đồ, xuất báo cáo `.xlsx` |
| Quản trị | Desktop | Người dùng, phân quyền theo ma trận, khoá/mở, đặt lại mật khẩu, nhật ký hệ thống |

Phần 3D dựng bằng Three.js: 1.000 kiện vẫn dưới 100 draw call, có chế độ chỉnh tay với kiểm tra ràng buộc
(chồng lấn, quá tải, chịu tải, hướng đặt, khoảng hở cửa) chạy ngay khi thả kiện.

## Chạy thử

Yêu cầu Node ≥ 22 và pnpm (khai trong `package.json`).

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Tài khoản demo — mật khẩu chung `loadmaster`, màn đăng nhập có nút chọn nhanh:

| Vai trò | Email | Mở ra |
|---|---|---|
| Điều phối | `dieuphoi@loadmaster.vn` | `/chuyen` |
| Quản lý | `quanly@loadmaster.vn` | `/` |
| Kho | `kho@loadmaster.vn` | `/kho` |
| Tài xế | `taixe@loadmaster.vn` | `/tai-xe` |
| Quản trị | `quantri@loadmaster.vn` | `/nguoi-dung` |

Thêm `?lang=en` vào URL để xem bản tiếng Anh.

## Trạng thái

- Cả 5 vai trò nối thành một vòng khép kín trên cùng một kho dữ liệu: điều phối lập kế hoạch → kho xếp theo thứ tự →
  tài xế giao theo thứ tự dỡ → quản lý xem số liệu → quản trị đọc nhật ký. Kịch bản một ngày làm việc có test đầu-cuối.
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
pnpm test          # Vitest: 778 test unit + DOM
pnpm test:e2e      # Playwright: 81 test trên desktop / tablet / phone
pnpm test:bench    # cổng ngân sách hiệu năng của bộ kiểm ràng buộc
```

Lần chạy gần nhất: lint, build, 778/778 unit, 81/81 E2E — xanh trên CI (`.github/workflows/ci.yml`).

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
| [docs/build-spec.md](docs/build-spec.md) | Đặc tả gốc: mô hình dữ liệu, contract tối ưu, tiêu chí nghiệm thu |
| [docs/prd.md](docs/prd.md) | Quyết định phạm vi (D-01 → D-57) |
| [docs/handoff.md](docs/handoff.md) | Bàn giao hiện trạng: route, dữ liệu mẫu, nợ kỹ thuật |
| [docs/acceptance.md](docs/acceptance.md) | Nghiệm thu, đối chiếu từng dòng tiêu chí với test |
| [docs/progress.md](docs/progress.md) | Nhật ký tiến độ theo ngày |
| [docs/screenshots/handoff/](docs/screenshots/handoff/) | Ảnh toàn bộ màn, bản tiếng Việt và tiếng Anh |

Hai trang tài liệu giao diện chạy được trong app: `/kieu-dang` (style sheet) và `/thanh-phan` (bảng thành phần).
