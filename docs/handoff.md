# LoadMaster Frontend — Bàn giao hiện trạng

Ngày cập nhật: 30/09/2026. Repo `E:\SEP490\LoadMaster`, GitHub `SEP490-GFA26SE68/LoadMaster_FE`. Luật code: [AGENTS.md](../AGENTS.md)
(đọc trước khi viết code). Tiến độ theo ngày: [docs/progress.md](progress.md). Issue: [docs/issues/](issues/README.md).

## 1. Đang ở đâu

- **Nhánh làm việc là `developer`** (đã gộp mọi PR tới #9, CI xanh). `main` vẫn là MVP nghiệm thu 16/09 — **không** gộp gì vào `main` khi
  người dùng chưa duyệt. Không có PR nào đang mở.
- **Chưa nối backend.** Dữ liệu nằm trong kho in-memory (`src/lib/mock-db`), **mất khi tải lại trang**; đăng nhập, phân quyền, nhật ký là
  giả lập ở FE. Mọi kết quả tối ưu mang nhãn **MOCK RESULT**. Đơn vị cm/kg theo Build Spec.
- Kiểm tra gần nhất trên `developer` (28/09/2026): lint, build sạch; **980** test unit/DOM; **96** E2E (desktop / tablet / phone) xanh trên CI.

### Việc đã xong gần đây (chi tiết ở từng issue và `progress.md`)

| Issue | Nội dung |
|---|---|
| LM-102 → LM-107 | V2.3 "Cyan kính" đợt 2–5: thành phần, dải trời + thanh điều hướng, Chuyến hàng, Tối ưu, Planner 3D (11 trạng thái) |
| LM-104 | Giao diện demo đủ 5 luồng Review 1 (Register → Plan → Optimize → Approve → Execute); vai trò Nhà sản xuất, Logistics; trạng thái chuyến theo backend (5 + Đã huỷ); **quản lý công ty duyệt** phương án |
| LM-105 | Thương hiệu: logo SVG, favicon, icon cài đặt, linh vật cáo **Lumo** ở màn rỗng / lỗi / xong việc, logo trên nhãn QR và báo cáo in |
| LM-108 | Planner: điều phối viên chỉnh tay lại được + "Lưu bản chỉnh" (vào hàng đợi duyệt); **trọng lực** khi kéo kiện (từ nhánh của minkoi); **tay kéo theo trục X/Y/Z** và hút về vị trí gốc |

### Quyết định người dùng đã chốt (đừng hỏi lại)

- Đơn vị cm/kg theo Spec. Người duyệt phương án là **Quản lý công ty**; điều phối viên chạy tối ưu, chỉnh tay, không duyệt.
- Trạng thái chuyến theo backend: Nháp · Đã tối ưu · Đã duyệt · Đang vận chuyển · Hoàn thành + Đã huỷ; tiến độ kho và lỗi thời là dòng phụ.
- **Không dùng màu tím** ở bất cứ đâu ("đang chạy" dùng xanh lam `--azure-*`); "Đã huỷ" là chip đỏ, không gạch chữ.
- Logo giữ **màu xanh gốc**; khẩu hiệu "Plan smarter. Load further." và tên **Lumo** không dịch.
- Tab trên dải trời là **nhóm tab kính**, không phải tab gạch chân (người dùng chê vạch sát mép card).
- Giữ **chỉ báo kính trượt theo con trỏ** trên thanh điều hướng.
- FE làm trước giao diện demo cho phần backend chưa có (chỉ là demo, dữ liệu mẫu).

## 2. Chạy và xem thử

```powershell
pnpm install --frozen-lockfile
pnpm dev                     # http://localhost:5173
```

Mật khẩu mọi tài khoản demo: `loadmaster` (màn đăng nhập có ô chọn nhanh).

| Vai trò | Email | Màn chính |
|---|---|---|
| Điều phối viên | `dieuphoi@loadmaster.vn` | `/chuyen` |
| Quản lý công ty | `quanly@loadmaster.vn` | `/` (bảng điều khiển), `/duyet` |
| Kho | `kho@loadmaster.vn` | `/kho` |
| Tài xế | `taixe@loadmaster.vn` | `/tai-xe` |
| Quản trị | `quantri@loadmaster.vn` | `/nguoi-dung` |
| Nhà sản xuất | `sanxuat@loadmaster.vn` | `/kien-hang` |
| Logistics | `logistics@loadmaster.vn` (`viet.lam@phuongnam.vn` để thử quét sai công ty) | `/nhan-hang` |

Dữ liệu mẫu đáng nhớ: `TRIP-2026-0914` (132 kiện, đã duyệt, chờ kho xếp) · `TRIP-010` đã xếp xong, của tài xế demo · `TRIP-011` đang xếp ·
`TRIP-009` đang giao · `TRIP-012` chờ quản lý duyệt · `TRIP-013` lỗi thời · `TRIP-014` nháp, gán được đơn `ORD-002` vào điểm 2 · `TRIP-007`
hoàn thành (xem báo cáo) · lô `SHP-002` đã nhận 4/12 kiện.

**Hướng dẫn demo Review 1** (từng luồng, tài khoản, bấm gì, chỗ script lệch app) là trang Claude Docs *"Hướng dẫn demo Review 1"* trong
artifact của người dùng — riêng tư cho tới khi người dùng bấm Share.

## 3. Kiến trúc

```text
src/domain            logic thuần theo Spec: hình học cm (EPSILON), 6 hướng đặt, constraint engine (mã lỗi + tham số), metrics
src/services/optimization   interface OptimizationService; mock tất định trong Web Worker; bản giả lập sự cố (?mo-phong=loi)
src/lib/mock-db       kho in-memory thay backend (db-*.ts): xe, chuyến (pha planning → … → completed), revision bất biến, người dùng,
                      phiên, nhật ký; Review 1: công ty, loại kiện, kiện + mã QR, lô hàng, đơn hàng, quyết định duyệt, lần chạy, loại xe, seal
features/<màn>        <màn>-api.ts (nơi duy nhất biết kho) → hook TanStack Query → component
features/viewer3d     toàn bộ Three.js; SceneCanvas dùng chung cho Planner, kho, tài xế; editor/ (kéo thả, trọng lực, tay kéo trục)
components/brand      LogoMark, Logo, Lumo
design/               v2.3/ (bản thiết kế đang theo), brand/ (logo, linh vật: nguồn + bản xuất)
```

Nối backend thật: thay thân hàm trong `features/*/*-api.ts`, `features/auth/auth-api.ts` và `createOptimizationService`. Đối chiếu API
backend với 5 luồng: [docs/backend-gap-2026-09-27.md](backend-gap-2026-09-27.md).

## 4. Kiểm thử và bẫy đã gặp

```powershell
pnpm lint; pnpm build; pnpm test; pnpm test:e2e     # E2E tự bật Vite ở 127.0.0.1:5175; cổng bận thì đặt E2E_PORT
```

- **Máy CI chậm hơn và dùng font Linux**: nhiều test chỉ đỏ trên CI (chữ tràn ở 1.366 px, test đo thời gian). Luật ở AGENTS mục 9.
- E2E không tải lại trang giữa kịch bản (mất dữ liệu): đổi người bằng đăng xuất trong app, đổi route bằng `navigateInApp`.
- Test hay chập chờn khi chạy cả bộ trên máy chậm: `viewer-demand-quality`, `viewer-benchmark-cm`, `fleet-vehicle-preview`,
  `i18n-en` (tablet-1024) — chạy riêng thì xanh.
- Windows: file CRLF làm lệnh thay chuỗi nhiều dòng bằng script im lặng không khớp — chuẩn hoá `\r\n` trước khi thay.

## 5. Cách làm việc với người dùng

- Trả lời **tiếng Việt, ngắn gọn**, chỉ kết quả.
- **Hỏi trước khi xoá nhánh.** Đang còn 3 nhánh đã gộp chưa xoá (`feat/v2-3-toi-uu`, `feat/v2-3-planner`, `feat/lm-108-planner-chinh-tay`) —
  người dùng chưa trả lời có xoá hay không.
- Commit: ký `tankhang6a6@gmail.com`, thông điệp tiếng Việt kiểu Conventional Commits, **không** dòng đồng tác giả / tên công cụ (AGENTS §13).
  Mỗi việc một nhánh `feat/…` từ `developer`, PR vào `developer`, chờ CI xanh rồi mới gộp.
- Làm song song bằng agent: mỗi agent một worktree, chia file sở hữu rõ, người điều phối cherry-pick và chạy lại đủ bộ kiểm tra.
- Mỗi việc xong: ghi kết quả vào file issue, thêm mục nhật ký vào `docs/progress.md`, sửa AGENTS nếu luật đổi.

## 6. Còn lại

1. **V2.3 đợt 6** (Kho 1024×768, Tài xế 390×844) và **đợt 7** (đội xe, người dùng, nhật ký, hồ sơ, đăng nhập, màn lỗi) theo
   `design/v2.3/README.md` — chưa bắt đầu.
2. Nợ của LM-104: chuông thông báo cho nhà sản xuất / logistics; sửa công ty của tài khoản; đếm số kiện dùng loại kiện trên mọi công ty;
   `SelectField` chưa dịch lỗi theo mã; hàng đợi duyệt chưa kiểm LIFO / tải trục thật; báo cáo chuyến chưa có đường vào cho quản lý, tài xế.
3. Nợ thành phần dùng chung (LM-103, LM-106, LM-107): `DataTable` dòng nhóm, `FilterBar` kiểu chip, Popover, `FormSection` và
   `ConfirmDialog` theo V2.3, `PageHero` canh hành động theo hàng tiêu đề, `Dialog` kiểu panel không lớp phủ, `Badge` tông nền tối.
4. Planner: số kiện chênh theo điểm giao trong danh sách điểm bên trái (hàm `planTripDelta` đã có, `SceneHud` chưa nhận).
5. Script Review 1 còn vài câu lệch app (Flow 1 do nhà sản xuất làm, Flow 2 chưa có chi phí xăng / duyệt chuyến, Flow 5 chưa chụp ảnh / chữ
   ký, số test và số vai trò trên slide) — liệt kê trong trang hướng dẫn demo.
6. Backend (LM-002): contract tối ưu, revision và duyệt, pha chuyến, người dùng thật, phân quyền ở server, lưu bền; các API luồng 1, 2, 5.
