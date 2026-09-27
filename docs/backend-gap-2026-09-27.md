# Đối chiếu 5 luồng Review 1 với backend và frontend (27/09/2026)

Nguồn: tài liệu nhóm "LoadMaster — Mô tả 5 Main Flow cho Review 1" (Register → Plan → Optimize → Approve → Execute); repo
`SEP490-GFA26SE68/LoadMaster_BE` nhánh mặc định (commit gộp PR #14 từ `develop`); frontend nhánh `feat/v2-3-chuyen`.
Đường dẫn backend dưới đây tính từ gốc repo BE; `J/` là `LoadMasterService/src/main/java/fu/se184491/loadmaster_be/`.

## Tóm tắt

- **Spring** (`LoadMasterService`) gần như chỉ có entity. Controller duy nhất là `J/controller/vehicle/VehicleTypeController.java`
  (CRUD `/api/vehicle-types`, `companyId` gán cứng). Chưa có đăng nhập, CORS, `@EnableMethodSecurity`.
- **FastAPI** (`OptimizeService/app`) có tối ưu và duyệt: `POST /api/v1/optimization/jobs`, `GET …/jobs/{id}`, `GET …/jobs/{id}/plans`,
  `POST /api/v1/load-plans/{id}/approve`, `GET /api/v1/validate/trips/{trip_id}`, WebSocket `/ws/jobs/{job_uuid}`. Thuật toán hiện là
  heuristic tham lam (không xoay, không LIFO, không xếp chồng, không trục/COG). JWT chưa kiểm chữ ký.
- **Register (luồng 1), Plan (luồng 2), Execute (luồng 5) chưa có API nào.**
- Vai trò backend: ADMIN, DISPATCHER, WAREHOUSE_STAFF, DRIVER, CUSTOMER — **không có** CompanyManager, Manufacturer, Logistics.

## Backend so với 5 luồng

| Luồng | Backend có | Còn thiếu |
|---|---|---|
| 1. Register | Entity `PackageType` (kích thước, dễ vỡ, xoay, `max_stack`), `CargoPackage.tracking_barcode` | Cân nặng của loại kiện; Shipment; QR token + nhãn in; công ty logistics nhận; xác nhận nhận hàng; import; mọi API |
| 2. Plan | Entity `Trip`, `DeliveryStop` (`stop_sequence`), `TransportOrder` gắn stop; pre-check ở FastAPI `validate` | API CRUD; tài xế và mô tả trên Trip; trạng thái "Sẵn sàng tối ưu" |
| 3. Optimize | Job bất đồng bộ, WebSocket, lưu placement / unplaced / tỷ lệ | Thuật toán đủ ràng buộc; COG/tải trục; lịch sử job theo chuyến; chạy lại, ghim |
| 4. Approve | Approve lưu `approved_by` + AuditLog | `approved_at`; từ chối; yêu cầu tối ưu lại; đề xuất đổi xe / tách chuyến; trạng thái plan; người duyệt là DISPATCHER, không phải CompanyManager |
| 5. Execute | Entity `LoadingExecution` (seal, sai lệch), trạng thái stop/kiện | Mọi API; quét QR từng kiện; xác nhận dỡ; báo cáo chuyến |

## Giao diện frontend còn thiếu (theo 5 luồng)

Ưu tiên cho Review 1: **cao** = luồng demo không kể trọn được nếu thiếu.

| # | Luồng / bước | Màn đề xuất | Backend | Ưu tiên |
|---|---|---|---|---|
| 1 | Register: danh mục loại kiện | `/loai-kien` danh sách + form (D×R×C, kg, dễ vỡ, xoay, xếp chồng) | Chỉ entity | cao |
| 2 | Register: đăng ký kiện tách khỏi chuyến (thủ công / theo số lượng / nhập file) | `/kien-hang` | Chưa có | cao |
| 3 | Register: sinh QR, in nhãn hàng loạt | `/kien-hang/:id/nhan` hoặc in từ danh sách | Chỉ `tracking_barcode` | cao |
| 4 | Register: lô hàng (Shipment) giao công ty logistics | `/lo-hang`, `/lo-hang/moi` | Chưa có | cao |
| 5 | Register: logistics quét QR xác nhận nhận hàng | `/nhan-hang/quet` (camera) | Chưa có | trung bình |
| 6 | Vai trò Manufacturer, Logistics, CompanyManager | Thêm vào ma trận quyền và màn chính theo vai trò | BE thiếu | cao |
| 7 | Plan: đơn hàng (Order), chọn đơn khi tạo chuyến, gán đơn vào điểm giao | `/don-hang` + bước chọn đơn trong `/chuyen/moi` | Chỉ entity | cao |
| 8 | Plan: pre-check → "Sẵn sàng tối ưu" | Thẻ kiểm tra ở chi tiết chuyến (đợt 3 đã có checklist ở form) | `GET /validate/trips/{id}` | cao |
| 9 | Optimize: mục tiêu MAX_VOLUME / AXLE_BALANCE, thuật toán EP_DBLF / GA | Bổ sung `/chuyen/:id/toi-uu` | `POST /optimization/jobs` | trung bình |
| 10 | Optimize: lịch sử lần chạy, trạng thái realtime, lý do không xếp được | Tab "Lần chạy" trong chuyến | `jobs/{id}`, `jobs/{id}/plans`, WebSocket | trung bình |
| 11 | Approve: hàng đợi chờ duyệt của quản lý | `/duyet` | Chưa có API liệt kê plan | cao |
| 12 | Approve: từ chối / yêu cầu tối ưu lại / đề xuất đổi xe, tách chuyến, kèm lý do | Thanh quyết định ở Planner | Chỉ có approve | cao |
| 13 | Approve: người duyệt là quản lý | Đổi quyền `plans.approve` (FE hiện cho điều phối + quản trị, quản lý chỉ đọc) | BE cho DISPATCHER/ADMIN | cao — cần chốt với BE |
| 14 | Execute: kho quét QR từng kiện → hiện vị trí, hướng, bước | Nút quét trong `/kho?chuyen=` | Chưa có | cao |
| 15 | Execute: tài xế quét QR khi dỡ | Nút quét trong `/tai-xe/diem-giao` | Chưa có | trung bình |
| 16 | Execute: báo cáo chuyến sau khi hoàn thành | `/chuyen/:id/bao-cao` | Chưa có | thấp |
| 17 | Execute: số seal khi xếp xong | Màn xếp xong của kho | Chỉ entity | thấp |
| 18 | Loại xe tách khỏi xe | `/doi-xe/loai-xe` | CRUD `/api/vehicle-types` (có thật) | trung bình |

## Hợp đồng sẽ lệch khi nối

- **Đơn vị**: FE dùng cm/kg (bắt buộc theo Spec, AGENTS mục 6). Spring lưu `Integer` không ghi đơn vị; engine đoán mm (giá trị > 50 thì chia
  1000 ra m); placement trả mét `Numeric(10,2)`; Spring khai `PackagePlacement.pos_*` là `Integer`. `volume_utilization` 0–1 lưu `Numeric(5,2)`
  mất chính xác.
- **ID**: FE dùng chuỗi (`TRIP-2026-0914`); Spring `Long`; Python khai `Trip.id` là `String(64)` còn `validate` đòi UUID.
- **Trạng thái chuyến**: FE 10 trạng thái; BE 5 (DRAFT, OPTIMIZED, APPROVED, IN_TRANSIT, COMPLETED) — thiếu đang tối ưu, đang xếp, đã xếp
  xong, cần xem lại, đã huỷ. `DeliveryStopStatus` BE có ARRIVED, SKIPPED.
- **Vai trò**: FE `warehouse`, `manager`; BE `WAREHOUSE_STAFF`, `CUSTOMER`.
- **Trường**: Trip BE không có tài xế (tài xế nằm trên Vehicle), tên, mô tả; Stop không có số điện thoại, người liên hệ; kiện BE đi theo
  kiện → đơn → điểm giao, FE gắn thẳng kiện vào chuyến/điểm giao.
- **JSON**: Python snake_case + bọc `ApiResponse{success, code, message, data, errors}`; Spring camelCase, VehicleType không bọc.

## Việc cần chốt với nhóm backend trước khi FE làm tiếp

1. Đơn vị trong API (đề xuất cm/kg như Spec) và kiểu ID chung cho Trip.
2. Ai duyệt phương án (tài liệu Review 1: CompanyManager; BE và FE hiện: điều phối/quản trị).
3. Bộ trạng thái chuyến chung (FE cần tối thiểu đang xếp, đã xếp xong, cần xem lại, đã huỷ).
4. Có đưa Order, Shipment, QR vào phạm vi Review 1 hay không — đây là toàn bộ luồng 1 và một phần luồng 2, 5.
