---
id: LM-104
title: Giao diện demo đủ 5 luồng Review 1 (Register → Plan → Optimize → Approve → Execute)
phase: Review 1
labels: [ui, demo, mock-db, rbac]
depends_on: [LM-103]
estimate: 8d
prd: []
---

# LM-104 — Giao diện demo 5 luồng Review 1

Nguồn: tài liệu nhóm "LoadMaster — Mô tả 5 Main Flow cho Review 1"; đối chiếu ở
[docs/backend-gap-2026-09-27.md](../backend-gap-2026-09-27.md). Nhánh `feat/review1-5-luong` (chồng trên `feat/v2-3-chuyen`, PR #4).

## Quyết định của người dùng (27/09/2026)

1. **Đơn vị theo Spec**: cm / kg trong mọi state và payload (giữ nguyên D-03). Backend phải theo khi nối.
2. **Người duyệt phương án là Quản lý công ty** (vai trò `manager`). Điều phối lập chuyến và chạy tối ưu, không duyệt.
3. **Trạng thái chuyến theo backend**: 5 trạng thái `Nháp · Đã tối ưu · Đã duyệt · Đang vận chuyển · Hoàn thành`, **cộng "Đã huỷ"** (đề nghị
   BE thêm `CANCELLED`). Tiến độ kho ("kho đang xếp 110/280", "đã xếp xong") và "lỗi thời, cần tối ưu lại" thành **dòng phụ**, không phải
   trạng thái.
4. **Phải demo được giao diện cả 5 luồng**. Backend chưa có thì FE làm trước, chạy trên kho mock in-memory (không bịa số, không nút giả).

## Việc

### Giai đoạn 1 (song song)
- [x] A — Trạng thái chuyến 5 + Đã huỷ, dòng phụ tiến độ kho / lỗi thời; quyền duyệt chuyển sang Quản lý công ty.
- [x] B — Nền: kho mock cho loại kiện, kiện đăng ký + mã QR, lô hàng + công ty logistics + nhận hàng, đơn hàng, quyết định duyệt (duyệt /
      từ chối / yêu cầu tối ưu lại / đề xuất đổi xe, tách chuyến), lịch sử lần chạy (mục tiêu, thuật toán), loại xe, seal, báo cáo chuyến;
      vai trò Nhà sản xuất, Logistics; route + thanh điều hướng + quyền; component QR (vẽ + quét).

### Giai đoạn 2 (song song, sau khi gộp giai đoạn 1)
- [ ] C — Luồng 1 phía nhà sản xuất: loại kiện, đăng ký kiện (thủ công / theo số lượng / nhập file), in nhãn QR, lô hàng.
- [ ] D — Luồng 1 phía logistics (quét QR nhận hàng) + luồng 2: đơn hàng, gán đơn vào điểm giao, kiểm tra "Sẵn sàng tối ưu".
- [ ] E — Luồng 3 (mục tiêu, thuật toán, lịch sử lần chạy) + luồng 4 (hàng đợi chờ duyệt, thanh quyết định trong Planner).
- [ ] F — Luồng 5 (quét QR khi xếp, seal khi xếp xong, quét QR khi dỡ, báo cáo chuyến) + loại xe.

## Nền (giai đoạn 1B)

*(27/09/2026)* Kho mock, API + hook, component QR, route + điều hướng + quyền cho 4 việc C–F. Việc giao diện **không** sửa kho, route
hay quyền — cần thêm thì báo người điều phối. Mọi lỗi của kho hiện bằng `dataErrorMessage(error, t)` (nhánh `dataErrors`).

**Vai trò và quyền** (`types/user.ts`, `features/auth/permissions.ts`): `manufacturer` (Nhà sản xuất, `sanxuat@loadmaster.vn`, công ty
`MFR-001`), `logistics` (Công ty logistics, `logistics@loadmaster.vn` → `LOG-001`; `viet.lam@phuongnam.vn` → `LOG-002` để thử quét sai
công ty); mật khẩu `loadmaster`. Quyền mới: `packages.register`, `shipments.manage`, `receiving.operate`, `orders.view`, `orders.edit`,
`plans.review`, `vehicleTypes.edit`. Đọc quyền qua `useCan()` / `can()` / `permissionsOf()`.

**Route** (khung màn `components/ScreenShell.tsx` đếm dữ liệu thật; việc C–F thay thân màn, giữ file và tên export):

| Route | Quyền | File màn | Việc |
|---|---|---|---|
| `/loai-kien` | `packages.register` | `features/packages-source/PackageTypesPage.tsx` | C |
| `/kien-hang` (màn chính nhà sản xuất) | `packages.register` | `features/packages-source/PackagesPage.tsx` | C |
| `/kien-hang/nhan?kien=RPK-0001,…` | `packages.register` | `features/packages-source/PackageLabelsPage.tsx` | C |
| `/lo-hang`, `/lo-hang/:shipmentId` | `shipments.manage` | `features/shipments/ShipmentsPage.tsx`, `ShipmentDetailPage.tsx` | C |
| `/nhan-hang` (màn chính logistics) | `receiving.operate` | `features/receiving/ReceivingPage.tsx` | D |
| `/don-hang` | `orders.view` (ghi: `orders.edit`) | `features/orders/OrdersPage.tsx` | D |
| `/duyet` | `plans.review` | `features/review/ReviewQueuePage.tsx` | E |
| `/doi-xe/loai-xe` | `fleet.view` (ghi: `vehicleTypes.edit`) | `features/vehicle-types/VehicleTypesPage.tsx` | F |
| `/chuyen/:tripId/bao-cao` | `trips.view` | `features/trips/TripReportPage.tsx` | F |

Điều hướng: điều phối thêm "Đơn hàng", quản lý thêm "Chờ duyệt", nhà sản xuất "Kiện hàng · Lô hàng · Loại kiện", logistics "Nhận hàng".
Quản trị viên không thêm mục (thanh ngang 1.366 px), mở bằng đường dẫn.

**API + hook** (component chỉ gọi hook):

- `packages-source`: `usePackageTypesQuery`, `usePackageTypeQuery(id)`, `useSavePackageTypeMutation({ input, id? })`,
  `useDeletePackageTypeMutation`, `useRegisteredPackagesQuery`, `useRegisteredPackageQuery(id)`,
  `useRegisterPackagesMutation(RegisterInput)` — `{ kind: 'single', input }` · `{ kind: 'quantity', input, quantity }` (1…500) ·
  `{ kind: 'rows', rows }` (nhập file, kiểm hết trước khi ghi), `usePackageLabelsQuery(ids?)` (kiện + loại + công ty để in),
  `useFindPackageByQrMutation`, `useCompaniesQuery(kind?)`.
- `shipments`: `useShipmentsQuery` (`ShipmentRow`: lô + hai công ty + số đã nhận), `useShipmentQuery(id)` (`ShipmentDetail` kèm kiện),
  `useShippablePackagesQuery`, `useCreateShipmentMutation(ShipmentInput)`, `useUpdateShipmentMutation(id)`, `useDeleteShipmentMutation`,
  `useHandOverShipmentMutation`.
- `receiving`: `useIncomingShipmentsQuery` (`IncomingShipment`: `pending` / `received`), `useReceivePackageMutation(token)` — lỗi
  `QR_UNKNOWN`, `RECEIVING_FORBIDDEN`, `PACKAGE_ALREADY_RECEIVED`.
- `orders`: `useOrdersQuery` (`OrderRow`: đơn + kiện + tổng kg + chuyến/điểm được gán), `useOrderQuery(id)`, `useOrderablePackagesQuery`,
  `useAssignableTripsQuery` (chuyến `planning` + điểm giao), `useCreateOrderMutation`, `useUpdateOrderMutation(id)`,
  `useCancelOrderMutation(id)` (lý do bắt buộc), `useAssignOrderMutation({ orderId, tripId, stopId })`, `useUnassignOrderMutation`.
- `review`: `useReviewQueueQuery` (`ReviewQueueRow`: phương án, metrics, `run`, xe, người chạy, `submittedAt`),
  `useReviewDecisionsQuery(tripId)`, `useReviewDecisionMutation` — `{ kind: 'reject' | 'reoptimize', revisionId, reason }` ·
  `{ kind: 'suggest', revisionId, suggestion: { kind: 'change_vehicle' | 'split_trip', note, vehicleId? } }`. Duyệt vẫn là
  `approveRevision` của Planner (nay lưu `approvedBy`).
- `optimization`: `useOptimizationRun(tripId).mutate({ request, simulateFailure, run?: { objective, algorithm } })` —
  `MAX_VOLUME | AXLE_BALANCE`, `EP_DBLF | GENETIC_ALGORITHM`, mock bỏ qua nhưng kho lưu; lần chạy hỏng được ghi (`REQUEST_REJECTED`,
  `SERVICE_UNAVAILABLE`). `useOptimizationRunsQuery(tripId)` = lịch sử lần chạy. `Revision.run` có trên mọi revision mới và seed.
- `vehicle-types`: `useVehicleTypesQuery` (`VehicleTypeRow`: loại + xe đang gắn), `useVehicleTypeAssignmentsQuery`,
  `useSaveVehicleTypeMutation({ input, id? })`, `useDeleteVehicleTypeMutation`, `useSetVehicleTypeMutation({ vehicleId, vehicleTypeId | null })`.
- `warehouse`: `useTripLabelsQuery(tripId)` (danh sách chọn tay), `useConfirmLoadingByQrMutation(tripId)(token)` — chỉ nhận kiện của bước
  hiện tại, sai thì `QR_WRONG_PACKAGE { expected, scanned }`; kiện cuối tự hoàn tất xếp. `useRecordSealMutation(tripId)(seal)` ở pha
  `loaded` (`trip.loading.seal`).
- `driver`: `useDriverTripLabelsQuery(tripId)`, `useConfirmUnloadByQrMutation(tripId)({ stopNumber, token })` — kiện điểm khác
  `QR_WRONG_STOP`; ghi `unloadedIds` + `qrConfirmedIds`.
- `trips` (`useTripExtrasQuery.ts`): `useTripReadinessQuery(tripId)` (`{ ready, checks: [{ code, status: pass|warn|fail, params }] }`, câu ở
  nhánh `readiness`), `useTripOrdersQuery`, `useTripLabelsQuery`, `useTripReportQuery` (`TripReportData`: chuyến, xe, tài xế, `TripReport`).

**Component**: `components/QrCode.tsx` (`token`, `size?`, `label?`, `showToken?` — SVG một `<path>`, in được),
`components/QrScanDialog.tsx` (`open`, `onOpenChange`, `title`, `description?`, `onScan(token)`, `options?`, `error?`, `pending?` — camera
qua `BarcodeDetector` khi có, luôn có ô nhập tay và danh sách chọn), `components/ScreenShell.tsx`.

**Từ điển mới** (`lib/i18n/{vi,en}/`): `sourcing`, `orders`, `review`, `readiness`, `vehicleTypes`, `tripReport`, `runs`, `qr`; thêm
`titles`, `pageHero`, `nav`, `roles`, `dataErrors` (21 mã), `audit` (23 hành động, 6 nhóm).

**Seed** (ngày neo 14/09/2026): 8 loại kiện `PT-001…008`, 48 kiện `RPK-0001…0048`; `SHP-001` nhận đủ 22 kiện, `SHP-002` đang nhận 4/12
(demo quét), `SHP-003` giao `LOG-002` (demo quét sai công ty), 8 kiện dầu ăn chưa vào lô; `ORD-001`, `ORD-002` chờ gán (`ORD-002` giao Bách
Hoá Xanh Dĩ An = điểm 2 của `TRIP-014`); hàng đợi duyệt có `TRIP-012`; `TRIP-2026-0914` có 2 lần chạy (`RUN-001` hỏng, `RUN-002` → `REV-001`);
7 loại xe `VT-001…007` gắn cho `VEHICLE-001…007`.

**Chưa có**: chuông thông báo cho nhà sản xuất / logistics (chưa lọc theo công ty); sửa `companyId` trong form người dùng; lần chạy hỏng
chỉ ghi khi đi qua `runOptimization`.

## Kết quả

### A — trạng thái theo backend, người duyệt là Quản lý công ty (27/09/2026)

- `TripStatus` còn 6 giá trị: `nhap`, `da_toi_uu`, `da_duyet`, `dang_van_chuyen`, `hoan_thanh`, `da_huy`. Pha kho vẫn trong kho mock
  (`planning → loading → loaded → delivering → completed | cancelled`); `loading`/`loaded` hiện Đã duyệt, bản lỗi thời hiện Đã tối ưu.
- Dòng phụ `tripSubStatus` (`stale` · `loading` đã ghi / tổng · `loaded`) và `TripSubStatusTag` dùng chung: danh sách chuyến, chi tiết
  chuyến, danh sách kho, "Chuyến của tôi", `/kieu-dang`.
- Tab danh sách: Tất cả · Cần xử lý · Sắp chạy · Đang vận chuyển · Hoàn thành · Đã huỷ; giá trị `trang-thai` cũ đọc sang giá trị mới.
- `plans.approve` chuyển từ điều phối sang quản lý công ty (`roles.manager` = "Quản lý công ty"). Planner của điều phối chỉ xem: bản chưa
  duyệt nói "Chờ quản lý công ty duyệt", bản đã duyệt "chỉ quản lý công ty chỉnh sửa và duyệt". Seed ghi lần duyệt cho quản lý (US-0002).
- Test: unit/DOM cập nhật theo nhãn và quyền mới; E2E của Planner đăng nhập `manager`, `workday` đổi người giữa tối ưu và duyệt, kịch
  bản cần cả tối ưu lẫn duyệt dùng `admin`, thêm E2E điều phối chỉ xem.
