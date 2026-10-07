# AGENTS.md — LoadMaster Web

Đọc file này trước khi viết bất kỳ dòng code nào trong repo.

File này là **luật sống**: khi thực tế phát triển cho thấy một luật cũ sai hoặc thiếu,
sửa luật ở đây cùng lúc với sửa code, đừng để code và luật lệch nhau. Những mục đánh
dấu *(đã điều chỉnh)* là chỗ hướng đi ban đầu đã đổi và lý do vì sao.

## 1. Sản phẩm

LoadMaster là hệ thống lập kế hoạch và tối ưu chất xếp hàng hóa 3D cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam. Đây là repo frontend.

Giao diện **tiếng Việt**. Một codebase responsive phục vụ **8 vai trò** của backend v2 *(đã điều chỉnh 01/10/2026, FE-0-01, FE-0-03)* — ba
vai trò nền tảng, năm vai trò của công ty logistics. *(đã điều chỉnh 02/10/2026, FE-0-06, D-63)* Khách hàng của app là **công ty
logistics**: hai vai trò Nhà sản xuất, Logistics của Review 1 (LM-104) đã bỏ, `ROLES` là đúng tám vai trò này. Mã FE là nội bộ; mã
backend nằm ở `BACKEND_ROLE_CODES` (`types/user.ts`), `-api.ts` đổi khi nối API:

| Vai trò (mã FE · mã backend) | Thiết bị | Đặc điểm |
|---|---|---|
| Quản trị hệ thống (`systemAdmin` · `SYSTEM_ADMIN`) | Desktop | Nền tảng: người dùng, nhật ký, ma trận quyền; không có quyền vận hành |
| Quản lý nền tảng (`systemManager` · `SYSTEM_MANAGER`) | Desktop | Nền tảng: gói cước — màn tới Sprint 8 mới có |
| Hỗ trợ khách hàng (`systemSupporter` · `SYSTEM_SUPPORTER`) | Desktop | Nền tảng: ticket hỗ trợ — màn tới Sprint 8 mới có |
| Quản trị công ty (`companyAdmin` · `COMPANY_ADMIN`) | Desktop | Người dùng, nhật ký; gói cước và credit về sau |
| Quản lý công ty (`manager` · `COMPANY_MANAGER`) | Desktop / tablet | Dashboard, biểu đồ, xuất báo cáo; lập yêu cầu giao (FE-4b-02); xem chuyến và phương án chỉ đọc |
| Điều phối viên (`dispatcher` · `DISPATCHER`) | Desktop | Dữ liệu dày, phiên làm việc dài, bảng nhiều cột; quản lý kho kiện (thêm kiện, nhập file, in nhãn QR), lập chuyến, tối ưu, duyệt phương án |
| Nhân viên kho (`warehouse` · `WAREHOUSE_WORKER`) | Tablet tại kho | Sáng, đeo găng, nhìn xa, một thao tác mỗi màn |
| Tài xế (`driver` · `DRIVER`) | Điện thoại ngoài trời | Nắng, một tay, mạng yếu |

Backend là Spring Boot monolith + PostgreSQL, cộng một Python FastAPI service riêng cho tối ưu. Giao tiếp REST + WebSocket.

**Trạng thái hiện tại:** backend chưa nối. Toàn bộ dữ liệu là mẫu. *(đã điều chỉnh 19/09/2026, LM-084, D-41)* Phân quyền
**giả lập ở FE**: ma trận `features/auth/permissions.ts` — *(đã điều chỉnh 01/10/2026, FE-0-01, FE-0-03)* **một bảng** `ROLE_PERMISSIONS` theo
PRD v2 mục 5.2 (`REVIEW1_EXTRA` đã gộp vào; đọc quyền qua `can`/`permissionsOf`), thứ tự của `PERMISSIONS` là thứ tự dòng của Ma trận quyền.
Ba vai trò nền tảng **không có quyền vận hành**: quản trị hệ thống (trước là `admin` toàn quyền) chỉ còn `companies.manage`, `users.manage`,
`audit.view`; quản lý nền tảng `subscriptionPlans.manage`; hỗ trợ khách hàng `support.handle`. Quản trị công ty có `users.manage`, `audit.view`,
`billing.manage`, `support.create`. *(đã điều chỉnh 02/10/2026, FE-0-08, D-65)* Hai vai trò quản trị mở cùng màn `/nguoi-dung`, `/nhat-ky`;
**phạm vi theo vai trò, kho kiểm như server** (`lib/mock-db/user-scope.ts`, `db-users.ts`), màn chỉ làm mờ trước kèm lý do
(`admin/account-guards.ts`, dùng cùng hàm `isLastActiveAdmin`, `userScopeOf` với kho). Quản trị hệ thống: thấy mọi tài khoản (cột Công ty,
bộ lọc `cong-ty` — mã công ty hoặc `nen-tang`); **tạo, sửa, xoá** tài khoản nền tảng (form chỉ mời ba vai trò nền tảng, không có ô kho);
với nhân sự công ty chỉ **khoá, mở khoá, đặt lại mật khẩu** — sửa, xoá là `USER_MANAGED_BY_COMPANY`. Quản trị công ty: chỉ người của công
ty mình (kho không trả tài khoản nền tảng hay người công ty khác: đọc `NOT_FOUND`, ghi `FORBIDDEN_COMPANY`); tạo, sửa, khoá, đặt lại mật
khẩu, xoá với năm vai trò công ty; tài khoản mới nhận công ty của người tạo. Tạo hoặc đổi sang vai trò ngoài phạm vi là `ROLE_OUT_OF_SCOPE`
— không tài khoản nào đổi giữa nhóm vai trò nền tảng và nhóm vai trò công ty, nên vai trò công ty luôn có công ty. Không ai tự khoá, xoá,
đổi vai trò mình (`SELF_CHANGE_FORBIDDEN`); `LAST_ADMIN` **theo phạm vi**: nền tảng giữ một quản trị hệ thống đang hoạt động, mỗi công ty
giữ một quản trị công ty đang hoạt động (quản trị công ty của công ty khác không tính). Kho **không kiểm quyền** (`users.manage`) — đó vẫn
là việc của route; kho chỉ xét phiên thuộc phạm vi nào. Nhật ký: quản trị hệ thống đọc cả hệ thống, lọc theo công ty (`cong-ty`); quản trị
công ty đọc sự kiện của công ty mình. **Sự kiện về một tài khoản thuộc công ty của tài khoản đó**, ai làm cũng vậy (`auditEventCompany` —
một luật cho seed và `ctx.log`; ghi nhật ký trước khi xoá tài khoản): quản trị hệ thống khoá một nhân viên thì quản trị công ty của người
đó đọc được, kèm tên người làm (`listAuditNames` trả thêm người làm ngoài công ty); việc trên tài khoản nền tảng không thuộc công ty nào.
Màn công ty (`companies.manage`) chưa có; tạo công ty kèm quản trị công ty đầu tiên là việc của màn đó.
*(đã điều chỉnh 02/10/2026, FE-0-07, D-80)* **Điều phối viên duyệt phương án**: `plans.approve` (chỉnh tay và Duyệt trong Planner) là của điều
phối — lập chuyến, chạy tối ưu, chỉnh tay, rồi "Duyệt phương án" / "Duyệt bản chỉnh". Quản lý công ty (`manager`) chỉ đọc + xuất báo cáo: mở
Planner ở chế độ chỉ xem, một dòng lý do. Không còn hàng đợi `/duyet` (đường dẫn cũ là màn 404), quyền `plans.review` và các quyết định trả lại
của quản lý (từ chối, yêu cầu tối ưu lại, đề xuất đổi xe / tách chuyến). Trước đó LM-104 (27/09/2026) giao duyệt cho quản lý công ty và LM-108
(28/09/2026) cho điều phối "Lưu bản chỉnh" vào hàng đợi duyệt. *(đã điều chỉnh 03/10/2026, FE-4b-01)* **Yêu cầu giao thay Đơn hàng** (D-72): hai quyền tạm `orders.view` / `orders.edit`, màn `/don-hang`,
feature `orders/`, nhóm tìm nhanh và mục điều hướng "Đơn hàng" đã bỏ — ma trận còn đúng 33 quyền của PRD v2. Màn `/yeu-cau-giao` mở theo
`requirements.view` (quản lý công ty và điều phối viên; `/don-hang` chuyển hướng sang đó); tạo, sửa, xoá theo `requirements.edit` — chỉ
**quản lý công ty**; đưa yêu cầu vào chuyến / gỡ khỏi chuyến là sửa chuyến, theo `trips.edit` của điều phối viên. Mục "Yêu cầu giao" đứng ở
chỗ "Đơn hàng" cũ trên thanh của hai vai trò đó (en: "Requirements"). Kho không xét vai trò cho các hàm yêu cầu giao — quyền chặn ở giao
diện. *(đã điều chỉnh 02/10/2026, FE-0-06)* Ba quyền `packages.register`, `shipments.manage`, `receiving.operate` đã bỏ cùng
hai vai trò của Review 1; `/lo-hang`, `/lo-hang/:shipmentId`, `/nhan-hang` không còn — đường dẫn cũ là màn 404. *(đã điều chỉnh 03/10/2026,
FE-3b-03)* **Kho kiện** `/kien-hang` mở theo `packages.view` (điều phối viên quản lý, quản lý công ty chỉ đọc: không nút ghi, không chọn kiện in
nhãn, không gỡ cờ); nút ghi của màn đó và `/loai-kien` theo `packages.manage` của điều phối viên. *(đã điều chỉnh 03/10/2026, FE-3b-05,
FE-3b-06)* In nhãn `/kien-hang/nhan` theo `labels.print` và Tra cứu kiện `/tra-cuu-kien` theo `packages.lookup` — điều phối viên và nhân
viên kho. 19 quyền mới của
PRD v2 (`requirements.*`, `packages.view`/`manage`/`lookup`, `labels.print`, `routes.optimize`, `manualConfirm.approve`, `monitoring.view`,
`exceptions.*`, `deadlines.renegotiate`, `pickups.*`, `companies.manage`, `subscriptionPlans.manage`, `billing.manage`, `support.*`) đã có tên và
nhãn; trừ `packages.view`, `packages.manage`, `packages.lookup`, `labels.print`, `requirements.view` / `requirements.edit` (FE-4b-02),
`routes.optimize` (nút "Tối ưu tuyến" ở Chi tiết chuyến — điều phối viên, *bổ sung 03/10/2026, FE-4b-09*), `manualConfirm.approve` (nút
Duyệt / Từ chối của thẻ "Xác nhận tay chờ duyệt" ở Chi tiết chuyến — điều phối viên, *bổ sung 03/10/2026, FE-6-04*) và — *(đã điều chỉnh
03/10/2026, FE-6-10 → FE-6-12)* — bốn quyền của giám sát: `monitoring.view` (màn `/giam-sat` và vị trí xe ở Chi tiết chuyến — điều phối viên,
quản lý công ty), `exceptions.report` (nút "Báo sự cố" ở `/giam-sat` của điều phối viên, nút "Sự cố trên đường" ở màn điểm giao của tài xế),
`exceptions.resolve` (tìm tuyến khác, chuyển quản lý, đã xử lý — điều phối viên) và `deadlines.renegotiate` (tab "Sự cố cần xử lý" — quản lý
công ty), chúng **chưa gắn route, mục nav hay nút nào** — chỉ hiện ở Ma trận quyền và chip quyền của panel người dùng; issue
làm màn nào thì nối quyền của màn đó, route đang có giữ nhóm quyền cũ.
Mỗi nhóm route bọc `RequirePermission` trong `app/App.tsx`, thiếu quyền là màn 403 (`app/ForbiddenPage.tsx`) có nút về màn chính;
thanh điều hướng chỉ hiện mục có quyền; nút ghi ẩn qua `useCan()`. Backend thật phải kiểm lại ở server. Màn mới thêm route vào đúng nhóm quyền;
E2E đăng nhập bằng `login(route, role)`; *(đã điều chỉnh 01/10/2026, FE-0-03)* không còn vai trò toàn quyền nên kịch bản đi qua nhiều vai trò
**đăng nhập đúng vai trò của từng bước**, đổi người trong app bằng `switchUser` (`e2e/spec-flow-helpers.ts` — tải lại trang là mất kho), và test
DOM đăng nhập đúng người bằng `signedInAs(vai trò | mã người dùng seed)`. Tài khoản công ty gắn `User.companyId`: nhân viên seed thuộc `LOG-001`
(Long Bình), năm tài khoản `@phuongnam.vn` thuộc `LOG-002`; ba tài khoản nền tảng không có công ty và không có kho (`User.depot` tuỳ chọn; kho
bỏ cả hai khi vai trò là nền tảng). *(đã điều chỉnh 02/10/2026, FE-0-06)* Seed chỉ còn hai công ty logistics (`MFR-…` đã bỏ) và 20 tài khoản:
mỗi công ty đủ năm vai trò công ty — `viet.lam@phuongnam.vn` (`US-0015`) là nhân viên kho của Phương Nam; `sanxuat@`, `logistics@` (`US-0013`,
`US-0014`) đã bỏ cùng vai trò của chúng. *(đã điều chỉnh 02/10/2026, FE-0-02, D-64)* Kho **lọc dữ liệu theo công ty của phiên** (mục 9
"Lớp dữ liệu"): người của một công ty chỉ thấy xe, loại xe, loại kiện, kiện, yêu cầu giao, chuyến, phương án, người dùng và nhật ký của công ty mình;
ba vai trò nền tảng bị mọi hàm dữ liệu vận hành từ chối (`COMPANY_REQUIRED`), chỉ đọc người dùng, nhật ký và danh sách công ty. Mỗi công ty có
kho xuất phát kèm toạ độ (`Company.depot`: Kho Long Bình ở KCN Biên Hoà 2; Kho Phú Thuận ở Quận 7). Seed có từ trước (8 xe, 15 chuyến, 8 loại
kiện, 88 kiện kho kiện, 6 yêu cầu giao) thuộc Long Bình; Phương Nam có bộ nhỏ riêng ở `seed-phuong-nam.ts` — 2 xe, 1 loại xe, 2 loại kiện, 10 kiện, 1
yêu cầu giao, 2 chuyến; kiện nhập tay của các chuyến seed cũng là kiện kho kiện (FE-3b-07, mục 9) (`TRIP-PN-001` đã duyệt, gán `taixe@phuongnam.vn`; `TRIP-PN-002` nháp) — mã mang `PN` (`TRIP-PN-…`, `VEHICLE-PN-…`, `REV-PN-…`)
nên `nextId` không tính. Tài khoản seed thêm ở FE-0-03 mang mã ngoài dạng
`US-NNNN` (`US-NT-…`, `US-LB-…`, `US-PN-…`): `nextId` không tính nên mã kế tiếp ghi trong test giữ nguyên (`US-0016`, vì `US-0015` ở lại).
Ô đăng nhập nhanh (`DemoAccounts`) chia ba nhóm — "Nền tảng", Long Bình, Phương Nam (tên công ty lấy từ seed); `nentang@`, `hotro@` chưa nằm trong
ô đó tới khi có màn riêng. *(đã điều chỉnh 02/10/2026, FE-0-04)* Mục điều hướng khai **theo vai trò** ở `app/nav-items.ts`:
`NAV_SCREENS` là các màn có mục — chỉ màn đang có route (D-20) — và `NAV_ITEMS` là danh sách của từng vai trò theo thứ tự của vai trò đó, màn
chính đứng đầu. Quản trị hệ thống, quản trị công ty: Người dùng · Nhật ký. Quản lý công ty: Bảng điều khiển · Đơn hàng (chỉ đọc) · Kho kiện (chỉ đọc,
FE-3b-03) · Chuyến hàng · Giám sát · Đội xe. Điều phối viên: Chuyến hàng · Giám sát · Kho kiện · Đơn hàng · Đội xe · Bảng điều khiển
(*đã điều chỉnh 03/10/2026, FE-6-10*: mục "Giám sát" `/giam-sat` đứng ngay sau Chuyến hàng ở cả hai vai trò — sáu mục, đã đo ở 1.366 px). Kho, tài xế: một mục về màn của mình (thanh chỉ hiện với
họ ở màn hồ sơ). Quản lý nền tảng, hỗ trợ khách hàng chưa có mục nào nên thanh không vẽ khay điều hướng. Danh sách là phần chọn lọc và thứ tự;
quyền vẫn là cổng (`navItemsFor` bỏ mục thiếu quyền). Màn mới thêm một dòng vào `NAV_SCREENS` và mã của nó vào `NAV_ITEMS`, trong issue của màn
đó. Loại kiện và In nhãn không có mục riêng, mở từ màn Kho kiện (nút "Loại kiện" trên dải tiêu đề, nút quay lại ở hai màn kia); Loại xe mở từ
màn Đội xe. *(đã điều chỉnh 03/10/2026, FE-3b-06)* Tra cứu kiện cũng không có mục riêng: điều phối viên mở bằng nút "Tra cứu kiện" trên dải
tiêu đề của Kho kiện, nhân viên kho bằng nút 56 px ở thanh màn chính `/kho`. `app/role-routes.dom.test.tsx` kiểm bằng **bảng route thật** và ma trận quyền: màn chính, đích của logo, mọi mục điều hướng và mọi
nhóm tìm nhanh của từng vai trò là route có thật mà vai trò mở được; mọi màn có tiêu đề tab và nhánh `titles` không còn tên của màn đã bỏ — bỏ
một route hay một quyền mà quên các chỗ đó là test đỏ.
Nhật ký và chuông chỉ biến đối tượng thành liên kết khi người xem có quyền mở trang đích (`describeEvent(…, can)`) —
quản trị viên đọc nhật ký nhưng không xem được chuyến, xe. Màn kho và tài xế chỉ còn vai trò của chính nó mở được.
Logo mở `/` khi có quyền bảng điều khiển, không thì màn chính của vai trò. *(bổ sung 17/09/2026)* Đăng nhập xong mở
màn của vai trò (`features/auth/landing.ts`: điều phối `/chuyen`, quản lý `/`, kho `/kho`, tài xế `/tai-xe` (LM-087),
quản trị hệ thống và quản trị công ty `/nguoi-dung`; *(tạm, FE-0-03)* quản lý nền tảng và hỗ trợ khách hàng `/ho-so` tới khi có màn nền tảng ở
Sprint 8 — màn chính phải là màn vai trò đó mở được, vì nút "Về màn chính" của 403 / 404, logo và nút thoát đều dẫn tới đó); liên kết sâu mở
trước khi đăng nhập được giữ, gốc `/` thì không. Đăng xuất không ghi nhớ trang đang đứng
(`RequireAuth` chỉ nhớ trang khi người **chưa** đăng nhập mở nó). Nút thoát ở màn kho/tài xế theo vai trò (`features/auth/exit.ts`):
nhân viên kho và tài xế **ở màn danh sách** thì **đăng xuất** (màn chính của họ), **trong phiên xếp / trong chuyến** thì về danh sách
(`/kho`, `/tai-xe`, LM-086/087); vai trò khác về màn chính của mình. *(đã điều chỉnh 02/10/2026, FE-0-04)* Vai trò xem được chuyến về trang chuyến đã mở màn đó: `exitAction` hỏi quyền `trips.view`, không hỏi tên vai trò — từ FE-0-01 chỉ nhân viên kho và tài xế mở được hai màn này nên chưa ai đi tới nhánh đó. *(đã điều chỉnh 26/09/2026, V2.3)* Điều hướng là **thanh ngang 60 px trên dải trời** ở đầu trang (`app/NavRail.tsx`): logo
trái, nhóm mục giữa trên kính tối (`.glass-nav`), tìm nhanh · ngôn ngữ · chuông · tài khoản phải. Mục đang mở nằm dưới kính cyan
(trong + viền + quầng, `--nav-on`), và kính đó là **chỉ báo trượt theo con trỏ** (`useGlassFollow`, `.glass-follow`): bám mục
đang rê / focus, về mục đang mở khi con trỏ rời thanh. Chỉ báo là phản hồi nền duy nhất; mục đang mở chỉ có chữ trắng 600, **không** nền
riêng, nếu không sẽ thành hai lớp chồng nhau. *(26/09/2026)* Bản đầu của đợt 2 bỏ chỉ báo này; người dùng yêu cầu giữ lại.
Ngôn ngữ trên thanh là một nút "VI" mở menu chọn (`components/LanguageMenu.tsx`); màn toàn màn hình kho/tài xế giữ hai nút
`LanguageSwitch` 56 px. Vòng focus trên dải trời là `--cyan-300` (`--primary` không đủ tương phản trên nền tối). Trước 23/09/2026 đây là
rail dọc 96 px; 23/09 đổi sang ngang 56 px nền sáng (V2), 26/09 lên dải trời (V2.3). Thanh còn có nút Tìm nhanh (Ctrl+K / ⌘K, LM-099 — chỉ nhóm có quyền xem, `searchGroupsFor`; LM-104 thêm kho kiện, loại kiện, và nhóm yêu cầu giao theo `requirements.view` thay nhóm đơn hàng (FE-4b-02) — kho kiện theo `packages.view` (FE-3b-03), loại kiện theo `packages.manage` của điều phối viên, nhóm lô hàng và lô đang đến đã bỏ; màn toàn màn hình không
có), chuông thông báo (LM-098 — sự kiện nhật ký liên quan vai trò, không gồm việc chính mình làm; "đã đọc" là state giao diện trong tab,
`read-state.ts`) và mục "Hồ sơ cá nhân" trong menu tài khoản (`/ho-so`, LM-096 — mọi người đã đăng nhập; kho/tài xế mở từ nút tài khoản
56 px ở màn chính). Nút hành động trên thanh dùng `components/NavRailButton.tsx`. Thanh ngang chật hơn rail dọc: thêm mục vào đây phải
đo lại ở 1.366 px (`e2e/layout-1366.spec.ts` đo thanh của điều phối viên và quản lý công ty ở cả hai ngôn ngữ).
*(đã điều chỉnh 02/10/2026, FE-0-04)* **Tìm nhanh theo vai trò**: quản trị hệ thống, quản trị công ty tìm người dùng; quản lý công ty tìm
chuyến, kiện, yêu cầu giao, kho kiện, xe; điều phối viên thêm loại kiện; kho, tài xế, quản lý nền tảng, hỗ trợ khách hàng không có nhóm
nào nên không có nút và không bắt Ctrl+K. `search-api.ts` chỉ gọi hàm kho mà nhóm của vai trò cần. **Chuông theo vai trò**
(`NOTIFICATION_ACTIONS`): điều phối viên — đồng nghiệp duyệt phương án, kho báo thiếu kiện lúc soạn / kiện hỏng lúc xếp / xếp xong, sự cố giao, chuyến hoàn thành, chuyến bị
huỷ; quản lý công ty — chuyến hoàn thành, chuyến bị huỷ, sự cố giao, và kiện **của một yêu cầu giao** bị bỏ khỏi chuyến vì thiếu hoặc hỏng (yêu cầu thành giao thiếu, D-92);
*(đã điều chỉnh 03/10/2026, FE-6-02, FE-6-07)* nhân viên kho — quyết định của điều phối viên với kiện **mình báo thiếu** và chuyến bị huỷ **lúc đang xếp** (dỡ phần đã xếp); quản trị hệ thống, quản trị công ty — việc trên tài khoản và đăng nhập sai;
vai trò không có nguồn nào (quản lý nền tảng, hỗ trợ khách hàng) không có chuông. Sự kiện của luồng mới thêm ở issue của luồng đó.
*(đã điều chỉnh 03/10/2026, FE-6-04)* Điều phối viên còn nhận **xác nhận tay mới gửi** (`manualConfirm.requested`). Nhân viên kho và tài
xế có chuông với đúng một loại: xác nhận tay **của chính mình** bị từ chối (`manualConfirm.rejected`, lọc theo tham số `requestedBy` —
`PERSONAL_ACTIONS`); chuông của họ là nút 56 px ở thanh màn chính `/kho`, `/tai-xe` (`NotificationBell variant="touch"`, chữ 16 px), và
thông báo về một chuyến mở chuyến đó ở màn của vai trò (`operationHref`), vì họ không mở được Chi tiết chuyến. Ở `/tai-xe` dưới 480 px
tiêu đề xuống hàng riêng để hàng trên đủ chỗ cho bốn điều khiển 56 px.
vai trò không có nguồn nào (kho, tài xế, quản lý nền tảng, hỗ trợ khách hàng) không có chuông. Sự kiện của luồng mới thêm ở issue của luồng đó.
*(đã điều chỉnh 03/10/2026, FE-6-09)* Điều phối viên nhận thêm **nguy cơ trễ hạn giao** (`delivery.etaRisk` — sự kiện của hệ thống, không có
người làm) ở chuông **và toast**: `EtaRiskWatcher` (`features/monitoring`, đứng cạnh chuông, không vẽ gì) đọc giám sát của các chuyến Đang vận
chuyển theo nhịp điểm vị trí; cảnh báo kho phát sau lần đọc đầu thành toast (sát hạn: cảnh báo; trễ hạn dự kiến: lỗi) và chuông đọc lại ngay,
cảnh báo có từ trước chỉ nằm ở chuông. Quản lý công ty không nhận loại này.
*(đã điều chỉnh 03/10/2026, FE-6-11, FE-6-12)* **Sự cố cấp chuyến ở chuông**: điều phối viên — tài xế báo sự cố (`exception.reported`), kho
tự chuyển sự cố cho quản lý sau 30 phút (`exception.escalated`, sự kiện của hệ thống), quản lý đã liên hệ khách và nhập hạn mới
(`exception.deadlineRenegotiated`, để xử lý tiếp); quản lý công ty — sự cố chuyển lên mình (`exception.escalated`). `EtaRiskWatcher` chạy cho
cả hai vai trò (kho chỉ tự chuyển sự cố khi có người đọc giám sát) và hiện toast cảnh báo khi một sự cố vừa chuyển lên — trừ sự cố chính người
đó vừa chuyển.
*(đã điều chỉnh 02/10/2026, FE-0-08)* Chuông không tự lọc theo công ty — kho lọc: quản trị công ty chỉ nhận sự kiện tài khoản của công ty
mình (kể cả việc quản trị hệ thống làm trên người của công ty), không nhận gì về tài khoản nền tảng hay công ty khác.

### MVP theo Build Spec *(bổ sung 15/09/2026)*

Đang tích hợp [docs/build-spec.md](docs/build-spec.md) vào repo
này trên nhánh `feat/spec-mvp`. Quyết định và phạm vi: [docs/prd.md](docs/prd.md) (D-01 → D-39).
Việc chia nhỏ: [docs/issues/](docs/issues/README.md). Tiến độ theo ngày: [docs/progress.md](docs/progress.md).

- **Bắt buộc theo Spec:** đơn vị cm/kg, hệ toạ độ, mô hình dữ liệu và contract
  `OptimizationService`, validation, nhãn **MOCK RESULT**, acceptance criteria mục 15.
  Khi luật dưới đây mâu thuẫn với phần bắt buộc của Spec, Spec thắng và phải sửa luật.
- **Được điều chỉnh cho khớp repo:** cấu trúc thư mục, component, thư viện.
- Mọi kết quả từ mock có badge **MOCK RESULT** (không dịch). Không có chữ kiểu "AI optimized",
  không đặt tên service là `AIService`.
- Giao diện chuyển được **vi / en** (D-07); tiếng Việt là ngôn ngữ mặc định và nguồn chuẩn của từ điển.

### Đợt 6 — hoàn thiện 5 vai trò *(bổ sung 19/09/2026)*

MVP đã nghiệm thu và nằm ở `main`. Đợt 6 làm trên `feat/ui-complete` để cả 5 vai trò ở bảng trên có luồng đầu-cuối
(bảo vệ SEP490): [rà soát giao diện](docs/ui-audit-2026-09-19.md), [PRD mục 15](docs/prd.md) (D-40 → D-57), issue LM-080 → LM-101.
Không chờ backend: giả lập phân quyền, **không** giả lập lưu bền — kho vẫn in-memory.

### Kế hoạch sau Review 1 *(bổ sung 30/09/2026)*

Quyết định và issue của giai đoạn sau Review 1 nằm ở `docs/prd-v2.md` và `docs/issues-2-fe/` — tài liệu nội bộ, chỉ có trên máy của
nhóm (mục 13). Đọc hai tài liệu đó trước khi làm việc thuộc giai đoạn này. Luật ở các mục dưới mô tả code hiện tại; issue nào đổi luật
thì sửa luật ở đây cùng lúc (danh sách ở `docs/prd-v2.md` mục 15).

## 2. Tech stack

Khóa version trong lockfile, không tự nâng major. Dùng **pnpm**, không dùng npm/yarn
(`package-lock.json` và `yarn.lock` đã bị chặn trong `.gitignore`).

```
react 19  ·  vite  ·  typescript
tailwindcss v4           — cấu hình bằng @theme trong CSS, không có tailwind.config
@radix-ui/react-*        — primitive không giao diện
@tanstack/react-query    — data fetching, cache, optimistic update
@tanstack/react-table v9 — mọi bảng dữ liệu
react-hook-form + zod v4 — mọi form
react-router v7          — routing
recharts                 — 3 biểu đồ bảng điều khiển (LM-090, D-48), chỉ import trong
                           features/manager/DashboardCharts (tải lười); xem mục 6 "Không bịa số"
write-excel-file         — xuất báo cáo .xlsx: import('write-excel-file/browser') khi bấm (LM-090)
read-excel-file          — nhập kiện .xlsx: import('read-excel-file/browser') khi mở file (LM-093)
dnd-kit                  — kéo thả thứ tự điểm giao, ghim kiện
qrcode-generator         — mã hoá QR (MIT, không phụ thuộc) cho components/QrCode (LM-104); quét QR dùng BarcodeDetector gốc
                           của trình duyệt trong components/QrScanDialog, không thêm thư viện quét
maplibre-gl              — bản đồ (FE-4b-07, D-75), khoá đúng một version; CHỈ import trong src/components/map, tải lười cùng CSS
                           và worker của nó (không CDN). Nền Goong qua VITE_GOONG_MAPTILES_KEY; không có khoá thì nền trống
lucide-react             — icon, KHÔNG dùng bộ khác
sonner                   — toast
motion                   — animation 2D
```

Riêng cho 3D viewer (chỉ trong `src/features/viewer3d`):

```
three  ·  @react-three/fiber  ·  @react-three/drei
@react-three/postprocessing  ·  @react-spring/three
camera-controls (qua drei)
```

Kiểm thử (devDependencies):

```
vitest 5                 — unit (node) và dom (jsdom), cấu hình ở vitest.config.ts
@testing-library/react   — test component qua hành vi người dùng (+ user-event, jest-dom)
@playwright/test         — E2E trình duyệt thật (thêm ở LM-005)
```

*(đã điều chỉnh 03/10/2026, FE-4b-07)* Bản đồ: màn import `RouteMap` từ `@/components/map`, không import `maplibre-gl`. **Không dùng nền
OpenStreetMap** hay nguồn gạch nào ngoài Goong (D-75: không bảo đảm thể hiện Hoàng Sa, Trường Sa). Khoá map tiles chỉ nằm ở `.env.local`
(mẫu: `.env.example`; mọi `.env*` khác bị `.gitignore` chặn); dev, CI và test chạy không khoá. Khoá REST của Goong không bao giờ ở FE.

**Không dùng:** `framer-motion-3d` (deprecated, không hỗ trợ React 19) · Redux · Zustand (state dùng chung đi qua mock repository + TanStack Query, D-06) · thư viện i18n (từ điển tự viết, D-07) · axios (dùng fetch) · moment.js · thư viện UI khác.

### Radix trực tiếp, không dùng shadcn CLI *(đã điều chỉnh)*

Luật ban đầu ghi "shadcn/ui (Radix)". Thực tế shadcn bản hiện tại sinh code trên
**Base UI** chứ không phải Radix, và variant mặc định của nó lệch hẳn spec design
(nút `h-8` thay vì 40/56px, `active:translate-y-px` vi phạm luật hover ở mục 5,
`disabled:opacity-50` thay vì nền `--border`).

Nên: cài thẳng `@radix-ui/react-*` cho phần cần hành vi và khả năng truy cập
(Select, Dialog, DropdownMenu, Checkbox, Switch, RadioGroup, Tabs, Tooltip,
ScrollArea, Separator, Slot), rồi **tự viết lớp giao diện** trong `components/ui/`.
Không chạy `shadcn add`.

### TanStack Table v9

API v9 khác hẳn v8: dùng `useTable` + `tableFeatures({})` + `createColumnHelper`,
**không** dùng `useReactTable`/`getCoreRowModel`. Tài liệu chính chủ nằm trong
`node_modules/@tanstack/react-table/skills/`.

## 3. Cấu trúc thư mục

```
src/
  app/                  router, providers, app shell, thanh điều hướng, route-title.ts (tiêu đề tab)
    design-system/      2 trang tài liệu bàn giao (/kieu-dang, /thanh-phan)
  components/ui/        primitive tự viết trên Radix
  components/brand/     logo LoadMaster: LogoMark (biểu tượng SVG), Logo (bộ ghép + khẩu hiệu) — LM-105
  components/           component dùng chung: StatusBadge, DataTable, FilterBar, EmptyState, TripLockBanner, ConfirmDialog,
                        VehicleName (tên xe không bẻ biển số), PageHero (thanh tiêu đề màn), KpiTile (ô số liệu), QrCode / QrScanDialog (vẽ và quét mã QR, LM-104), PackageVerify (đối chiếu kiện ba mức, FE-6-03),
                        ScreenShell (PageHero + vùng cuộn + trạng thái tải / lỗi / câu đếm, LM-104)...
  components/map/       bản đồ dùng chung (FE-4b-07): RouteMap (kho, điểm giao, tuyến, xe), nơi duy nhất import maplibre-gl;
                        *(bổ sung 03/10/2026, FE-4b-03)* CoordinatePicker (ô chọn toạ độ: tìm địa danh mẫu, hai ô vĩ độ / kinh độ, bản đồ
                        bấm chọn khi có khoá map tiles), `places-api.ts` (tìm địa chỉ — chưa có ở BE, Q-20)
  features/
    auth/               đăng nhập, phiên, RequireAuth
    trips/              danh sách, chi tiết, form chuyến, so sánh phương án
    monitoring/         *(bổ sung 03/10/2026, FE-6-08, FE-6-09)* vị trí xe và ETA trực tiếp của chuyến Đang vận chuyển: `monitoring-api.ts`,
                        `useTrackingQuery.ts`, `LiveLocationBar` (dòng vị trí kèm nhãn "Mô phỏng"), `EtaRiskWatcher` (toast nguy cơ trễ hạn);
                        *(đã điều chỉnh 03/10/2026, FE-6-10 → FE-6-12)* màn Giám sát `/giam-sat` (`MonitoringPage` → `MonitoringBoard`:
                        bản đồ, danh sách, chi tiết chuyến; hàm thuần `monitoring-view.ts`), kênh sự kiện `monitoring-events.ts`
                        (`subscribeTrip`), sự cố cấp chuyến (`exceptions-api.ts`, `ReportExceptionDialog`, `RerouteDialog`,
                        `TripExceptionList`, `TripExceptionButton` cho màn tài xế), tab của quản lý (`EscalationTab`, `RenegotiateDialog`)
    optimization/       chạy job, theo dõi tiến trình
    viewer3d/           toàn bộ code Three.js, tách biệt hoàn toàn
    warehouse/          luồng xếp hàng ở kho
    driver/             luồng giao hàng
    manager/            dashboard
    fleet/              đội xe
    admin/              người dùng
    package-pool/       *(đã điều chỉnh 03/10/2026, FE-3b-03)* kho kiện `/kien-hang` (danh sách, thêm kiện, nhập file, chi tiết kiện), loại kiện,
                        nhãn QR `/kien-hang/nhan` (FE-3b-05), tra cứu kiện `/tra-cuu-kien` (FE-3b-06) — thay `packages-source/` của LM-104
    requirements/       *(đã điều chỉnh 03/10/2026, FE-4b-01)* yêu cầu giao `/yeu-cau-giao`: danh sách, form tạo / sửa, chi tiết, đưa vào
                        chuyến (FE-4b-02) — thay `orders/` của LM-104
    vehicle-types/      danh mục loại xe (LM-104)
  lib/                  format, helper, mock dùng chung, api client
    i18n/               từ điển vi/en (mỗi nhánh một file trong vi/, en/ — LM-080), provider, hook (LM-027)
    mock-db/            kho in-memory: xe, chuyến, revision bất biến, Duyệt (LM-026); vòng đời chuyến, tiến độ kho/giao,
                        bảo dưỡng xe (LM-081); người dùng, phiên, nhật ký (LM-082); seed 15 chuyến neo theo ngày (LM-083);
                        *(đã điều chỉnh 03/10/2026, FE-3b-01)* kho kiện theo mô hình backend (`package-model.ts`: kiểu `Package`,
                        bảng chuyển trạng thái; `db-packages.ts`; `db-package-progress.ts` ghi trạng thái theo mốc của chuyến;
                        `seed-packages.ts`) thay kiện đăng ký `RPK`; kiện thêm trong chuyến tự vào kho kiện (`db-trip-packages.ts`,
                        `seed-trip-pool.ts`, FE-3b-07);
                        *(đã điều chỉnh 03/10/2026, FE-4b-01)* yêu cầu giao thay đơn hàng (`requirement-model.ts`: kiểu
                        `DeliveryRequirement`, trạng thái suy, bảng ưu tiên D-93; `db-requirements.ts`; `db-requirement-trips.ts`
                        đưa vào / gỡ khỏi chuyến và theo mốc của chuyến; `seed-requirements.ts`) — `db-orders.ts` đã xoá;
                        *(bổ sung 03/10/2026, FE-4b-03 → FE-4b-05)* địa danh mẫu `seed-places.ts`; điểm giao tự sinh `trip-stops.ts`
                        (thuần) + `db-trip-lines.ts`; kiện kho kiện đưa thẳng vào chuyến `db-trip-pool.ts`; kho xuất phát `seed-depots.ts`;
                        *(bổ sung 03/10/2026, FE-5b-08)* đổi xe của chuyến Đã lập kế hoạch `db-trip-vehicle.ts`; luật duyệt kho tự kiểm
                        ở `db-revisions.ts` + `revisions.ts` (`approvalIssues`); *(bổ sung 03/10/2026, FE-5b-05)* lần chạy lưu ba
                        phương án ứng viên `saveOptimizationRun` (`db-revisions.ts`), seed dựng ba phương án mỗi chuyến `seed-plan.ts`;
                        Review 1 (LM-104): công ty logistics, loại kiện, mã QR, lần chạy tối ưu
                        (`db-runs.ts`), loại xe, nhãn QR / quét khi xếp và dỡ, seal (`db-*.ts`, kiểu ở `source-types.ts`,
                        hàm của kho ở `db-api-review1.ts`), báo cáo chuyến thuần `trip-report.ts`; *(bổ sung 03/10/2026, FE-6-03,
                        FE-6-04)* đối chiếu kiện ba mức và duyệt xác nhận tay (`verify-model.ts` kiểu + luật thuần,
                        `db-scans.ts`, `db-manual-confirm.ts`); lô hàng và nhận hàng
                        (`db-shipments.ts`) đã bỏ ở FE-0-06; cách ly theo công ty của phiên (`tenancy.ts`, mọi `db-*.ts` đi
                        qua `ctx.scope`; `tenancy.test.ts` liệt kê mọi hàm công khai) và seed của Phương Nam
                        (`seed-phuong-nam.ts`) — FE-0-02;
                        *(bổ sung 07/10/2026, FE-7-01)* yêu cầu nhận dọc đường (`pickup-model.ts`: kiểu, trạng thái, bảng chuyển;
                        `db-pickups.ts`, `db-api-pickups.ts`; `seed-pickups.ts`)
  types/                type dùng từ hai feature trở lên
  domain/               logic nghiệp vụ THUẦN theo Spec — không React, không Three.js
    geometry/           số (roundCm, EPSILON), hộp, chồng lấn, biên thùng, 6 hướng đặt, lưới không gian
    models/             type contract Spec + zod schema (LM-010); ba mục tiêu của phương án ứng viên `plan-objective.ts` (FE-5b-05)
    constraints/        validation và ràng buộc, trả mã lỗi (LM-014 →); phân tách hàng `segregation.ts` (FE-4b-06); luật duyệt
                        `approval.ts` và xe có chở được hàng của chuyến không `vehicle-fit.ts` (FE-5b-08)
    metrics/            tỷ lệ sử dụng, trọng tâm (LM-021); tải trục trước / sau theo mô hình đòn bẩy `axle-load.ts` (FE-5b-03); độ lệch
                        tải giữa hai nhóm trục và điểm cân tải `axle-balance.ts` (FE-5b-05)
    fixtures/           dữ liệu mẫu Spec mục 12
    cargo/              mở rộng quantity thành instance, trùng ID, mã kiện mới (LM-013)
    routing/            mock tối ưu tuyến (FE-4b-08): haversine, thứ tự điểm, ETA, mức hạn; hằng số ở `ROUTING_CONSTANTS`; chuyến
                        gọi qua `lib/mock-db/trip-route.ts` (FE-4b-09); *(bổ sung 03/10/2026, FE-6-08, FE-6-09)* xe mô phỏng dọc tuyến
                        `simulate.ts` (`simulateVehicle`, nhịp 30 giây ở `SIMULATION_CONSTANTS`) và ETA từ vị trí xe `liveEta`;
                        *(bổ sung 03/10/2026, FE-6-11)* mock tuyến thay thế `reroute.ts` (`rerouteOptions`, `REROUTE_CONSTANTS`)
    zones/              vùng theo điểm giao (FE-5b-02): `stopZones`, vùng của một kiện và số lần dỡ-xếp lại (`locateInZones`,
                        `zonePlacements`)
    pickup/             *(bổ sung 07/10/2026, FE-7-02)* nhận hàng dọc đường: mười luật `evaluatePickup` và chèn điểm `insertPickupStops`
  services/
    optimization/       interface OptimizationService, MockOptimizationService, worker (LM-024 →); mock xếp kệ theo vùng điểm giao
                        (`shelf-packer.ts` chia dải, `shelf-walls.ts` vách / cột / chồng — FE-5b-02); ba phương án ứng viên một job
                        (`mock-candidates.ts`, `candidate-layouts.ts` dựng và chọn cách xếp, `mock-plan.ts` phần dùng chung — FE-5b-05)
  test/                 setup và dữ liệu test dùng chung (setup-dom.ts, spec-13.ts, placements.ts, engine-plans.ts)
tests/                  unit test cũ của viewer3d (Vitest)
e2e/                    Playwright (LM-005)
```

Mỗi feature tự chứa component, hook, type của nó. Chỉ đưa lên `components/`, `lib/`
hoặc `types/` khi có **từ hai feature trở lên** dùng chung.

**`src/domain` và `src/services`** *(bổ sung, D-19)*: không import React, Three.js, router hay
component. Mọi hàm tính toán ở đây là pure function có unit test. Feature và engine 3D gọi vào
domain, không bao giờ ngược lại. Three.js không quyết định tính hợp lệ của placement.

**Đặt mock ở đâu** *(bổ sung)*: mock chỉ một feature dùng thì để trong feature đó
(`features/viewer3d/benchmark.mock.ts`). Dữ liệu nghiệp vụ nhiều feature dùng chung nằm ở kho `lib/mock-db`, không
thêm mock riêng lên `lib/` (LM-062 đã gỡ `lib/load-plan.mock.ts` mm).

## 4. Design tokens

Đặt trong `src/index.css`. Mọi màu, khoảng cách, bo góc **phải** lấy từ đây, không hardcode hex trong component.

Tailwind v4 nối token qua khối `@theme inline`, nên `bg-surface`, `text-text-2`,
`rounded-md`… trỏ thẳng vào `var()` chứ không sao chép giá trị. Sửa token chỉ ở một chỗ.

### V2.3 "Cyan kính" *(bổ sung 25/09/2026, token đã áp 26/09/2026)*

Bản thiết kế đã chốt nằm ở `design/v2.3/` (`README.md` thứ tự làm, `SCREENS.md` màn → route, `CHANGES.md` việc cần làm).
Đợt 1 (token) đã thay khối `:root` theo `design/v2.3/tokens/index.v2.3.css`: **giữ tên token cũ**, đổi giá trị sang cyan, thêm thang
`--cyan-*`, `--n-*`, `--amber/azure/green/red-*`, `--sky`, `--card-shadow`, `--glass-dark*`, `--primary-fill-*`, `--on-primary`,
`--font-display`. Khối dưới đây là trạng thái hiện tại. Chỗ nào luật cũ ở mục 4–5 khác V2.3 thì theo các dòng
*(đã điều chỉnh 25/09/2026, V2.3)*. `design/v2.3/tokens/v3.css` chỉ để tham chiếu, không import vào `src/`.

- `@theme` xoá thang mặc định `cyan/amber/green/red` của Tailwind rồi khai lại bằng token (cùng `violet`/`purple` để không lọt màu tím): `bg-cyan-600`, `text-red-700`… là màu
  của bảng này, không có bậc nào ngoài bảng (`bg-red-300` không sinh class).
- `font-display` là họ chữ trong `cn()` (`THEME_FONT_FAMILIES` của `lib/utils.ts`); thêm họ chữ mới vào `@theme` thì thêm tên vào đó.
- *(đợt 2, 26/09/2026)* Kính sáng của V2 đã xoá (`--nav-glass`, `--follow-*`, `--tile-*`, `--glass-edge`, `--icon-ring`, `--spring`,
  lớp `.glass-follow`, `.glass-tile`). Còn lại tới đợt của màn dùng chúng: `--chrome` (header trắng của Chi tiết chuyến, So sánh),
  `--hero-icon` (form xe), `--table-head`. Thêm cho dải trời: `--sky-end`, `--sky-h`, `--sky-dots`, `--sky-overlap`, `--sky-text*`,
  `--sky-glass*`, `--nav-on*`, `--avatar-fill`, `--logo-*` (ba màu logo, LM-105); cho thành phần: `--scrim`, `--danger-shadow`, `--meter-fill`,
  `--focus-ring`, `--error-ring`. Lớp dùng chung trong `index.css`: `.sky`, `.glass-nav`, `.glass-dark`, utility `sky-overlap`.

```css
:root {
  /* thang gốc: --cyan-50 … --cyan-950 (#E7FCFD → #02222D), --n-0 … --n-900 xám ánh cyan (#FFFFFF → #0E1C21),
     --{amber|azure|green|red}-{50|200|500|700} — giá trị đầy đủ ở src/index.css */

  /* nền và chữ */
  --bg: #FFFFFF;
  --surface: var(--n-25);        /* #F8FCFD */
  --app: var(--n-50);            /* #F2F8F9 — nền vùng làm việc dưới dải trời */
  --border: var(--n-200);        /* #D9E4E7 */
  --line-soft: var(--n-100);     /* #E7EFF1 — đường chia trong card, dòng bảng */
  --line-strong: #8398A0;        /* viền ô nhập, 3,0:1 trên trắng */
  --text: var(--n-900);          /* #0E1C21 */
  --text-2: var(--n-700);        /* #394D54 */
  --text-3: var(--n-600);        /* #52676F */
  --text-disabled: var(--n-400); /* #9BADB3 — chữ trên nền vô hiệu hoá */

  /* thương hiệu: --primary cho chữ và đường (link, focus, ô đã chọn, biểu đồ); nút chính dùng --primary-fill-* */
  --primary: var(--cyan-700);    /* #006F81 */
  --primary-hover: var(--cyan-800);
  --primary-bg: var(--cyan-50);
  --primary-fill-from: #2ED6E4;  --primary-fill-to: var(--cyan-400);  --primary-fill-border: #00B5C6;
  --primary-fill-hover-from: var(--cyan-400);  --primary-fill-hover-to: var(--cyan-500);
  --primary-fill-shadow: inset 0 1px 0 rgba(255,255,255,.45), 0 8px 22px -10px rgba(0,195,212,.9);
  --on-primary: var(--cyan-950); /* #02222D — chữ trên nút chính */

  /* ngữ nghĩa */
  --success: var(--green-700);   /* #156F41 */
  --warning: var(--amber-700);   /* #9D580C */
  --danger: var(--red-700);      /* #B02A2D */
  --danger-hover: #8E2224;
  --info: var(--cyan-700);

  /* điều khiển */
  --switch-off: var(--n-500);    /* #70848B — rãnh switch khi tắt */
  --highlight: #F7CF40;          /* kiện "Hiện tại" trên nền 3D */

  /* vùng 3D, luôn tối (theme dầu) */
  --canvas-1: #031F29;
  --canvas-2: #021C25;
  --panel-dark: var(--cyan-950);
  --border-dark: #1F4A55;
  --glass-dark: linear-gradient(180deg, rgba(10,44,55,.62), rgba(4,30,39,.55));
  --glass-dark-border: rgba(155,237,242,.16);
  --glass-dark-text: #E7FCFD;  --glass-dark-muted: rgba(203,247,249,.7);

  /* vật cản trong thùng trên canvas tối (LM-033), không trùng màu điểm giao */
  --obstacle: #64748B;          /* không chịu tải */
  --obstacle-bearing: #A3B1C2;  /* chịu tải */

  /* màu định danh điểm giao, an toàn cho người mù màu (Okabe–Ito) */
  --stop-1: #E69F00;  --stop-2: #56B4E9;  --stop-3: #009E73;  --stop-4: #F0E442;
  --stop-5: #0072B2;  --stop-6: #D55E00;  --stop-7: #CC79A7;  --stop-8: #555555;

  /* 7 tông badge, mỗi tông 3 biến bg/fg/border:
     --badge-{neutral|info|cyan|success|warning|danger|azure}-{bg|fg|border}
     azure (V2.3, xanh lam #1D4FAE trên #ECF3FF, 6,8:1) = đang chạy / đang tối ưu / đã xếp xong */

  /* thang mực bốn cấp (V2): tiêu đề và số quan trọng → dữ liệu vận hành → thông tin phụ → chú thích */
  --ink-strong: var(--n-900);  --ink-1: var(--n-800);  --ink-2: var(--n-700);  --ink-3: var(--n-600);
  /* --ink-3 #52676F: 5,9:1 trên trắng, 5,5:1 trên --app (đo 26/09/2026). Đổi token này thì đo lại cả hai nền. */

  /* năm cặp tint cho nền icon và chip. Nghĩa cố định, không mượn sang mục đích khác:
     blue = vận hành (V2.3: sắc cyan, giữ tên) · green = sẵn sàng/xong · amber = cần chú ý
     azure = phân tích phụ · slate = ngữ cảnh (không phải số đo) */
  --tint-blue: var(--cyan-50);     --tint-blue-fg: var(--cyan-800);
  --tint-green: var(--green-50);   --tint-green-fg: var(--green-700);
  --tint-amber: var(--amber-50);   --tint-amber-fg: var(--amber-700);
  --tint-azure: var(--azure-50);  --tint-azure-fg: var(--azure-700);
  --tint-slate: var(--n-100);      --tint-slate-fg: var(--n-700);

  /* dải trời đầu trang (thanh điều hướng + tiêu đề + tab), hai vệt cyan trên nền #02222D → #053341 */
  --sky: radial-gradient(…), radial-gradient(…), linear-gradient(180deg, #02222D 0%, #053341 100%);
  --field: linear-gradient(var(--n-50), var(--n-50));  /* V2.3: nền trang phẳng */

  /* bề rộng tối đa vùng làm việc. Màn 2K trở lên không kéo giãn nội dung:
     điều phối cần thêm dòng, không cần thêm chiều ngang */
  --shell-max: 1680px;

  /* bo góc V2.3 */
  --r-sm: 6px;   /* tag, mốc điểm giao */
  --r-md: 10px;  /* nút, ô nhập, chip */
  --r-lg: 14px;  /* card, toast */
  --r-xl: 18px;  /* hộp thoại, bề mặt kính lớn */

  /* đổ bóng: card chỉ --card-shadow rất nhẹ; e1–e3 cho lớp nổi */
  --card-shadow: 0 1px 2px rgba(2,34,45,.05), 0 10px 28px -14px rgba(2,34,45,.18);
  --e1: 0 1px 2px rgba(2,34,45,.06);
  --e2: 0 18px 40px -16px rgba(2,34,45,.35), 0 0 0 1px rgba(2,34,45,.07);
  --e3: 0 30px 80px -24px rgba(2,34,45,.6), 0 0 0 1px rgba(2,34,45,.06);

  /* chữ */
  --font-display: 'Archivo Variable', 'Archivo', 'Be Vietnam Pro', sans-serif;
  --font-text: 'Be Vietnam Pro', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  /* chuyển động */
  --dur-fast: 120ms;  --dur-md: 250ms;  --dur-slow: 500ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
}
```

Font: **Be Vietnam Pro** cho giao diện, **JetBrains Mono** cho số, mã kiện, kích thước, khối lượng. Mono luôn kèm `font-variant-numeric: tabular-nums`.
*(đã điều chỉnh 25/09/2026, V2.3)* Thêm **Archivo** (variable, `--font-display`, độ rộng 106–112 %) cho tiêu đề màn, tiêu đề card /
hộp thoại và số tổng hợp lớn; file font trong `design/v2.3/tokens/fonts/` (có dải tiếng Việt). Không dùng Archivo cho chữ thân.
Ba file Archivo (tiếng Việt, latin mở rộng, latin) chép vào `src/assets/fonts/`, khai `@font-face` đầu `src/index.css` để Vite đóng
gói cùng app; Be Vietnam Pro và JetBrains Mono vẫn nạp từ Google Fonts ở `index.html`.

### Type scale

| Bậc | Cỡ / dòng | Dùng ở |
|---|---|---|
| display | 32/40 | tiêu đề trang tài liệu |
| h1 | 24/32 | tiêu đề màn |
| h2 | 20/28 | tiêu đề mục, tiêu đề hộp thoại |
| h3 | 16/24 | tiêu đề card |
| body-lg | 16/24 | chữ thân trên tablet và điện thoại |
| body | 14/20 | chữ thân trên desktop |
| caption | 12/16 | nhãn phụ, tiêu đề cột bảng |
| lede | 13,5/22 | câu mô tả dưới tiêu đề màn (`PageHero`) *(V2, 23/09/2026)* |
| micro | 11/14 | nhãn trục biểu đồ, nhãn trong panel nổi *(bổ sung)* |
| note | 11,5/17 | ghi chú nguồn của ô số liệu (`KpiTile`) *(V2, 23/09/2026)* |
| small | 13/18 | chữ phụ trong card, ghi chú đầu card, nút `sm`, mô tả toast *(V2.3, 26/09/2026)* |
| fine | 12,5/18 | chip trạng thái, gợi ý và lỗi dưới ô nhập, tooltip *(V2.3, 26/09/2026)* |

**Số liệu lớn** không nằm trong thang trên vì chúng là hình khối chứ không phải chữ đọc:
`18px` mã kiện trên header · `22px` mã chuyến · `40px` tỷ lệ lấp đầy trong hộp thoại — JetBrains Mono.
*(đã điều chỉnh 23/09/2026, V2)* Số KPI `26px` dùng **Be Vietnam Pro** `tabular-nums`, không mono: mono dành cho mã và số
đo đọc trong bảng, số tổng hợp là nội dung thông thường (brief V2). Không phát sinh thêm cỡ ngoài danh sách này.

Spacing bội số 4px.

**Token cỡ chữ và `cn()`** *(bổ sung 15/09/2026, LM-055)*: `cn()` trong `lib/utils.ts` dùng
tailwind-merge đã khai báo các cỡ chữ của `@theme` (`display`, `h1`, `h2`, `h3`, `body-lg`, `body`,
`caption`, `micro`, `note`, `lede`). Thiếu khai báo thì tailwind-merge coi `text-body` là màu chữ và **bỏ mất `text-white`**
của nút. Thêm token `--text-*` mới vào `@theme` thì phải thêm tên vào `THEME_FONT_SIZES`.

**Nguồn quét class của Tailwind** *(bổ sung 15/09/2026, LM-005)*: `src/index.css` khai báo
`@import 'tailwindcss' source('.')` — chỉ quét `src/`. Không bỏ `source('.')`: mặc định Tailwind v4 quét
cả gốc repo (`AGENTS.md`, `docs/` và các thư mục tạm) và **tải lại toàn trang** dev server
mỗi khi một file ngoài app đổi, làm mất state và làm E2E đỏ ngẫu nhiên. Class chỉ được sinh từ code
trong `src/`; muốn dùng class từ nơi khác thì thêm `@source` tường minh.

## 5. Luật thành phần

### Nút

- Nút chính: cao 40px desktop, **56px tablet và điện thoại**. Padding ngang 16px. Bo góc 8px. Nền đặc `--primary`. Chữ trắng 14px weight 600. Không viền, không bóng lúc nghỉ.
  *(đã điều chỉnh 25/09/2026, V2.3)* Nền gradient dọc `--primary-fill-from → --primary-fill-to`, viền 1 px `--primary-fill-border`,
  **chữ tối `--on-primary`** (7,7:1), bo `--r-md` (10 px), phản sáng trong 1 px và quầng cyan nhẹ. `--primary` (cyan-700) dành cho
  link, vòng focus, ô đã chọn và biểu đồ — không tô nền nút bằng nó. Vẫn một nút chính mỗi màn.
- *(quyết định 16/09/2026)* Màn **điều phối** (danh sách/chi tiết/form chuyến, kiện, thiết lập tối ưu, so sánh, đội xe, dashboard) tạm thời
  **chỉ hỗ trợ desktop**: nút giữ 40px, không bắt buộc 56px. Luật 56px áp cho màn cảm ứng: kho, tài xế, Planner 3D.
- Hover chỉ đổi nền sang `--primary-hover`. **Không** phóng to, **không** nhấc lên. *(đã điều chỉnh 26/09/2026, V2.3)* Nút chính:
  gradient trượt xuống một bậc cyan (`--primary-fill-hover-from → --primary-fill-hover-to`, chữ tối vẫn 5,8:1) — bản mẫu V2.3 không
  vẽ trạng thái hover, đây là lựa chọn của đợt 1. Vô hiệu hoá: bỏ gradient, nền `--border`, chữ `--text-disabled`, không bóng.
- Focus: vòng 2px `--primary` cách 2px. *(bổ sung 19/09/2026, LM-085)* Tailwind v4: `outline-none` tắt biến `--tw-outline-style`,
  nên `index.css` đặt lại `solid` cho `:focus-visible` ngoài `@layer` để `focus-visible:outline-2` vẽ được vòng — không bỏ rule đó.
- Loading: giữ nguyên chiều rộng, thêm spinner 16px bên trái chữ.
- Nút phụ: nền trắng, viền 1px `--border`. Nút ghost: trong suốt. Nút nguy hiểm: nền đặc `--danger`.
  *(bổ sung 26/09/2026, V2.3)* Nút phụ có bóng 1 px (`--e1`), nút nguy hiểm có quầng đỏ (`--danger-shadow`); thêm `variant="glass"` cho
  nút phụ **trên nền tối** (dải trời, khung 3D) và cỡ `sm` 32 px / `lg` 48 px. Nút phụ trên dải trời dùng `glass`, không dùng nút trắng.
- Nút chỉ có icon: 36×36 desktop, 48×48 di động.
- Nút dùng `asChild` bọc `<Link>` thì **không kèm spinner** — Radix `Slot` chỉ nhận đúng một phần tử con.
- *(bổ sung 19/09/2026, LM-092)* Hành động bị chặn vì luật (tự khoá mình, người quản trị cuối cùng, ngoài phạm vi của vai trò…) hiện mờ kèm lý do ngay tại chỗ, không để
  bấm rồi mới báo lỗi; luật cần dữ liệu khác thì để kho trả mã và hiện bằng `dataErrorMessage`.
- Lớp nổi mở từ trong hộp thoại (Select) phải cao hơn lớp phủ Dialog (`z-300`): `SelectContent` dùng `z-400`.
- *(LM-090)* Biểu đồ 2D dùng token qua `var()`: một chuỗi một màu `--primary`, không chú giải; tám màu điểm giao chỉ cho điểm giao;
  lưới `--border` 1 px; nhãn trục micro 11 px, số mono; cột ≤ 24 px bo 4 px đầu dữ liệu; tắt animation; tooltip là lớp nổi (`--e2`).
  Hình `aria-hidden`, có bảng số `sr-only` cùng giá trị (`ChartCard`/`ChartTable`).

### Thành phần V2.3 *(bổ sung 26/09/2026, LM-102)*

Mẫu: `design/v2.3/screens/web/ThanhPhan.jpg`, `TrangThaiChung.jpg`, `MenuToanCuc.jpg`; kiểu gốc `design/v2.3/tokens/v3.css`.

- **Chip trạng thái** (`Badge`, `StatusBadge`): cao 26, chữ `fine` 600, nền tint không viền. **Ngữ pháp chấm**: đặc = trạng thái · vòng
  rỗng = chờ người kế tiếp · quầng = đang chạy · quay = đang tính. Màu kể giai đoạn của chuyến: xám nháp, hổ phách cần bạn (đã tối ưu vòng
  rỗng, cần xem lại có quầng + viền), cyan đã duyệt, **xanh lam** đang chạy (đang tối ưu, đang xếp, đã xếp xong vòng rỗng, đang giao), xanh lá
  hoàn thành, đã huỷ chip đỏ trọn (không gạch chữ). Xe: sẵn sàng xanh lá, đang phục vụ chuyến xanh lam có quầng, bảo dưỡng xám. Tài khoản: đang
  hoạt động xanh lá, đã khoá xám. `shape="tag"` (20 px) cho phiên bản, "Đã chỉnh tay" (xanh lam) và **MOCK RESULT** (`tone="mock"`).
  *(đã điều chỉnh 26/09/2026)* Bản mẫu V2.3 dùng **tím** cho "đang chạy" và tint "phân tích phụ"; người dùng thấy tím không hợp nên đổi
  sang thang **xanh lam** `--azure-*` (khác hẳn cyan thương hiệu, cùng họ màu lạnh). `@theme` xoá thang `violet`/`purple` của Tailwind:
  không dùng tím ở đâu trong app. "Đã huỷ" cũng lệch bản mẫu: chip đỏ trọn thay vì chip xám gạch chữ.
  *(đã điều chỉnh 02/10/2026, FE-0-05, D-81)* Chuyến có **6 trạng thái của backend** (`DRAFT`, `PLANNED`, `LOADING`, `IN_TRANSIT`,
  `DELIVERED`, `CANCELLED`): nháp xám đặc · đã lập kế hoạch cyan đặc · đang xếp hàng và đang vận chuyển xanh lam có quầng · đã giao
  xanh lá đặc · đã huỷ đỏ đặc. "Đang tối ưu" là tiến trình job (hộp thoại tối ưu), không phải trạng thái. Phương án và tiến độ kho là
  **dòng phụ** `TripSubStatusTag` cạnh/dưới chip (`shape="tag"`) — màu "cần bạn" (hổ phách) nằm ở dòng phụ: dưới Đã lập kế hoạch là
  "Chờ duyệt" hổ phách chấm vòng rỗng, "Đã duyệt" cyan, "Lỗi thời — cần tối ưu lại" hổ phách có viền; dưới Đang xếp hàng là "Đang xếp
  110 / 280" và "Xếp xong — chờ xuất phát" xanh lam — *(đã điều chỉnh 03/10/2026, FE-6-02)* trước đó là "Đang soạn x / y" xanh lam, và
  "Thiếu kiện — chờ điều phối" hổ phách có viền khi kho còn báo thiếu chờ quyết. *(bổ sung 03/10/2026, FE-4b-09)* Tuyến đã tối ưu có điểm tới nơi sau hạn thì
  thêm một dòng phụ thứ hai "Có điểm trễ hạn dự kiến" hổ phách có viền, **đứng cạnh** dòng phụ của phương án (danh sách chuyến, đầu Chi
  tiết chuyến — `tripRouteSubStatus`), không thay nó. *(bổ sung 03/10/2026, FE-6-04)* Chuyến đang xếp hoặc đang giao còn xác nhận tay
  chờ duyệt có dòng phụ thứ hai "Chờ duyệt xác nhận tay (n)" hổ phách chấm vòng rỗng (`tripManualSubStatus`), cùng chỗ đó. Màn cảm ứng (kho, tài xế) phóng nhãn phụ lên 16 px cùng chip. Bản LM-104
  (27/09/2026) dùng nháp · đã tối ưu · đã duyệt · đang vận chuyển · hoàn thành · đã huỷ, dòng phụ chỉ có lỗi thời và tiến độ kho.
- **Card**: `Card`/`CardHeader`/`CardTitle` (Archivo 650 16/22)/`CardMeta`/`CardActions`; bo 14, `--card-shadow`.
- **Ô nhập** (`components/ui/field-styles.tsx`, dùng chung cho Input, Textarea, Select, SelectField): nhãn `small` 600 `--ink-2`, viền
  `--line-strong`, focus viền `--cyan-500` + quầng `--focus-ring` (thay vòng outline), lỗi viền đỏ + `--error-ring` + icon.
  *(bổ sung 27/09/2026, LM-103)* Dấu `*` bắt buộc là `aria-hidden`, ô có `aria-required`: tên truy cập giữ đúng chữ nhãn ("Tên xe", không
  "Tên xe *") — test đọc nhãn bằng `exact: true`.
- **Tab**: `TabsList tone="light"` gạch chân `--cyan-500` trên nền trắng; `TabCount` Archivo, `tone="warn"` nền hổ phách; số của
  `TabCount` viết theo ngôn ngữ đang chọn ("2.714" · "2,714").
  *(đã điều chỉnh 27/09/2026)* `tone="sky"` là **nhóm tab kính** trong dải trời: khay `--sky-glass` viền bo 12, tab 36 px bo 10, tab mở là
  kính cyan của thanh điều hướng (`--nav-on`); khay căn trái theo tiêu đề và cách card đè dải 16 px, số 0 mờ đi. Bản mẫu V2.3 vẽ tab gạch
  chân trên dải — vạch nằm sát mép card nên nhìn như đường kẻ thừa; người dùng yêu cầu làm lại.
- **Hộp thoại**: bo 18, lớp phủ `--scrim`; `DialogHeader` có ô icon 40 px theo nghĩa; chân nền `--n-25`, nút dồn phải.
- **Toast**: bo 14, ô icon 30 px tô theo nghĩa; đặt dưới nút hành động của dải trời (`offset` 152).
- **Banner** (`components/Banner.tsx`): info / warning / danger / neutral, hành động dồn phải. `TripLockBanner` dựng trên nó.
- **Trạng thái rỗng**: không khung nét đứt; ô minh hoạ 64 px bo 18 theo nghĩa (`icon` + `tone`), tiêu đề Archivo 700. Màn không có dữ liệu
  dùng Lumo (`mascot`, LM-105) thay ô icon; `compact` 96 px trong card; `wide` cho mô tả tới 520 px trong card rộng (LM-106).
- **Menu, Select, tooltip**: menu trắng đặc bo 14 padding 6, mục 36 px, `tone="danger"`; tooltip nền `--cyan-950`.

### Thanh tiêu đề màn *(bổ sung)*

*(bổ sung 19/09/2026, LM-094)* Planner từ 1.366 px: thanh trên 56 px là hàng điều khiển duy nhất (mã chuyến, MOCK RESULT, chỉ số,
Xếp/Dỡ, điểm giao, góc nhìn, trạng thái duyệt, Chỉnh sửa, So sánh, Duyệt); hẹp hơn thì điều khiển mô phỏng và Chỉnh sửa xuống thanh
công cụ riêng (tablet hai hàng 56 px). Thêm gì vào hàng này phải đo lại ở 1.366 px (`e2e/planner-compact.spec.ts`). Thanh công cụ
Planner dùng `PlannerSelect` (Select Radix); ô chọn kiện (tới 1.000 dòng) giữ `<select>` gốc.
*(đã điều chỉnh 28/09/2026, V2.3, LM-107)* Trang Planner nền tối `--canvas-1`; thanh trên là kính tối (`.glass-dark`) nổi cách mép 14 px
từ 1.280 px, vẫn cao 56 px. Tiêu đề là tên tuyến **chỉ từ 1.680 px**; hẹp hơn là mã chuyến và dòng dưới chỉ còn mã revision — không cắt chữ
bằng dấu ba chấm (`layout-1366`). *(bổ sung 02/10/2026, FE-0-07)* Nhãn "Duyệt bởi <tên> lúc" mang họ tên người duyệt: rộng tới 208 px
(điện thoại 160 px; tên dài hơn cắt bằng dấu ba chấm, tên đầy đủ ở `title`), và *(đã điều chỉnh 03/10/2026)* từ 1.536 tới dưới
1.760 px — nơi nút So sánh phương án có chữ theo yêu cầu người dùng (chỉ icon dưới 1.536 px) — nhãn chỉ hiện "Đã duyệt lúc", tên người
duyệt ở `title`; không làm vậy thì nhãn "Đã chỉnh tay" (1.536 px) và tên tuyến (1.680 px) đè lên chỉ số. `planner-compact` đo
thêm bản đã duyệt ở 1.680 px và bản đã duyệt có chỉnh tay ở 1.536 px. *(bổ sung 03/10/2026, FE-5b-06)* Revision là phương án ứng viên
(hoặc bản duyệt dựng từ nó) của một lần chạy nhiều phương án thì khối tiêu đề có nhãn **một chữ cái** A · B · C cạnh MOCK RESULT (tên đầy
đủ "Phương án C" ở `title` và cho trình đọc màn hình — nhãn có chữ không vừa 1.366 px), và nút So sánh mở
`/chuyen/:id/so-sanh?lan-chay=<mã lần chạy>`; revision khác vẫn mở ma trận mọi revision (`fetchPlanApproval` trả `candidate`). Bản đã
chỉnh tay không kèm chữ cái — nhãn "Đã chỉnh tay" nói thay, hai nhãn cùng lúc không vừa 1.536 px — nhưng nút So sánh vẫn mở lần chạy đó.
*(bổ sung 03/10/2026, FE-5b-08)* Vì thế nút "Đổi xe" **không**
nằm trên hàng này mà ở góc dưới phải khung 3D (mục 7 "Operations"). Thanh thông báo (lỗi thời, khoá theo pha, bản chưa duyệt, chỉ xem) nằm trong
luồng trang giữa thanh trên và khung 3D (`PlannerNotices`), không nổi đè lên cảnh. Panel trong khung 3D dùng kính tối; bề mặt đọc lâu
(hộp Chi tiết / Hiển thị, thẻ kiện đang chọn) nền tối đặc. Nhãn neo trên kiện là thẻ tối hai dòng (vai trò · điểm giao / mã kiện) dựng
bằng DOM/SVG, nền đặc 85 % thay `backdrop-filter` vì chúng di chuyển mỗi khung hình. Nút nhấn giữ (Xếp/Dỡ, Theo bước) là nền cyan mờ +
viền trong, không gradient. Số đo và mã giữ JetBrains Mono; đơn vị có khoảng trắng thật sau số ("120 × 100 × 100 cm", "200,0 kg").

*(đã điều chỉnh 26/09/2026, V2.3)* Thanh tiêu đề của màn trong khung ứng dụng nằm trên **dải trời** nên cao theo nội dung (tiêu
đề 32 px + mô tả, thêm tab nếu màn có), không còn cố định 72 px. Chỉ **56px** cho màn xem phương án 3D, vì ở đó chiều cao nhường cho
khung 3D. Header riêng còn nền trắng (form xe) giữ 72 px tới đợt của màn đó.

*(đã điều chỉnh 26/09/2026, V2.3)* Màn trong khung ứng dụng dùng `components/PageHero.tsx` trên dải trời (`.sky`): tiêu đề h1
**Archivo 700 32 px rộng 112 %** chữ trắng, `meta` (số đếm, mã) mono `--sky-text-3`, một câu mô tả từ nhánh `pageHero` của từ điển,
hành động ở phải, tab của màn (`TabsList tone="sky"`) truyền làm `children`. Ô icon `.hero-icon` của V2 đã bỏ. Luật của nó:
`<h1>` chỉ chứa chữ tiêu đề (test đọc `exact: true`); hành động nằm trong **cùng** `<header>` với tiêu đề; mô tả ẩn dưới 768 px. Mô
tả nói màn dùng để làm gì — không số, không trạng thái. *(đã điều chỉnh 27/09/2026, LM-103)* Ngoại lệ: dòng dưới tiêu đề được là
**dòng số đếm lấy từ kho** (danh sách chuyến: "15 chuyến · 3 đang chạy · 2 cần bạn xử lý") hoặc **dòng dữ liệu của đối tượng** (chi tiết
chuyến: ngày chạy · xe · tài xế) — không bao giờ là số nghĩ ra. **Dải trời nối liền**: thanh điều hướng và `PageHero` là hai phần tử cùng lớp
`.sky` gắn ảnh vào khung nhìn (`background-attachment: fixed`), không phải một khối bọc. **Card đè lên dải**: `overlap` kéo dải
thêm `--sky-overlap` (44 px) và vùng cuộn đặt `sky-overlap` (`margin-top: -44px`, lề trên 0). Chỉ bật khi thứ đầu tiên của vùng cuộn
là card nền đặc — chữ trần trên dải trời không đọc được (Bảng điều khiển có dòng chọn kỳ, Hồ sơ có cột thông tin: chưa bật). *(đã điều chỉnh 27/09/2026, LM-103)* V2.3 cho tiêu đề là dữ liệu:
Chi tiết chuyến dùng `PageHero` với tên tuyến, `crumbs` ("Chuyến hàng / TRIP-…"), `badge` (chip trạng thái, nằm ngoài `<h1>`) và
`children` là bước tiến trình + banner theo pha. Thanh 56 px của Planner vẫn là header riêng theo lề `px-shell`. Màn mới trong khung ứng dụng dùng `PageHero`.
Bản V2 gốc có hoạ tiết đường nét phía sau tiêu đề — người dùng chọn **không** đưa vào production (23/09/2026).

*(bổ sung 23/09/2026, V2)* Lề ngang của thanh điều hướng, thanh tiêu đề và vùng cuộn dùng utility `px-shell` (`index.css`): 24 px,
và khi cột rộng hơn `--shell-max` thì nội dung dừng ở `--shell-max`, căn giữa. Là padding chứ không phải một div `max-w` bọc ngoài,
để vùng cuộn vẫn rộng hết cột (thanh cuộn ở mép) và nền chrome vẫn tràn ngang — trên màn 2K logo, mục điều hướng, tiêu đề và nội
dung cùng thẳng một cột. Không đặt lại `px-6`/`px-8` cho màn trong khung ứng dụng.

*(đã điều chỉnh 26/09/2026, V2.3)* Ô số liệu là `components/KpiTile.tsx`: **card nền đặc** (bo `--r-lg`, viền, `--card-shadow`) —
kính sáng `.glass-tile` của V2 đã bỏ; `variant="sky"` là ô kính tối chỉ đặt trên dải trời. Icon trên nền tint theo nghĩa cố định
(mục 4); số 26 px **Archivo 700** `tabular-nums` `--ink-strong` (không mono — mono dành cho mã); nhãn `--ink-2`; ghi chú nguồn cỡ
`note` `--ink-3`. Mọi số cùng màu mực — màu chỉ ở icon, không nói số tốt hay xấu. Vỏ ngoài
`role="group"` + `aria-label` = nhãn; `value` và `unit` là hai text node liền nhau, không khoảng trắng JSX ở giữa.
*(bổ sung 23/09/2026, bước 5)* Ô số liệu làm **công tắc lọc** (Đội xe): truyền `onPress` + `pressed`; ô dựng `<button aria-pressed>`
**bên trong** vỏ group, không biến vỏ thành nút. Bấm đi qua `list.setFilter` của `useListUrlState` (URL đổi, cùng bộ lọc với ô
chọn), bấm lại ô đang lọc thì bỏ lọc. Rê chuột đổi viền sang `--cyan-300`, không phóng to, không nâng bóng; đang lọc: viền
`--primary` đậm gấp đôi. Số của ô đếm trên cả tập dữ liệu, không theo ô tìm.

### Thương hiệu *(bổ sung 27/09/2026, LM-105)*

Nguồn: `design/brand/` (`source/` là file người dùng giao; `logo-mark*.svg`, `logo-horizontal*.png` là bản xuất). Kế hoạch và quyết định:
[LM-105](docs/issues/LM-105-thuong-hieu.md).

- **Logo** là biểu tượng khối (nắp · chữ L · chữ n) dựng lại bằng SVG: `components/brand/LogoMark.tsx` (`tone` `color` nền sáng · `dark`
  nền tối, chữ n trắng · `mono` `currentColor` cho giấy in) và `components/brand/Logo.tsx` (biểu tượng + chữ "LoadMaster" Archivo 700 +
  khẩu hiệu tuỳ chọn, `role="img"`, trong liên kết đã có nhãn thì `decorative`). Ba màu `--logo-sky`, `--logo-blue`, `--logo-navy`
  **chỉ dùng trong logo** — giao diện vẫn cyan; người dùng chọn giữ màu xanh gốc thay vì đổi logo sang cyan.
- Khẩu hiệu "Plan smarter. Load further." (`BRAND_TAGLINE`) và tên linh vật **Lumo** là tên riêng: tiếng Anh ở mọi ngôn ngữ, không vào
  từ điển. Khẩu hiệu viết như câu, không viết hoa giãn chữ như bản gốc (luật "Cấm tuyệt đối").
- Chỗ đặt: thanh điều hướng, màn đăng nhập (logo ngang + khẩu hiệu), màn lỗi / 404 / 403, trang tài liệu (`BrandCard` ở `/thanh-phan`),
  `favicon.svg` (chữ n đổi trắng khi tab tối), `apple-touch-icon.png`, `icon-192/512.png`, `manifest.webmanifest`, README; bản
  `mono` ở góc **nhãn QR** (in đen trắng dán lên kiện) và đầu **báo cáo chuyến bản in**; thanh màn chính của kho (`/kho`). **Không** đặt
  logo ở thanh của tài xế (điện thoại 360–390 px: tiêu đề gãy ba dòng) và ở thanh phiên xếp / điểm giao (một thao tác mỗi màn).
- Nhỏ nhất 16 px; chừa trống quanh logo ít nhất một phần tư chiều cao biểu tượng. Không đổ bóng, không đặt logo trong ô màu (ô gradient
  `--brand-mark` của V2.3 đã bỏ).
- **Lumo** (`components/brand/Lumo.tsx`, `pose`; ảnh WebP 320 px khoảng 20 KB mỗi tư thế ở `src/assets/brand/lumo/`, tải theo màn):
  mỗi tư thế **một nghĩa cố định** — `greet` chào (đăng nhập) · `empty` chưa có dữ liệu (danh sách rỗng) · `notFound` không tìm thấy (404)
  · `error` có sự cố (lỗi tải, 403, lỗi render, chuyến đã huỷ ở kho / tài xế) · `done` xong việc lớn (kho xếp xong, tài xế giao xong)
  · `warehouseWaiting` kho chờ hàng · `driverWaiting` tài xế chờ chuyến. Trạng thái rỗng dùng `EmptyState mascot`
  (`compact` 96 px trong card); `ErrorScreen` bắt buộc `mascot`; `WarehouseEmpty` / `DriverNotice` mặc định tư thế chờ. Luôn `alt=""` +
  `aria-hidden`, không động. **Không** ở bảng, form, Planner, bảng điều khiển (kể cả kỳ không có dữ liệu), toast, hộp thoại; ở màn kho và
  tài xế chỉ màn rỗng, màn lỗi và màn xong việc.

### Thử nghiệm visual V2 (21/09/2026)

*(đã điều chỉnh 25/09/2026)* V2.3 "Cyan kính" (`design/v2.3/`) **thay** phần hình ảnh của V2 dưới đây: kính sáng, `PageHero` nền
sáng, `--field` và năm cặp tint xanh dương chuyển sang dải trời tối, kính tối và bảng cyan. Cấu trúc V2 (thang mực bốn cấp, nghĩa
cố định của tint, `px-shell`, `KpiTile`, cuộn trong khung) giữ nguyên.

Vòng ý tưởng 02: người dùng cho phép **thay đổi mạnh** trong prototype, thử nền sáng xanh chuyển nhẹ, gradient, kính lồi, phản sáng, bóng và thang bo góc ngoài luật V1. Chỉ áp dụng `design/v2`, chưa là chuẩn production; duy trì khả năng đọc, focus và reduced-motion. Xem brief V2 để biết đánh đổi và các mục chưa kiểm trên thiết bị thật.

*(đã điều chỉnh 23/09/2026)* Hướng V2 **đã được duyệt** và đang chuyển dần vào `src/`: kính theo lớp (xem "Cấm tuyệt đối" bên dưới),
thanh điều hướng ngang, thang mực bốn cấp và năm cặp tint ngữ nghĩa. Bản phác thảo gốc giữ ở `design/v2/` để đối chiếu; chuỗi chữ và
token cục bộ trong đó **không** phải chuẩn — code production đi qua `t()` và token của `src/index.css`. Quyết định và phạm vi:
[docs/v2-design-brief.md](docs/v2-design-brief.md).

**Chưa đo trên thiết bị thật:** blur ở màn kho (tablet trong kho sáng, đeo găng) và tài xế (điện thoại ngoài nắng) chưa có số về tương
phản và FPS. Đây đúng hai vai trò cần tương phản nhất. Phải đo trước khi coi kính ở hai màn đó là đã chốt.

### Cấm tuyệt đối

- Không dùng chữ gạch chân làm nút hành động. Gạch chân chỉ cho link trong đoạn văn.
- Không gradient trên nút, card hay thanh tiêu đề. *(đã điều chỉnh 25/09/2026, V2.3)* Ngoại lệ, đều khai trong token: nền **nút
  chính** (`--primary-fill-*`), **dải trời** `--sky` đầu màn (thanh điều hướng + tiêu đề + tab) và thanh tiến độ/thước đo. Card,
  bảng, form, hộp thoại vẫn nền đặc. *(đã điều chỉnh 23/09/2026)* **Nền trang** được dùng trường màu rất nhạt
  (`--field`): hai vệt radial xanh trên nền `#edf4fb`, biên độ dưới 5% độ sáng. Đây là lớp khí quyển để bề mặt đọc màu trắng
  nổi lên khỏi nó. Ngoài nền trang, gradient chỉ có trong **vật liệu kính** (chỉ báo điều hướng, ô số liệu) và ô icon nhận diện
  màn (`.hero-icon`) — đều là gradient trắng/xanh rất nhạt khai trong token, không phải màu trang trí. V2.3: nền trang là `--app` phẳng, bỏ `--field` và `.hero-icon`.
- *(đã điều chỉnh 23/09/2026)* Kính (blur nền, viền sáng) dùng **theo lớp**, không rải tuỳ ý.
  **Được** ở chrome điều hướng, khối tổng hợp số liệu, và panel điều khiển nổi đè lên khung 3D nền tối.
  *(đã điều chỉnh 25/09/2026, V2.3)* Kính là kính **tối**: `.glass-nav` trên dải trời và `.glass-dark` trên khung 3D. Ô số liệu
  chuyển sang card nền đặc. Màn kho và tài xế vẫn phải đo tương phản ngoài thực tế trước khi chốt kính.
  **Không** ở bảng, form, inspector và mọi bề mặt người dùng đọc lâu — những chỗ đó giữ nền đặc, phân tách bằng viền 1px.
  Không lồng kính trong kính. Luôn có nền đặc dự phòng khi trình duyệt thiếu `backdrop-filter`, và tôn trọng
  `prefers-reduced-transparency`. Trước 23/09/2026 luật này cấm kính hoàn toàn; đổi sau khi duyệt hướng V2. Viền phát sáng
  vẫn không dùng ngoài ba chỗ kể trên.
- Toast nằm dưới thanh tiêu đề (`offset` trên 80 px): không che nút hành động ở góc phải header — rê chuột lên toast làm nó dừng đếm giờ
  (LM-101 phát hiện toast che nút Duyệt của Planner).
- Không đổ bóng lên card. *(đã điều chỉnh 25/09/2026, V2.3)* Trừ `--card-shadow` rất nhẹ (bo `--r-lg` 14 px) như `design/v2.3`;
  không thêm bóng nào khác, không nâng card khi rê chuột. Card phân tách bằng viền 1px `--border`. Bóng chỉ dùng cho dropdown, modal, toast, popover, và **thẻ đang được kéo** (lúc đó nó là lớp đang nhấc khỏi mặt phẳng).
  *(đã điều chỉnh 23/09/2026)* Bề mặt **kính** không phải card phẳng: được viền sáng trong và bóng nâng rất nhẹ bằng token
  (`--nav-glass-shadow`, `--glass-edge`, `--tile-lift`, `--hero-icon-shadow`). Card nền đặc: chỉ `--card-shadow` (V2.3).
- Không emoji trong giao diện. Icon dùng Lucide, nét 1,5px, cỡ 16/20/24.
- Không viết hoa toàn bộ, không giãn chữ trang trí.
- Không bo góc tròn hoàn toàn cho nút hành động. Dạng viên thuốc chỉ cho badge, chip lọc và thanh tiến độ.
- Chỉ dùng ba độ đậm chữ: 400, 500, 600. *(đã điều chỉnh 25/09/2026, V2.3)* Riêng Archivo (`--font-display`) được 650 và 700 cho
  tiêu đề và số lớn.
- Không dùng màu ngoài bảng token. Tám màu điểm giao **chỉ** để định danh điểm giao, không dùng trang trí.
- Không kẻ sọc xen kẽ cho bảng. Dùng đường phân cách 1px.
- Không dữ liệu giả kiểu Lorem hay "Sample Item 1". Dùng dữ liệu tiếng Việt thật khi làm mẫu.

### Bố cục: màn có dữ liệu và màn không có dữ liệu *(đã điều chỉnh)*

Luật ban đầu cấm mọi "bố cục kiểu trang giới thiệu". Thực tế có một nhóm màn **không
hề có dữ liệu nghiệp vụ** để bày: đăng nhập, 404, trạng thái rỗng. Ép chúng căn trái
bám mép trên thì nội dung trôi lạc giữa vùng trống, nhìn như trang lỗi.

- **Màn vận hành** (có dữ liệu): nội dung căn trái, bám mép trên, không tiêu đề khổng lồ căn giữa, không hình minh hoạ lớn. Đây là mặc định.
- **Màn không có dữ liệu**: được phép bố cục hai cột, căn giữa theo chiều dọc, và có hình minh hoạ. Hình minh hoạ phải dựng từ chính sản phẩm (phép chiếu đẳng cự ở `lib/isometric.ts`, bảng màu điểm giao), không mượn ảnh trang trí bên ngoài.
  *(đã điều chỉnh 27/09/2026, LM-105)* Linh vật cáo **Lumo** là tài sản thương hiệu của sản phẩm, được dùng ở màn không có dữ liệu theo bảng
  tư thế ở mục "Thương hiệu"; ngoài Lumo vẫn không mượn ảnh trang trí.

**Cuộn trong khung ứng dụng** *(bổ sung 23/09/2026)*: trang không bao giờ cuộn; mỗi màn tự cuộn vùng nội dung của nó. `AppShell` đặt màn
trong một **hàng** flex `relative min-h-0` dưới thanh điều hướng. Gốc màn `flex min-w-0 flex-1 flex-col`, vùng cuộn
`min-h-0 flex-1 overflow-auto`. Ba lỗi đã gặp, cả ba chỉ lộ khi lăn chuột thật:
- Đặt màn thẳng vào cột flex (bước 2 của V2): gốc màn cao theo nội dung (`min-height: auto`), `overflow-hidden` của khung cắt phần dưới.
- Con `overflow-hidden` trực tiếp của cột flex (khung bo góc quanh bảng) được **co về 0** — phải `flex-none`, không thì bảng bị
  cắt còn chiều cao khung và vùng cuộn không có gì để cuộn (nhật ký 50 dòng chỉ thấy 10).
- Phần tử `absolute` không có tổ tiên định vị (`sr-only` của biểu đồ, ô ẩn của Radix) kéo cả tài liệu dài ra, trang cuộn và đẩy thanh
  điều hướng khỏi màn — hàng chứa màn phải `relative`.

### Phân cấp thị giác

Mỗi màn hình chỉ có **đúng một** hành động chính dùng nút primary. Mọi hành động khác dùng nút phụ hoặc ghost.

Không phải thứ gì cũng cần card. Nhóm nội dung bằng khoảng trắng trước, viền sau, nền surface cuối cùng.

### Bảng dữ liệu

*(bổ sung 20/09/2026, LM-101)* Bảng có trạng thái theo dòng — menu thao tác, hộp thoại mở từ dòng — **phải** truyền
`getRowId` cho `DataTable`. Mặc định của TanStack là khoá theo **vị trí**: lọc hay sắp xếp trong lúc menu đang mở thì dòng bị gỡ
(menu biến mất) hoặc menu nhảy sang người khác và thao tác chạy nhầm đối tượng. Chỉ truyền khi mã chắc chắn duy nhất — kiện có thể
trùng mã khi dữ liệu còn lỗi, bảng kiện giữ khoá theo vị trí.

*(bổ sung 23/09/2026, V2 bước 6)* TanStack Table v9 dựng mỗi hàm `cell`/`header` thành **một component** (`createElement(columnDef.cell)`):
dựng lại mảng cột là mọi ô gỡ ra gắn lại — menu Radix đang mở trong ô bị rời khỏi DOM giữa cú bấm. Màn Người dùng từng gặp: cột
memo theo `users`, truy vấn `staleTime: 0` về lại sau đăng nhập, menu "Khoá tài khoản" biến mất (E2E đỏ 1/4 lần). Bảng có trạng thái
trong ô (menu, hộp thoại, ô nhập): khai hàm ô **một lần ở cấp module**, giá trị thay đổi (dữ liệu, người đang chọn, callback) đưa
qua context hoặc `meta` của bảng; chỉ dựng lại cột khi đổi ngôn ngữ hay đổi tập cột (`features/admin/users-table-context.ts`).

*(bổ sung 23/09/2026, V2)* Ảnh đại diện chữ cái đầu trong nội dung (bảng người dùng, nhật ký, hồ sơ, panel) là **ô vuông bo góc**
theo V2; hình tròn chỉ ở nút tài khoản trên thanh điều hướng và menu tài khoản.

Chiều cao dòng cố định (48px thoáng, 36px gọn, 56px cảm ứng). Cột số căn phải, JetBrains Mono. Tiêu đề cột 12px weight 500 màu `--text-3`, không viết hoa, dính khi cuộn. Bảng hẹp (cột phụ ≤ 360px) dùng padding ngang 10px thay vì 12px để tiêu đề không xuống dòng.

*(bổ sung 23/09/2026, V2 bước 5–6)* Kiểu bảng V2 cho màn danh sách: bảng và thanh tìm/lọc nằm **chung một thẻ**
(`rounded-lg`, viền 1px, nền trắng, `relative flex-none`); `FilterBar layout="toolbar"` là đầu thẻ — ô tìm giãn bên trái, bộ lọc
có nhãn nằm cạnh dồn phải; bộ lọc phụ khai `secondary: true` xuống hàng thứ hai (ngày, xe, tài xế của danh sách chuyến).
`DataTable appearance="paper"` — tiêu đề cột nền `--table-head`, 12px weight **600** `--ink-2`, cao 40px, lề ngang 14px.
Ô hai dòng thì tăng mật độ thay vì cắt chữ: `roomy` 56px cho hai dòng chữ (tên + tuyến, số kiện + số điểm), `spacious` 72px khi
kèm icon/badge (tên + mã có icon xe; trạng thái + mã chuyến / ghi chú tối đa hai dòng). Lớp kiểu dáng ở `components/data-table-styles.ts`.

*(bổ sung 19/09/2026, LM-085, D-52)* Danh sách có tìm/lọc/sắp xếp/phân trang ghép `FilterBar` + `@/lib/list-filter` (tìm bỏ dấu:
"bien hoa" khớp "Biên Hoà") + `DataTable` + `useListUrlState`. Cột chỉ sắp xếp được khi khai `enableSorting: true`; tiêu đề là nút có
`aria-sort`. Phân trang 25/50/100 qua prop `pagination`. Bảng rỗng vì lọc truyền `isFiltering` để nói "không có kết quả khớp", khác
"chưa có dữ liệu". Tham số URL tiếng Việt không dấu: `q`, `sap-xep`, `trang`, `so-dong` + tên bộ lọc của màn. Ô nhập nối vào URL giữ
bản nháp tại chỗ (router đổi URL trong `startTransition`) — dùng `FilterBar`, không nối thẳng `value` vào `useSearchParams`. Setter của
`useListUrlState` dựng URL từ bản nháp mới nhất (hai lần lọc liên tiếp không ghi đè nhau); cỡ trang mặc định khác 25 thì truyền
`defaultPageSize`, màn không tự giữ `so-dong`.

*(LM-095)* Ô chữ dài (tên kiện, điểm giao, xe) xuống tối đa hai dòng (`line-clamp-2`) trong hàng 48 px thay vì cắt bằng dấu ba chấm; cột chữ
quan trọng nhận bề rộng theo tỷ lệ (%) thay vì px cố định; bảng có thể hẹp hơn tổng cột cố định thì đặt `min-w` cho bảng trong khung
cuộn. Khung `overflow-x-auto` chứa Select/Switch/Checkbox Radix phải `relative` — ô ẩn định vị tuyệt đối của Radix thoát khung cuộn và
làm cả trang cuộn ngang.

## 6. Ngôn ngữ giao diện

### Đơn vị nghiệp vụ *(đã điều chỉnh 15/09/2026)*

Luật ban đầu dùng **mm** cho kích thước và toạ độ. Spec bắt buộc **cm/kg** và cấm trộn đơn vị
trong state và payload (D-03), nên đích là:

| Đại lượng | Đơn vị | Làm tròn khi vào domain |
|---|---|---|
| Dài, rộng, cao, toạ độ, clearance | cm | `roundCm` — bội 0,1 cm |
| Khối lượng, tải trọng, tải tối đa | kg | `roundKg` — bội 0,01 kg |
| Thể tích | cm³ (hiển thị thêm m³ cho dễ đọc) | — |

- Chỉ `viewer3d/scene/units.ts` được đổi scale sang đơn vị Three.js.
- `roundCm`/`roundKg` áp **tại biên**: khi lưu dữ liệu form, khi nhận placement từ service, khi
  editor commit. Không làm tròn giữa các phép tính trung gian.
- So sánh số thực trong `src/domain` qua `eq/lt/gt` có `EPSILON = 1e-6` của `@/domain/geometry`,
  **không** dùng `<` `>` `===` trực tiếp giữa toạ độ hoặc kích thước. Oxlint không có rule tự
  động cho việc này — reviewer phải chặn. Ví dụ đã gặp: `100.4 + 120.7 = 221.10000000000002`
  làm hai kiện chạm mặt bị báo chồng lấn giả.
- Mọi ví dụ số thực đưa vào test phải được chạy thử bằng máy trước; ba giả định viết tay trong
  issue gốc đã sai (`45.1 + 45.1 + 45.1` thực ra bằng đúng `135.3`).
- **Trạng thái chuyển đổi:** `src/domain`, engine 3D và editor đã dùng cm (LM-031). Màn kho (LM-060) và tài xế (LM-061)
  đọc revision đã duyệt bằng cm qua `adaptResult`. Mock `LoadPlan` mm, `types/load-plan` và `adaptLoadPlan` đã gỡ (LM-062); kiểu điều khiển viewer nằm ở `viewer3d/viewer-types.ts`. Code mới không được thêm giá trị mm; code cũ đổi theo đúng issue,
  không đổi rải rác.

### Định dạng số và ngày theo ngôn ngữ

Dùng `Intl`, không tự nối chuỗi hay thay dấu (`toFixed().replace('.', ',')` là sai).

```
                 vi-VN                      en-US
Khối lượng       8.240 kg                   8,240 kg
Phần trăm        87,4%                      87.4%
Thể tích         18,4 m³                    18.4 m³
Kích thước       720 × 235 × 240 cm         720 × 235 × 240 cm
Ngày             14/09/2026                 (theo LM-027)
Giờ              14:30                      (theo LM-027)
```

`format.dayMonth` ("14/09" · "Sep 14") cắt năm khỏi mẫu ngày đầy đủ — CLDR tiếng Việt cho mẫu ngày + tháng là "dd-MM" (LM-090, LM-094).

Đặt các hàm format trong `src/lib/format.ts` và dùng lại, không viết rải rác. Từ LM-027 hàm
format nhận locale đang chọn.

### i18n vi/en *(bổ sung, D-07, D-08)*

- Từ điển TypeScript tự viết trong `src/lib/i18n/`. *(LM-080)* Mỗi nhánh cấp 1 một file ở `vi/<nhánh>.ts` và `en/<nhánh>.ts`;
  `vi.ts`/`en.ts` chỉ ghép — màn mới thêm nhánh bằng file mới, không sửa nhánh của màn khác. `vi` là nguồn chuẩn; `en` khai báo sao cho
  **thiếu hoặc thừa key là lỗi TypeScript** lúc build.
- Ngôn ngữ đọc theo thứ tự `?lang` → `sessionStorage` → `vi`. Không dùng `localStorage`.
  Đổi ngôn ngữ không tải lại trang, không mất dữ liệu đang nhập.
- Chuỗi hiển thị viết qua `t()`, kể cả `aria-label`, `title`, `sr-only`. *(LM-070, LM-071)* Toàn `src/` đã qua từ điển;
  `src/lib/i18n/no-hardcoded-vietnamese.test.ts` chặn chữ có dấu tiếng Việt ngoài từ điển, `*.mock.ts`, seed kho, fixture và test.
  Lỗi bất biến cho lập trình viên (`throw new Error(...)`) được viết tiếng Việt. Ngoại lệ khác ghi vào `ALLOWED` kèm lý do.
  Module thuần (domain, snapping, mô tả vị trí) trả mã; component dịch.
- Không dịch: badge **MOCK RESULT**; tên riêng trong dữ liệu (tên kho, điểm giao, người).
- `src/domain` **không chứa câu chữ hiển thị**: validation và constraint trả **mã lỗi + tham số**
  (`{ code, severity, params }`, D-28); zod schema dùng mã làm message. UI dịch mã và format số
  theo locale. Test so mã, không so câu.
- *(LM-091)* Tham số sự kiện nhật ký là dữ liệu: số format theo locale, mã (tên trường, loại sự cố, vai trò) dịch qua `audit.log.*`; chữ
  người dùng nhập (lý do huỷ, ghi chú) giữ nguyên. Thêm tham số mới vào `ctx.log` của kho thì thêm nhãn `audit.log.params.<tên>`.
- Nhãn một mã nghiệp vụ dùng ở nhiều màn (loại sự cố giao: `common.deliveryIssueKinds`; mức hạn của điểm giao:
  `common.deadlineStatuses` — chi tiết chuyến và Planner, FE-5b-07) khai một lần, không chép vào nhánh của từng màn.
- Tiêu đề tab (LM-100): mỗi route trong `App.tsx` khai `handle: titled(...)` bằng chữ của nhánh `titles` (màn có mã thì kèm mã);
  `useRouteTitle` chạy trong `RouteOutlet` của mọi nhóm route — trang không tự đặt `document.title`; 404/lỗi router dùng `useDocumentTitle`.
  Thêm màn mới thì thêm tiêu đề.
- Câu số nhiều tiếng Việt: hai dạng `one`/`other` phải giống hệt nhau (tiếng Việt luôn dùng dạng `other`, LM-087).
- Câu cho mã ràng buộc nằm ở nhánh `issues` của từ điển, key trùng tên mã, và chỉ gọi qua
  `formatIssue(issue, t, format)` của `@/lib/i18n` (LM-028). Thêm mã vào `CONSTRAINT_CODES` mà
  chưa có câu thì `tsc -b` báo lỗi. Bản en giữ đúng từng chữ câu mẫu Spec mục 13 (`src/test/spec-13.ts`).

### Không để từ vựng kỹ thuật rò ra màn vận hành *(bổ sung)*

Màn vận hành viết bằng ngôn ngữ của người dùng, không phải của thuật toán hay của
backend. Ví dụ đã sửa: hộp thoại tối ưu từng ghi "Thế hệ 128" — đúng thuật ngữ giải
thuật di truyền nhưng vô nghĩa với điều phối viên, và sẽ **sai hẳn** nếu sau này đổi
thuật toán. *(LM-048)* Nay hộp thoại chỉ hiện số service báo thật: "Đã xét 80 / 132 kiện".

Tên trường dữ liệu trong code vẫn giữ đúng hợp đồng với backend (`generation`);
giao diện làm lớp dịch. Ngoại lệ: màn **So sánh phương án** được dùng từ vựng thuật
toán (tên phương pháp, random seed, LIFO) vì ở đó người đọc đang so sánh thuật toán. *(LM-051)* Màn này
chỉ hiện thiết lập và metrics có trong revision đã lưu; không đặt nhãn thuật toán nào chưa thật sự chạy.
*(đã điều chỉnh 03/10/2026, FE-5b-05, FE-5b-06, D-77)* Người dùng **không chọn mục tiêu hay thuật toán** nữa: một lần chạy ra ba phương án
ứng viên A · B · C theo ba mục tiêu (tối đa thể tích, cân bằng tải trục, ít dỡ-xếp lại — tên ở `runs.objectives`, là ngôn ngữ của điều
phối viên, dùng được ở màn vận hành). **Tên thuật toán đã chạy** chỉ hiện ở ba chỗ: dòng chỉ đọc trong "Thiết lập nâng cao" và bảng lần
chạy của Thiết lập tối ưu, và thẻ lần chạy của màn So sánh. Mock chạy dưới tên "EP + DBLF" của hạng Basic cho mọi công ty nên nhãn luôn
kèm chữ **"(mock)"** — `runs.algorithms.EP_DBLF` là "EP + DBLF (mock)"; hạng thuật toán theo gói nối ở FE-8-05. Màn So sánh theo lần chạy
(`/chuyen/:tripId/so-sanh?lan-chay=<mã lần chạy>`): thẻ đầu nói lần chạy (người chạy, thuật toán, seed, LIFO, trọng tâm thấp, giới hạn thời
gian) và **mức hạn các điểm giao một lần** — ba phương án cùng một tuyến; dưới đó ba thẻ cạnh nhau, mỗi thẻ: mục tiêu, MOCK RESULT, mã
revision, ảnh thu nhỏ SVG, thể tích, tải trọng, tải trục trước / sau so giới hạn, chênh mức tải hai trục (điểm phần trăm), trọng tâm hàng,
số kiện dỡ-xếp lại, kiện chưa xếp, thời gian chạy. **Giá trị tốt nhất đánh dấu trung tính**: in đậm kèm nhãn xám "Tốt nhất" (`Badge`
`shape="tag"` tông mặc định) — không tô xanh lá / đỏ cho tốt / xấu; chỉ số mà các phương án bằng nhau, hoặc có phương án không có số (xe
chưa khai trục), thì không đánh dấu; hoà thì đánh dấu mọi phương án hoà (`bestCandidates` ở `trips/candidate-comparison.ts`; thời gian chạy
và trọng tâm không có "tốt nhất"). Màn **không có nút primary**: mỗi thẻ một nút phụ "Mở trong Planner", duyệt ở Planner; thẻ của phương án
đã duyệt mang nhãn cyan "Đã duyệt" và liên kết tới bản đã duyệt. Không có `lan-chay` thì vẫn là ma trận revision của D-37 (một nút primary
mở bản đang chọn), cột của bản do lần chạy ba phương án tạo ra mang thêm nhãn "Phương án A / B / C". Ma trận cũ còn dùng dấu tích xanh lá
cho "tốt nhất" — chưa đổi.

### Nút chưa hoạt động *(đã điều chỉnh 15/09/2026, D-20)*

Luật ban đầu cho phép giữ nút chưa nối backend nếu gọi `notifyPendingFeature()` để báo đang
chờ gì. Spec cấm "nút giả" (mục 9.3: Import CSV chỉ hiện khi hoạt động), nên nay:

- **Không hiển thị** nút hay mục menu chưa có chức năng. Không để nút bấm vào mà im lặng,
  không dùng toast báo "đang chờ", không báo thành công giả.
- Ngoại lệ duy nhất: nơi Spec yêu cầu giữ vị trí cho tính năng sau hiển thị nhãn
  **"Sẽ có sau" / "Coming later"** dạng chữ, không bấm được. *(đã điều chỉnh 03/10/2026, FE-5b-03)* Tải trục — chỗ duy nhất từng dùng
  nhãn này — nay có số của mock (mục "Không bịa số"); hiện không màn nào còn nhãn "Sẽ có sau".
- Toast chỉ nói việc **thật sự đã xảy ra** trên màn: không hứa "sẽ đồng bộ", "điều phối viên sẽ thấy"
  khi không có nơi lưu. *(LM-053)* Đã gỡ nút Cài đặt ở thanh điều hướng, "Ghi nhận sai lệch" ở kho, thanh tab
  đáy của tài xế (ba tab không có màn); "Kiện này không có ở kho" giữ vì nó thật sự bỏ qua bước.
- `notifyPendingFeature` và `lib/pending-feature.ts` đã xoá (LM-053); "Nhập từ Excel" gỡ khi danh sách chuyến
  chuyển sang đọc kho. Danh sách và form tạo/sửa chuyến ghi thật vào kho, không báo thành công giả.

### Không bịa số *(bổ sung 16/09/2026, LM-052, D-20)*

Cùng lý do với nút giả: số bịa còn nguy hơn nút bịa vì người đọc tin ngay. Mọi con số, thanh
tiến độ và biểu đồ trên màn vận hành phải truy được về dữ liệu kho (`src/lib/mock-db`) hoặc về
kết quả tối ưu; không có nguồn thì **bỏ hẳn phần đó**, không giữ lại bản mẫu cho đẹp.

- *(đã điều chỉnh 19/09/2026, LM-090, D-48)* Biểu đồ được phép khi kho có chuỗi thật: bảng điều khiển có 3 biểu đồ (lấp đầy theo ngày,
  chuyến theo trạng thái, khối lượng đã giao theo xe) tính bằng hàm thuần `summarizeDashboard` từ chuyến, revision đã duyệt, tiến độ
  giao và trạng thái xe của kho. Ngày không có số để trống, không nối, không điền 0; kỳ không có dữ liệu hiện câu rỗng thay trục trống;
  tỷ lệ chưa tính được hiện "—" kèm lý do. Mỗi KPI một dòng nói nguồn; số lấy từ kết quả mock mang MOCK RESULT. Vẫn không có "so với
  kỳ trước", so sánh thuật toán, hay "kế hoạch vs thực tế" (LM-052 đã gỡ `FillRateChart`, `AlgorithmChart`, `PlanVsActualTable`).
- "So với kỳ trước" cũng là số bịa khi chưa có kỳ trước: `KpiTile` chỉ còn nhãn, số và một dòng
  ghi chú nói số đến từ đâu.
- Trang tài liệu `/thanh-phan` được dùng số mẫu để trình bày component, nhưng lấy từ dữ liệu seed
  thật (132 kiện của chuyến mẫu), không phải số nghĩ ra.
- *(đã điều chỉnh 03/10/2026, FE-5b-03, D-78)* **Tải trục** là số tính được, không còn "Sẽ có sau": mô hình đòn bẩy thuần
  `axleLoadsOf` (`domain/metrics/axle-load.ts`) trên dữ liệu trục **người dùng khai ở trang xe** (`axles[]`: vị trí, tải rỗng, tải tối
  đa) và trọng tâm hàng — mọi số truy được về đó, và luôn mang **MOCK RESULT** vì là ước lượng của mock. Xe không đủ dữ liệu trục
  (chưa khai, chỉ một trục, các trục trùng vị trí) thì **không có số nào**: ô Tải trục nói vì sao chưa tính, metrics của kết quả không
  có `frontAxleLoadKg` / `rearAxleLoadKg`, và không có kiểm `AXLE_OVERLOAD`. Trục minh hoạ mà khung gầm 3D vẽ khi xe không khai trục
  **không** được đưa vào phép tính. *(đã điều chỉnh 03/10/2026, FE-5b-05)* Xe mẫu của seed **khai hai trục** (trừ "Truck 6m" của Spec):
  vị trí, tải rỗng và tải tối đa của từng trục là **số ước lượng theo cỡ xe, chưa đối chiếu thông số nhà sản xuất** — chủ sản phẩm đã
  duyệt cách làm này để bản demo có tải trục; ghi rõ ở `seed-vehicles.ts` (`twoAxles`) và mục 9. Số tải trục trên màn vẫn truy được về
  các trục đó và vẫn mang MOCK RESULT; thay số thật ở trang xe là đủ, không sửa code.

## 7. Quy tắc riêng cho 3D

### Three.js

- Toàn bộ code Three.js nằm trong `src/features/viewer3d`. Không import `three` ở nơi khác. Màn khác cần 3D thì import component từ `viewer3d` (ví dụ `PositionViewer` cho màn kho).
- Kiện hàng render bằng **InstancedMesh** với `setColorAt`, không tạo mesh riêng từng kiện. Tối đa 3 InstancedMesh cargo: solid, ghost và vỏ viền. Tier low tắt viền chung nhưng giữ viền cảnh báo khi có blocker. *(bổ sung 03/10/2026, FE-5b-07)* Vỏ viền dùng chung cho ba việc: viền tối chung (tắt ở tier low), viền `--warning` của kiện chắn lối dỡ, và viền **trắng dày** (`ZONE_MARK_PADDING`) của kiện nằm ngoài vùng điểm giao — hai loại sau giữ ở mọi tier; không thêm mesh nào cho dấu ngoài vùng. Mapping `instanceId ↔ placementId` nằm trong `scene/instance-layout.ts`, không lấy index của danh sách UI để picking. Editor và animation dỡ mỗi loại dùng tối đa một proxy tạm; bánh xe dùng instancing riêng, không nhân theo cargo count.
- *(bổ sung, LM-033)* Vật cản `vehicle.obstacles` vẽ trong `scene/ObstacleInstances.tsx`: đúng 2 draw call dù 1 hay 20 vật cản (một InstancedMesh thân màu `--obstacle`/`--obstacle-bearing` theo `loadBearing` + một `LineSegments` gộp cạnh), 0 vật cản không vẽ gì, không đổ bóng. `RESERVED_ZONE` có vạch nhìn xuyên bằng thuộc tính instance + `discard` trong shader, không thêm vật liệu trong suốt. Bấm vật cản ở chế độ Xem mở `ObstacleCallout`; chế độ Chỉnh sửa tắt raycast vật cản. `SceneCanvas` kèm danh sách `sr-only` mô tả vật cản; chú giải vật cản nằm dưới chú giải điểm giao. Đo bằng `?debug&packages=N&obstacles=0|1|20` (`benchmark-obstacles.mock.ts`).
- Nền Canvas luôn tối, kể cả khi phần còn lại của app sáng.
- Target chức năng/performance là 1.000 placements với draw calls dưới 100, số mesh/nhãn không tăng tuyến tính theo cargo. Đã kiểm tra selection, editor, playback và các vai trò trên Chromium; mục tiêu thiết bị thật: desktop hướng tới 60 FPS, tablet 45–60 FPS, phone khoảng ≥30 FPS bằng quality adaptation. Số đo SwiftShader không phải cam kết FPS trên thiết bị thật. Thêm `?debug` để đo trước khi thêm hiệu ứng.
- Mọi hiệu ứng nâng cao (post-processing, shadow, AO) phải có cờ tắt được trong `usePerformanceFlags`. Ba tier `high / balanced / low` điều khiển DPR, bóng, viền chung, trang trí, bề mặt cargo và animation; viền kiện đang chọn luôn được giữ. Runtime bỏ qua idle, hạ tier sau 3 mẫu chậm (>28 ms), nâng sau 8 mẫu nhanh (<18 ms), cooldown 12 giây. Debug quality override khóa tier để đo lặp lại.
- Animation trong Canvas dùng `@react-spring/three`. Animation ngoài Canvas dùng `motion`.
- Panel điều khiển nổi trên Canvas là React thường đặt đè bằng CSS, không dùng `<Html>` của drei trừ khi cần neo theo vật thể 3D. Lớp phủ phải `pointer-events-none`, chỉ bật lại trên đúng nhóm nút, nếu không nó nuốt thao tác kéo xoay. *(bổ sung 03/10/2026, FE-5b-07)* Nội dung `<Html>` của drei chạy ở **một React root riêng, không có context của app**: gọi `useT` / `useFormat` (hay component dùng chúng, như `StopMark`) bên trong là lỗi "useT phải nằm trong `<I18nProvider>`" lúc chạy — test DOM không thấy vì jsdom không dựng Canvas. Tính chữ và số ở component ngoài rồi truyền vào (`RearDoorCue`, `ZoneStrips`). Vật liệu trong suốt `DoubleSide` của three vẽ **hai lượt** (hai draw call): mặt phẳng phủ sàn đặt `forceSinglePass`.
- Canvas phải có `touch-action: none` (đã đặt toàn cục trong `index.css`). Thiếu nó thì trên máy tính bảng kéo ngón tay sẽ cuộn trang thay vì xoay mô hình — lỗi chỉ lộ khi chạm tay, dùng chuột không thấy.
- Ba lưu ý về camera: `fitToBox` của camera-controls **xoay camera** về nhìn thẳng mặt gần nhất nên làm mất góc chéo — dùng phép chiếu các góc bao theo preset và tỉ lệ khung; bounding sphere theo chiều dài làm góc cửa sau trên phone quá nhỏ. Resize panel giữ góc người dùng đang xoay. Vách thùng dùng mặt đơn pháp tuyến hướng vào trong để vách gần camera tự biến mất. `PCFSoftShadowMap` đã bị gỡ khỏi three r186, dùng `shadows="percentage"`.

### Foundation engine *(bổ sung)*

- *(đã điều chỉnh, LM-030)* Planner đọc revision của chuyến qua `viewer-api.ts` → `usePlanSourceQuery` → `adaptResult → ViewerSceneModel` (cm, snapshot bất biến): revision đã duyệt mới nhất, hoặc `?revision=<jobId>`. `ScenePlacement` ghép `PackagePlacement` với kiện gốc (`packageId`, tên, điểm giao, `fragilityLevel`); `step = loadingOrder`. *(đã điều chỉnh 19/09/2026, LM-086)* `/kho` là danh sách chuyến đã duyệt chờ xếp / đang xếp — *(đã điều chỉnh 03/10/2026, FE-6-01)* chia **nhóm theo trạng thái và dòng phụ** (`WAREHOUSE_STAGES`): Đang xếp hàng (tiến độ) · Chờ soạn (Đã lập kế hoạch, bản duyệt còn hiệu lực) · Xếp xong — chờ xuất phát (còn ghi được số seal tới khi tài xế xuất phát) · Chờ điều phối tối ưu lại (bản duyệt lỗi thời, không có nút); nút chính của màn là chuyến đang xếp dở, không thì chuyến chờ soạn sớm nhất; `/kho?chuyen=<mã>` là phiên của chuyến ở kho theo bản duyệt chốt lúc `startLoading` — *(đã điều chỉnh 03/10/2026, FE-6-02, FE-6-05)* bước Soạn hàng rồi bước Xếp, tiến độ ghi vào kho qua các hàm đối chiếu (mục 9), mở lại tiếp tục ở kiện chưa ghi đầu tiên; bản duyệt lỗi thời **không** vào phiên (chờ điều phối duyệt lại). Scene cm đưa cho `PositionViewer`; kho không còn fixture benchmark; kiện hỏng bị bỏ lại kho (`leftOutIds`) vẽ như kiện đã gỡ (`unloadedIds` của
`deriveSceneSemantics`), như khung 3D tài xế. *(LM-087)* Tài xế: `/tai-xe` "Chuyến của tôi" (chỉ chuyến có `driverId` là mình; từ FE-0-01 chỉ tài xế có `driver.operate`, không vai trò nào khác mở màn này) — *(đã điều chỉnh 03/10/2026, FE-6-01)* nhóm theo trạng thái (`MY_TRIP_GROUPS`): Đang vận chuyển · Xếp xong — chờ xuất phát · Kho đang soạn / xếp (chỉ xem: nút phụ "Xem trước" mở màn điểm giao ở chế độ chỉ xem) · Đã giao gần đây (5 chuyến); chuyến còn Đã lập kế hoạch và chuyến đã huỷ không hiện; `/tai-xe/diem-giao?chuyen=` đọc qua `driver-api.ts` → `adaptResult`, phương án là bản kho đã xếp (chưa xếp thì bản duyệt mới nhất, chỉ xem); kiện hỏng bị bỏ lại kho không nằm trong danh sách dỡ và mô phỏng; xuất phát, đã đến, dỡ, sự cố, hoàn tất điểm ghi vào kho (FE-6-06). Kết hợp `ViewerDraft` theo ID để sinh effective placements; chỉ commit `{ position?, orientation?, pinned? }`, vị trí draft là cm. Header hiện **MOCK RESULT** khi `isMockResult`. Chế độ màu thứ hai là **theo kiện gốc** (`packageId`) vì contract không có đơn hàng; `packaging` của kết quả là một kiểu trung tính.
- Kích thước placement **đã áp orientation**. Xoay luôn áp mã đích lên kích thước danh nghĩa `baseDimensionsById` (lấy từ `CargoPackage`), không đảo ngược kích thước đã xoay (`orientedSize` trong `scene-input.ts`). Xoay giữ nguyên góc vị trí của kiện.
- Cả ba vai trò dùng chung `SceneCanvas` với `frameloop="demand"`. CameraControls tự invalidate khi chuyển động; mọi thay đổi buffer imperative phải gọi invalidate. Spring chỉ ghi ma trận/proxy kiện đang chạy, không đưa state từng frame qua React.
- `frustumCulled={false}` không loại bỏ nhu cầu bounds của **raycast**. Cargo dùng sphere bao toàn bộ effective geometry và quãng animation, cập nhật khi geometry đổi. Không tính lại `computeBoundingSphere()` trong animation/step/slice path; cập nhật màu không ghi lại ma trận.
- Dữ liệu đo riêng trong `features/viewer3d/benchmark.mock.ts` (`createBenchmarkInput`: request + result đúng contract Spec, cm; tài xế dùng `createBenchmarkInput`): `?debug&packages=132|300|500|1000`, có thể thêm `&quality=high|balanced|low`. *(bổ sung 03/10/2026, FE-5b-07)* Thêm `&stops=1|4|8` thì fixture có chừng đó điểm giao **và có vùng theo điểm giao** (`stopZones`, `stopZoneId`, `rehandlingCount`) để đo dải vùng; không có `stops` thì fixture như cũ — 4 điểm, không vùng — nên các phép đo có từ trước vẫn đo đúng thứ chúng đo. Không đổi mock nghiệp vụ và không kích hoạt benchmark khi thiếu `debug`. Đây là fixture renderer có khe hở, không phải phương án đã xác nhận ổn định chất xếp.
- Debug chỉ quan sát: FPS khi scene chuyển động, draw calls, tam giác, số kiện, DPR và tier. Khi nghỉ hiển thị trạng thái nghỉ; không tự invalidate để đo FPS. *(đã điều chỉnh 20/09/2026, LM-101)* "Nghỉ" là **demand loop đã dừng** — frame cuối không xin frame tiếp — rồi lặng 250 ms (`scene/perf-idle.ts`), không phải "lâu rồi chưa vẽ": máy yếu vẽ 2–3 FPS thì frame nào cũng cách nhau hơn 250 ms, lấy khoảng lặng làm chuẩn sẽ báo nghỉ giữa lúc scene đang chạy, giấu mất FPS và làm `quality-policy` (bỏ qua mẫu nghỉ) không bao giờ hạ tier trên đúng máy cần hạ. Chưa nâng mục tiêu FPS trên thiết bị thật chỉ dựa vào số đo Chromium phần mềm.
- Low tier dùng DPR 0,5 và vật liệu cargo Lambert sau phép đo kéo camera 1.000 kiện trên SwiftShader; giữ nguyên picking và nhãn HTML. Balanced/high giữ Standard. Phần 3D mềm hơn là trade-off có chủ ý để ưu tiên tương tác. Không suy diễn kết quả này thành cam kết FPS trên mọi thiết bị hoặc mọi tier.

### Manual editor *(bổ sung)*

- Planner có chế độ Xem/Chỉnh sửa. Chỉ kiện đang chọn dùng một proxy mesh; instance tương ứng được ẩn theo ID. Lưới sàn và chỉ dẫn trục có số draw call cố định.
- Kéo dùng pointer capture, ref và cập nhật Three imperative; chỉ commit một lệnh khi thả hợp lệ. Trong gesture tạm ngưng camera và raycast instances, khôi phục khi thả/hủy/unmount. Không đưa pointer position qua React mỗi frame.
- Snapping dùng cm trong `viewer3d/editor`: lưới 5 cm, ngưỡng hút 2 cm, hút cả mặt vật cản chịu tải (không hút vật cản không chịu tải), so qua `eq/lt/gt`, vị trí commit qua `roundCm`. Nút nudge đi đúng 1/5/10 cm (mặc định 1); snapping dùng khi kéo hoặc bấm Căn vị trí. Xoay chỉ vòng qua `effectiveOrientations` của kiện (6 mã Spec), không xoay quaternion tự do.
- *(đã điều chỉnh, LM-035)* Tính hợp lệ khi kéo/thả/xoay/nudge/căn/khôi phục do constraint engine của domain quyết định (`editor/editor-engine.ts`, dựng một lần mỗi snapshot, `sync` theo placement hiệu lực trước mỗi lần kiểm nên undo/redo/reset không lệch): issue `error` dính tới kiện (chủ thể hoặc `relatedIds`) chặn commit, `warning` vẫn commit; câu qua `formatIssue`. Issue toàn phương án (trọng tâm, và tải trục `AXLE_OVERLOAD` — FE-5b-03) không chặn thao tác; `AXLE_OVERLOAD` chặn ở bước Duyệt. Đo Node: snap + sync + kiểm ở 1.000 kiện p95 ≈ 2,7 ms.
- Lịch sử giữ patch trước/sau theo ID, tối đa 200 lệnh, không snapshot placements mỗi lần di chuột. Ghim khóa move/rotate cho đến khi bỏ ghim. Reset mọi chỉnh sửa cần dialog; reset riêng bị chặn nếu vị trí gốc đang bị kiện khác chiếm.
- Không tạo placement từ UnplacedPackage, không lưu draft qua phiên/trang và không coi kiểm tra frontend là kết quả tối ưu authoritative.
- *(bổ sung 28/09/2026, LM-108)* **Tay kéo theo trục**: ba mũi tên X/Y/Z trên kiện đang chọn (`EditorAxisHandles`, số mesh cố định, vùng nắm
  không vẽ, luôn vẽ đè); nắm mũi tên thì kiện chỉ chạy theo trục đó và chỉ hút mặt trên trục đó; kéo thân kiện vẫn theo mặt phẳng kéo. Kéo
  một trục về trong 6 cm quanh vị trí trong phương án thì hút đúng vị trí gốc (`homeSnapCm`, thắng các mặt khác).
- *(bổ sung 28/09/2026, LM-108)* **Trọng lực khi chỉnh tay** (`editor/gravity.ts`, từ nhánh `fix/update-animation` của minkoi): dời một
  kiện hợp lệ thì các kiện đang tựa lên nó mà mất chỗ đỡ rơi thẳng xuống mặt đỡ cao nhất bên dưới (kiện khác, nóc vật cản, sàn), rơi dây
  chuyền lên trên; chỉ đổi `z`, không trượt ngang; kiện đã ghim đứng yên. Kiện dời + các kiện rơi là **một** lệnh lịch sử
  (`GRAVITY_MOVE`, hoàn tác một lần). Hoạt ảnh rơi trong `useCargoMatrices` (spring riêng, ghi ma trận ngoài React), bỏ qua kiện đang kéo và
  lần đổi phương án; reduced motion đặt thẳng. Dung sai chạm mặt 0,5 cm.

### Operations và scene dùng chung *(bổ sung)*

- `operations/scene-semantics.ts` tách loaded/current/next/future/removed khỏi renderer. Planner, `PositionViewer` (kho) và `DriverCargoViewer` cùng dùng `SceneCanvas`; panel và workflow nằm ở wrapper. Không thêm engine cho từng vai trò.
- *(đã điều chỉnh, LM-036)* Loading lấy `placement.step` (= `loadingOrder`); unloading lấy `unloadingOrder` của kết quả qua `unloadSequence` (`operations/unloading.ts`), nhãn "Thứ tự dỡ" không kèm "gợi ý"; revision `ordersRecomputed` hiện thêm câu "tính lại ở FE". Màn tài xế (LM-061) dùng `unloadingOrder` của revision đã duyệt cho cả danh sách kiện của điểm giao lẫn mô phỏng, không có chữ "gợi ý". Nhánh thứ tự suy ra (stop tăng, cao trước, gần cửa trước, nhãn "gợi ý") chỉ còn làm dự phòng khi kết quả thiếu `unloadingOrder`; hiện không màn nào dùng tới. Stop-order consistency không chứng minh unload accessibility.
- Blocker là `lifoIssues` của domain qua `createLifoIndex`: chỉ kiện giao **muộn hơn** nằm hẳn sau mặt sau; kiện đã dỡ/đang ẩn gỡ khỏi lưới (`grid.remove`), tua lùi thì thêm lại; kiện chắn sắp theo x trước khi callout. `LIFO_BLOCKED` dừng mô phỏng và giữ target; `LIFO_PARTIAL` chỉ đánh dấu. Duyệt đếm hai mã này, không khẳng định dỡ được thực tế. Không tính người, xe nâng, clearance hay xoay lúc dỡ. Riêng hình ảnh dỡ (`UnloadMotion`) dùng `corridor` — mọi kiện còn lại trên hành lang thẳng, bất kể điểm giao — để không trượt xuyên kiện. Fixture benchmark có đúng một cặp kiện đổi điểm giao tạo ca `LIFO_BLOCKED` cho browser suite; seed đã duyệt không có ca LIFO.
- CoM là **tâm khối lượng hàng** đã xếp/còn lại, không phải toàn xe. *(đã điều chỉnh 03/10/2026, FE-5b-03, D-78)* **Tải trục**: `AxleLoadPanel` (DOM trong tab Vận hành, không thêm draw call) hiện tải nhóm trục trước / sau của **toàn bộ kiện đang xếp, kể cả bản đang chỉnh tay**, so với giới hạn, kèm MOCK RESULT; vượt giới hạn có chữ "Vượt … kg", không chỉ màu; xe không đủ dữ liệu trục thì chỉ có một câu lý do. Mô hình (`axleLoadsOf`): nhóm trước là trục có `positionXCm` nhỏ nhất, nhóm sau là các trục còn lại đặt tại trung bình vị trí; hàng nặng W có trọng tâm x dồn W × (x − x_trước) / (x_sau − x_trước) lên nhóm sau, phần còn lại lên nhóm trước, cộng tải rỗng. Giới hạn lấy `frontAxleLimitKg` / `rearAxleLimitKg` của xe (kho điền từ loại xe, mục 9), vắng thì tổng `axles[].maxLoadKg` của nhóm — tải tối đa 0 kg là chưa khai. Vượt giới hạn là issue `AXLE_OVERLOAD` mức `error` của constraint engine: chặn Duyệt qua `approvalBlockers` (lý do ở tooltip + `aria-describedby` như mọi lỗi), không chặn thao tác kéo thả. `positionXCm` cùng hệ toạ độ với thùng: `truckLayout` đặt `toScene(positionXCm)` thẳng lên trục x của placement (vách trước = 0, âm là dưới cabin), không độ dời. Cabin, bánh và khung gầm vẫn là mô hình minh hoạ: trục vẽ mặc định khi xe không khai `axles` không tham gia phép tính. *(đã điều chỉnh 03/10/2026, FE-5b-05)* Xe mẫu của seed nay khai hai trục (số ước lượng, mục 9): trục trước ở −100 cm — đúng chỗ `truckLayout` vẽ cầu dẫn hướng (`CAB_X`) — và trục sau giữa hốc bánh của thùng, nên khung gầm 3D vẽ đúng các trục đang được tính, và phương án seed hiện tải trục thay cho câu "xe này chưa khai báo trục" (chỉ "Truck 6m" của Spec còn câu đó). Phương án đã duyệt của seed không vượt trục nào (`seed.test.ts` kiểm mọi revision seed).
- Chi tiết xe gộp geometry theo vật liệu; mọi bánh (bánh đôi cầu sau) dùng một InstancedMesh, một draw. *(bổ sung 17/09/2026)* Khung gầm chi tiết (`scene/truck-chassis.ts`: khung sườn chữ C, dầm ngang, trục, vi sai, nhíp, giảm chấn, các-đăng, bình nhiên liệu/hơi, ắc quy, ống xả, lốp dự phòng, chắn bùn, gầm thùng) gộp vào cùng hình học màu theo đỉnh của `vehicle-details` — không thêm draw call. Camera xoay được xuống dưới gầm (`maxPolarAngle` gần π) và có góc nhìn "Gầm xe" (`gam-xe`, tâm nhìn hạ xuống khung sườn); đèn yếu từ dưới giữ khung gầm không đen. Màn kho không có góc gầm xe. Cargo dùng atlas trung tính chung cho carton/pallet/crate qua thuộc tính instance, không phải nhãn hướng đặt. Low tắt chi tiết phụ; không tắt cues nghiệp vụ. Khi gặp `LIFO_BLOCKED`, playback dỡ tạm dừng và giữ target. Kiện còn vật trên hành lang thẳng (người dùng bỏ qua bước, hoặc bị che một phần) mờ tại chỗ; không dịch chuyển xuyên kiện khác. Reduced motion không dịch chuyển lớn; hoàn tất phải trở lại idle.
- Timeline dùng ô cao bằng nhau, 8–64 bins theo chiều rộng, slider giữ toàn bộ bước.
- *(đã điều chỉnh 03/10/2026, FE-5b-07, D-79)* **Dải vùng điểm giao thay bản đồ điểm giao.** Planner vẽ các vùng của phương án (`result.stopZones` → `ViewerSceneModel.zones`, theo thứ tự giao, vùng đầu sát cửa) thành dải trên sàn thùng theo màu điểm giao: `operations/ZoneStrips.tsx`, hình học thuần ở `operations/stop-map.ts` (`zoneStrips`: mỗi vùng một hình chữ nhật từ `startXCm` tới `endXCm`, lùi 2 cm khỏi hai vách, cao 0,4 cm trên sàn; khoảng đệm để trống; nằm hoàn toàn trong mép sàn, depth test bình thường, không đặt dải trên thân, gầm hay bên ngoài xe). Mọi vùng nằm trong **một** mesh tô màu theo đỉnh: **đúng một draw call dù phương án có 1 hay 8 điểm giao** (`e2e/viewer-zones.spec.ts` đo bằng `?debug&packages=1000&stops=1|4|8`: tier balanced 25 / 25 / 25 draw call, tier low 17 / 18 / 18 — fixture một điểm không có kiện ngoài vùng nên tier low không dựng vỏ viền; tắt dải vùng bớt đúng một). Mỗi vùng có một nhãn DOM neo ở mép sàn: số điểm kèm màu, tên điểm, tỷ lệ thể tích hàng của điểm đó (%) — màu luôn đi kèm số và tên. Nhãn không đè nhau và không đè nhãn "Cửa sau": mỗi khung hình được vẽ, `ZoneStrips` chiếu điểm neo ra màn rồi đẩy nhãn bị chạm xuống dưới nhãn đã đặt, ghi thẳng vào DOM và chỉ ghi khi đổi; số nhãn bằng số điểm giao, không theo số kiện. Dải vùng **bật sẵn** khi mở Planner (cue nghiệp vụ: tier `low` vẫn vẽ), tắt / bật ở hộp Hiển thị ("Ẩn / Hiện dải vùng điểm giao", `operations.showZones`); phương án không chia vùng thì không có nút đó. Kho và tài xế không truyền `zones` cho `SceneCanvas` nên không có dải. Bản đồ phân bố theo thể tích thực (`stopDistribution`, `InteriorStopMap`) đã bỏ.
- *(bổ sung 03/10/2026, FE-5b-07)* **Vùng của kiện và kiện nằm ngoài vùng.** `ScenePlacement` mang `zoneId` (vùng chứa tâm kiện theo X) và `outOfZone` (vùng đó không phải vùng của điểm giao mình), tính bằng `locateInZones` của domain ở `adaptResult` và tính lại cho kiện đang dời / xoay ở `resolveEffectiveScene` — nên dấu ngoài vùng và số lần dỡ-xếp lại đi theo bản đang chỉnh tay; vùng thì giữ nguyên của lần tối ưu. Kiện nằm ngoài vùng có ba dấu: viền trắng dày trong 3D (vỏ viền của cargo — xem "Three.js"; tắt cùng dải vùng, và nhường viền cho kiện chắn khi đang xem kiện chắn lối dỡ), nhãn "Ngoài vùng" ở dòng của kiện trong tab Danh sách (kèm ô lọc "Chỉ kiện nằm ngoài vùng" khi phương án có kiện như vậy), và ở thẻ kiện đang chọn: ô "Vùng điểm giao" ghi vùng kiện đang nằm, nhãn "Ngoài vùng" và câu "Nằm ngoài vùng của điểm N — tính một lần dỡ-xếp lại". Trắng chứ không hổ phách: hổ phách lẫn vào cam của điểm 1 và vàng của điểm 4.
- *(đã điều chỉnh 03/10/2026, FE-5b-07)* **Hộp Chi tiết** (tab Vận hành của hộp thông tin) hiện ba chỉ số của phương án đang xem, đều là DOM, không thêm draw call: `AxleLoadPanel` (tải trục trước / sau so giới hạn), `RehandlingPanel` (số kiện `outOfZone` của bản đang xem kể cả đang chỉnh tay, MOCK RESULT; phương án không chia vùng thì chỉ một câu lý do, không có số) và `DeadlinePanel` (từng điểm giao: giờ đến dự kiến và mức hạn theo `Trip.routePlan` của chuyến — `adaptResult` đưa vào `SceneStop.eta` / `deadlineStatus`; điểm không có hạn ghi "Không có hạn"; chuyến chưa tối ưu tuyến thì chỉ một câu) — hai panel sau ở `overlays/PlanIndicators.tsx`. Tab Chỉ số thêm dòng "Số lần dỡ-xếp lại" lấy từ `metrics.rehandlingCount` của kết quả. Thanh trên của Planner không thêm gì (vẫn đo ở 1.366 px).
- *(bổ sung 19/09/2026, LM-094)* Bản đã duyệt chưa có dời/xoay: không có nút Duyệt, hiện "Đã duyệt lúc HH:mm dd/MM"; có thì "Duyệt bản chỉnh".
  Lý do chặn Duyệt ở tooltip + `aria-describedby` của nút, không in ở thanh. Pha chuyến khác `planning` hoặc thiếu `plans.approve`: không
  Chỉnh sửa, không Duyệt, một dòng lý do (`viewer.lock`). Hộp thông tin chỉ mở từ nút "Chi tiết / Hiển thị" ở góc khung 3D và thẻ kiện.
  *(đã điều chỉnh 02/10/2026, FE-0-07, D-80)* Chỉ **điều phối viên** có `plans.approve`: chỉnh tay và Duyệt trong Planner
  (`plannerAccess({ canApprove })`). Đã dời / xoay kiện thì nút chính là "Duyệt bản chỉnh": `approveRevision` của kho áp patch của draft và tạo
  revision **đã duyệt** mới — không có bước lưu bản chưa duyệt. Thiếu quyền (quản lý công ty) là khoá `readOnly`, kể cả ở bản chưa duyệt. Kho ghi
  người bấm Duyệt vào revision (`approvedBy`, seed là điều phối viên) nên nhãn là "Duyệt bởi <tên> lúc …". Liên kết "Tới Thiết lập tối ưu" của
  banner lỗi thời theo `optimization.run` và pha `planning`. E2E của Planner (chỉnh sửa, Duyệt) đăng nhập `dispatcher` — mặc định của `login`.
  Đã bỏ: quản lý công ty duyệt và khoá `awaitingApproval` "Chờ quản lý công ty duyệt" (LM-104, 27/09/2026), hàng đợi `/duyet` cùng các quyết
  định trả lại, "Lưu bản chỉnh" / `saveEditedRevision` tạo revision chưa duyệt (LM-108, 28/09/2026). Dòng phụ `awaitingApproval` của **chuyến**
  ("Chờ duyệt", mục 9) là thứ khác và vẫn còn.
- *(đã điều chỉnh 03/10/2026, FE-5b-08, D-80)* **Luật duyệt.** Chặn Duyệt: phương án lỗi thời, dòng kiện bắt buộc chưa xếp đủ
  (`MUST_LOAD_UNPLACED`), vượt tải trục (`AXLE_OVERLOAD`), lỗi ràng buộc khác. Tooltip + `aria-describedby` của nút nói **đúng loại lý
  do** — "Chưa duyệt được: 1 dòng kiện bắt buộc chưa xếp đủ và tải trục vượt giới hạn." — ghép từ `blockerSummary` của domain bằng
  `format.list` (`useViewerApproval`); hộp thoại liệt kê từng lý do. **Mức hạn** lấy từ tuyến đã tối ưu của chuyến (`SceneStop.eta`,
  `deadline`, `deadlineStatus` → `deadlineReview`): điểm **sát hạn** chỉ hiện trong hộp duyệt kèm giờ đến dự kiến và hạn, không hỏi thêm;
  có điểm **trễ hạn dự kiến** thì bấm Duyệt mở **bước xác nhận** ngay trong hộp thoại (`LateStopsConfirm`: "Duyệt dù có điểm trễ hạn?",
  liệt kê điểm, giờ đến dự kiến, hạn, kèm MOCK RESULT vì giờ đến là của mock tối ưu tuyến) — "Vẫn duyệt" mới gửi Duyệt kèm `force`,
  "Quay lại" về bước xem xét; mỗi lần mở hộp thoại bắt đầu lại từ bước xem xét. Chuyến chưa tối ưu tuyến thì hộp duyệt không nói gì về
  hạn. Kho kiểm lại tất cả (mục 9): giao diện bị bỏ qua thì Duyệt vẫn bị từ chối; kho từ chối thì toast kèm câu của kho.
- *(bổ sung 03/10/2026, FE-5b-08, D-80)* **Đổi xe ở Planner.** Nút phụ "Đổi xe" nằm ở **góc dưới phải khung 3D** cạnh "Chi tiết / Hiển
  thị" (`SceneHud`, từ 768 px; dưới 1.280 px chỉ icon), **không** nằm trên thanh trên: ở 1.536–1.760 px hàng điều khiển không còn chỗ
  cho thêm một nút (đo: thêm 46 px thì tên tuyến tràn 5 px ở 1.760 px). Chỉ hiện ở chế độ Xem, khi chuyến Đã lập kế hoạch và người xem
  có `trips.edit`. Mở cùng hộp thoại `trips/ChangeVehicleDialog` với Chi tiết chuyến (mục 9); đổi xong phương án đang xem thành lỗi
  thời ngay và thanh lỗi thời ghi "đã sửa Xe (giờ · ngày · người)". Đổi xe không bao giờ là nút chính.
- Planner mặc định ưu tiên scene với HUD gọn; thông tin kiện, tải trục, màu/slice và lớp phân tích nằm trong inspector mở theo nhu cầu. Double-click focus giữ góc nhìn; Esc hoặc “Xem toàn xe” thoát focus. Theo bước là tùy chọn, tạm dừng khi người dùng tự điều khiển camera. Chọn blocker không đổi target dỡ; có đường quay lại target.
- Viền/nhãn selected/current/next/hover là tập nhỏ cố định; `SceneCallout` giữ nhãn trong khung và đường chỉ dẫn neo đúng vị trí 3D. Editor có ba hướng đo, mặt phẳng kéo, tối đa ba mặt snap và bốn vùng overlap bằng hai InstancedMesh phụ cố định. Geometry/nhãn của preview cập nhật imperative, không đưa pointer frames qua React. Phone giữ trạng thái/snap/invalid, lược nhãn đo phụ để dành chỗ cho kiện.
- *(bổ sung, LM-042)* Xem trước 3D ở form xe: `fleet/VehiclePreview.tsx` lo `useWatch` + debounce 250 ms + `previewVehicle` (chỉ phần hình học hợp lệ, không thì giữ hình cũ), rồi lazy-load `viewer3d/VehiclePreviewViewer` (`SceneCanvas` không kiện, tier `low`, không cabin). Camera chỉ canh lại qua `frameVehicle` khi kích thước lòng thùng đổi. Làm nổi vật cản từ ngoài canvas đi qua `highlightedObstacleId`/`onObstacleSelect` của `SceneCanvas`: `setColorAt` màu `--highlight`, không thêm draw call, không callout. Không có `WebGLRenderingContext` (jsdom) thì chỉ vẽ phác thảo SVG, không tải chunk 3D.
- Three của kho và driver được lazy-load từ `viewer3d`. Driver chỉ tải khi mở “Xem vị trí hàng”; mô phỏng không đánh dấu giao hàng và không có editor. Phone dùng panel dưới/drawer, nút thao tác 56px, không phụ thuộc hover/gizmo nhỏ.

### Tích hợp Spec vào engine *(bổ sung 15/09/2026 — đã xong ở phase 2)*

Các mục "Foundation engine", "Manual editor", "Operations" phía trên đã cập nhật theo phase 2 của
[docs/issues](docs/issues/README.md) (báo cáo: [docs/viewer-cm-report.md](docs/viewer-cm-report.md)). Tóm tắt đích đã đạt:

- Engine nhận view model dựng từ `OptimizationResult` + `CargoPackage` + chuyến (LM-030),
  đơn vị cm, `SCENE_SCALE = 0.01` chỉ trong `scene/units.ts` (LM-031).
- 6 hướng đặt `LWH … HWL`; xoay chỉ vòng qua `allowedOrientations`, tôn trọng `keepUpright` (LM-032).
- Vật cản vẽ bằng số draw call cố định (tối đa 2), màu token riêng, không raycast khi kéo kiện (LM-033 — đã làm, xem mục 7 đầu).
- Editor: nudge 1/5/10 cm, lưới 5 cm, snap 2 cm, commit qua `roundCm` (LM-034). Mỗi lần thả/xoay
  chạy constraint engine của `src/domain`; lỗi chặn commit, cảnh báo vẫn commit (LM-035).
  Ngân sách: constraint engine 1.000 kiện p95 ≤ 50 ms, một lần thả p95 ≤ 8 ms (D-29).
- Timeline dùng `loadingOrder` / `unloadingOrder` của kết quả; LIFO lấy từ domain — che kín
  100% mặt sau là vi phạm, che một phần là cảnh báo (LM-036, D-26).
- *(đã điều chỉnh 03/10/2026, FE-5b-03)* Tải trục: mock tính bằng mô hình đòn bẩy, vượt giới hạn chặn Duyệt (D-78) — thay nhãn "Sẽ có sau" của LM-037 / Spec 7.10; xem mục "Operations". *(đã điều chỉnh 03/10/2026, FE-5b-05)* Xe mẫu của seed khai trục ước lượng nên phương án seed có số tải trục.
- Mock optimization chạy trong Web Worker, không chặn main thread (LM-025, D-30).

Khi làm một issue trong nhóm này, sửa luật tương ứng ở các mục phía trên cùng lúc với code.

### Ảnh xem trước tĩnh dùng SVG, không dùng Three.js *(bổ sung)*

Ảnh nhỏ, không xoay được thì vẽ bằng SVG đẳng cự qua `lib/isometric.ts` — nhẹ hơn
nhiều và không kéo Three.js vào chunk. Đang dùng ở: xem trước trong modal tối ưu,
ảnh thu nhỏ màn so sánh phương án, hình minh hoạ hướng đặt kiện ở kho, skeleton lúc
đang tải Three.js, hình minh hoạ màn đăng nhập và sơ đồ tuyến ở chi tiết chuyến (`trips/RouteDiagram.tsx`, LM-097).

Chỉ dùng Three.js khi người dùng **cần xoay hoặc bấm vào vật thể**.

*(đã điều chỉnh 03/10/2026, FE-4b-07)* Bản đồ địa lý không còn bị cấm: `components/map/RouteMap` vẽ kho, điểm giao (màu điểm giao kèm
số), đường tuyến và vị trí xe bằng MapLibre GL. Cùng lối với khung 3D: không có WebGL (jsdom) thì chính `RouteMap` vẽ sơ đồ SVG từ cùng
dữ liệu và không tải chunk bản đồ; hình luôn `aria-hidden`, nội dung tương đương là danh sách điểm `sr-only`. Mốc là phần tử DOM của React,
không dùng sprite hay font của style nền. *(đã điều chỉnh 03/10/2026, FE-4b-09)* Chi tiết chuyến giữ hàng điểm giao của
`trips/RouteDiagram.tsx` (kéo đổi thứ tự, lọc bảng kiện) và đặt `RouteMap` cao 256 px ngay dưới hàng đó, trong cùng card: kho rồi các điểm
**có toạ độ** theo thứ tự đi; điểm chưa có toạ độ không có trên bản đồ.

## 8. Chuyển động

| Tình huống | Thời lượng | Easing |
|---|---|---|
| Hover, nhấn nút | 120ms | standard |
| Toast vào / ra | 200 / 150ms | decelerate / accelerate |
| Panel chi tiết trượt | 280ms | decelerate |
| Modal mở | 220ms | standard |
| Kéo thả sắp xếp | 200ms | standard |
| Chuyển góc camera 3D | 500ms | decelerate |
| Một bước phát lại xếp hàng | 400–700ms | decelerate |

Bắt buộc hỗ trợ `prefers-reduced-motion`: mọi thời lượng trên 200ms rút về 100ms, tắt chuyển động lớn.

## 9. Quy ước code

```
Component React     PascalCase, file trùng tên component   LoadPlanViewer.tsx
Hook                bắt đầu bằng use                       useOptimizationJob
Hàm xử lý sự kiện   tiền tố handle                         handleApprovePlan
Biến, hàm           camelCase
Type, Interface     PascalCase, không tiền tố I            Placement, VehicleSpec
Hằng số             UPPER_SNAKE_CASE
Đường dẫn route     slug tiếng Việt không dấu              /chuyen/:tripId/phuong-an
```

Commit theo Conventional Commits: `feat(viewer3d): add cross-section slider`.

- TypeScript strict. Không `any`. Không `@ts-ignore`. Khi thư viện bắt buộc phải có kiểu lỏng, lấy kiểu từ chính thư viện (`TableOptions<...>['columns']`) thay vì tự viết `any`.
- Không gọi API trực tiếp trong component.
- Màn trong `AppShell` mà kho/tài xế cũng mở (hồ sơ) dùng `pointer-coarse:h-14 pointer-coarse:text-body-lg` cho ô nhập và nút, không ép
  56 px trên desktop (LM-096).
- Hộp thoại có `<form>` riêng không đặt trong `<form>` khác của cây React — portal không chặn sự kiện submit lan theo cây React (LM-089).
- Mọi form dùng react-hook-form + zod schema, không tự quản state form. Đọc giá trị đang nhập bằng `useWatch`, **không** dùng `form.watch()` trong thân render — React Compiler không memo được và sẽ cảnh báo.
- Không dùng `localStorage`. Phiên đăng nhập tạm giữ trong `sessionStorage`; khi nối backend thật sẽ đổi sang cookie HttpOnly do server đặt.

### Lớp dữ liệu *(đã điều chỉnh)*

Luật ban đầu ghi "mọi request đi qua hook TanStack Query". Thực tế phần lớn màn chưa
có backend nên chưa có request nào. Đường đi chuẩn khi làm màn mới:

1. Viết `features/<tên>/<tên>-api.ts` — nơi duy nhất biết về mạng. Chưa có backend thì trả mock sau một khoảng trễ giả.
2. Bọc bằng hook Query trong cùng feature (`useTripsQuery`).
3. Component chỉ gọi hook, không bao giờ gọi `-api.ts` trực tiếp.

*(bổ sung 02/10/2026, FE-0-09)* Tên hàm trong `-api.ts` theo hành động của endpoint ở issue backend. Mỗi hàm export có một dòng comment
ghi endpoint ngay trên nó (`// POST /api/trips/{id}/optimize-route`), đầu file có bảng hàm → endpoint. Endpoint backend chưa có ghi
"chưa có ở BE", kèm mã câu hỏi mở (`(Q-07)`) khi PRD v2 có; hàm có sẵn lệch tên ghi "tên sẽ đổi khi nối BE: …" ở đầu file. Comment chỉ
gồm phương thức + đường dẫn và các nhãn ngắn đó — repo công khai, không chép luật nghiệp vụ hay nội dung tài liệu nội bộ. Nối backend
chỉ thay thân hàm.

*(đã điều chỉnh 19/09/2026)* Không còn màn nào giữ dữ liệu nghiệp vụ ở `useState`: Đội xe (LM-040), Người dùng (LM-092, `users-api.ts` →
`useUsersQuery` + mutation), Nhật ký (`audit-api.ts`), kho và tài xế (LM-086/087) đều đọc/ghi kho mock qua Query. Trạng thái xe đọc
`useVehicleStatesQuery` (`['vehicles', 'states']`, `staleTime: 0` vì pha chuyến đổi ở màn khác); ghi bảo dưỡng vô hiệu hoá `['vehicles']`.

*(bổ sung 02/10/2026, FE-0-02, D-64)* **Lọc theo công ty nằm ở tầng kho**, như backend lọc mọi truy vấn theo `company_id`: component, hook
và `-api.ts` **không tự lọc theo công ty** và không cần biết công ty của người xem. Kho xét phiên của chính nó (`lib/mock-db/tenancy.ts`;
mọi `db-*.ts` đọc/ghi qua `ctx.scope`), ba phạm vi:

- **Phiên của một công ty** (`User.companyId`): hàm liệt kê chỉ trả bản ghi của công ty đó; đọc theo mã bản ghi của công ty khác là
  `NOT_FOUND` như bản ghi không tồn tại (tra mã QR: `QR_UNKNOWN`); ghi vào bản ghi của công ty khác, hoặc tham chiếu tới nó — gán xe, tài
  xế, loại kiện, kiện, chuyến của công ty khác — là `FORBIDDEN_COMPANY`.
- **Phiên nền tảng** (ba vai trò không thuộc công ty nào): mọi hàm dữ liệu vận hành từ chối `COMPANY_REQUIRED`. Người dùng, nhật ký và danh
  sách công ty không phải dữ liệu vận hành: nền tảng đọc hết, người của công ty chỉ đọc của công ty mình (ai tạo, sửa, khoá được ai: mục 1,
  FE-0-08). Màn
  cần tên chuyến, xe để đọc nhật ký hay thông báo gọi `listAuditNames` — theo phạm vi nhật ký, không đòi quyền vận hành — không gọi
  `listTrips` / `listVehicles`.
- **Không có phiên** (test logic kho bằng `createMockDb()`, dựng seed, hai trang tài liệu `/kieu-dang`, `/thanh-phan` ngoài `RequireAuth`):
  **không lọc**; bản ghi tạo ra thuộc công ty mặc định `LOG-001`. Luật "bản ghi chỉ tham chiếu bản ghi cùng công ty" vẫn giữ. Test cần đúng
  dữ liệu của một công ty thì đặt phiên: `db.restoreSession(mã người dùng)` (không ghi nhật ký) hoặc `signedInAs`.

Bản ghi mang công ty: `Trip.companyId`, `PackageType.companyId`, `VehicleType.companyId`, `DeliveryRequirement.companyId`,
`Package.companyId`, `AuditEvent.companyId` (công ty của phiên đã ghi; `null` khi là tài khoản nền tảng; lần đăng nhập sai ghi
công ty của tài khoản bị thử). Xe lưu công ty cạnh `VehicleConfig` trong kho (`vehicleCompany`, D-04); revision và lần chạy tối ưu thuộc công
ty của chuyến, không lưu riêng. Thêm hàm công khai vào kho thì khai nó ở bảng `PROBES` của `tenancy.test.ts` — thiếu là test đỏ.

*(bổ sung 27/09/2026, LM-104; đã điều chỉnh 03/10/2026, FE-4b-01)* Dữ liệu các luồng Review 1 theo cùng đường đi: `package-pool-api.ts`,
`requirements-api.ts` (thay `orders-api.ts`), `vehicle-types-api.ts` (mỗi cái một file hook `use*Query.ts` cùng thư mục); phần thêm cho
chuyến nằm ở file riêng (`trips/trip-extras-api.ts` + `useTripExtrasQuery.ts`) để không đụng `trips-api.ts`. Khoá Query: `['package-types']`,
`['package-pool', …]`, `['requirements', …]` (thay `['orders', …]`), `['vehicle-types', …]` (không đặt
dưới `['vehicles', id]` để khỏi va mã xe); dữ liệu gắn một chuyến (sẵn sàng tối ưu, yêu cầu giao đã vào chuyến `['trips', tripId, 'requirements']`, báo cáo, lần chạy, so sánh ba phương án của một lần chạy `['trips', tripId, 'run-comparison', runId]` — `trips/plan-compare-api.ts` → `usePlanCompareQuery.ts`, FE-5b-06)
nằm dưới `['trips', tripId, …]` để mọi ghi của chuyến làm mới chúng. *(đã điều chỉnh 02/10/2026, FE-0-02)* Khoá truy vấn **không cần
mang người dùng hay công ty**: `AuthProvider` xoá cả cache Query lúc đăng xuất và lúc đăng nhập, nên dữ liệu kho đã lọc cho người trước không
hiện cho người sau trong cùng tab (`AuthProvider.dom.test.tsx`). Chỉ thêm người xem vào khoá khi kết quả tính theo người xem ngay ở client
(`['notifications', id, vai trò]`).
*(đã điều chỉnh 02/10/2026, FE-0-06)* `shipments-api.ts`, `receiving-api.ts` và khoá `['shipments', …]`, `['receiving', …]` đã bỏ cùng hai
feature đó.
Hai ngoại lệ, vì mutation chờ mọi truy vấn khớp khoá bị vô hiệu làm mới xong: *(đã điều chỉnh 02/10/2026, FE-0-07)* **người đã duyệt ở
Planner** `['plan-approval', revisionId]` (`viewer-api.ts` → `usePlanApprovalQuery`; dưới khoá chuyến thì bấm Duyệt chờ nó, Planner dựng lại
trên revision mới và mất toast lẫn điều hướng; revision bất biến nên khoá này không cần làm mới — `review-api.ts` và khoá `['review', …]` đã bỏ
cùng hàng đợi duyệt) và **nhãn QR** của kho / tài xế `['warehouse-labels', id]`, `['driver', 'labels', id]` (mỗi lần ghi bước xếp, dỡ phải chờ
tải lại nhãn).
*(đã điều chỉnh 03/10/2026, FE-3b-01)* **Kho kiện theo mô hình backend** thay kiện đăng ký `RPK` của Review 1. Kiện là `Package`
(`PK-NNNN`, Phương Nam `PK-PN-NNNN`): `companyId`, `packageCode` (mã của bên gửi; nơi tạo không đưa thì bằng mã của kho), `qrToken`, kích
thước và khối lượng **của chính kiện**, `handlingClass`, `destination`, `packageTypeId?`, `status`, `flags`, `source`
(`IMPORT | MANUAL | TRIP | PICKUP`), `requirementId?` (yêu cầu giao đang giữ kiện — kho ghi từ FE-4b-01, trường tạm `orderId?` đã bỏ), `tripId?`, `stopId?`, người và thời điểm
tạo. Trạng thái **ghi thật**, không suy lúc đọc — chỉ `movePackage` (`db-packages.ts`) đổi
`status`, theo bảng `PACKAGE_TRANSITIONS`: `IMPORTED → ASSIGNED → STAGED → LOADED → IN_TRANSIT → DELIVERED | RETURNED`; `ASSIGNED`,
`STAGED`, `LOADED` được về `IMPORTED` (rời chuyến); sai bảng là `INVALID_PACKAGE_STATUS_TRANSITION`. Kiện của chuyến đổi trạng thái ở
**mốc chốt** của chuyến (`db-package-progress.ts`): đưa yêu cầu giao vào chuyến →
`ASSIGNED` kèm chuyến và điểm giao; *(đã điều chỉnh 03/10/2026, FE-6-02, FE-6-05)* kho **soạn** một kiện → `STAGED` ngay lúc đối chiếu bằng nhãn (soạn bằng xác nhận tay: khi điều
phối viên duyệt); kiện bị bỏ lúc soạn (thiếu) hoặc lúc xếp (hỏng) về `IMPORTED` kèm cờ `NOT_FOUND` / `DAMAGED` ngay lúc đó; xếp xong → `LOADED`
(mốc chốt, vì kết quả xếp còn bị gỡ khi xác nhận tay bị từ chối); xuất phát → `IN_TRANSIT`; hoàn tất điểm giao → kiện đã dỡ `DELIVERED`, kiện ở lại xe
(khách từ chối, sự cố khác) `RETURNED`; huỷ chuyến trước khi xe chạy hoặc gỡ yêu cầu giao khỏi chuyến → `IMPORTED`; *(đã điều chỉnh 03/10/2026, FE-6-07)* huỷ chuyến Đang vận chuyển → kiện chưa giao `RETURNED`. Cờ `NOT_FOUND` / `DAMAGED` chỉ gắn trên kiện `IMPORTED`; kiện mang cờ không vào yêu cầu giao
hay chuyến được (`PACKAGE_FLAGGED`, `isSelectablePackage`); `clearPackageFlag` chỉ điều phối viên gọi được (`ROLE_NOT_ALLOWED`) và ghi nhật
ký; nhân viên kho gỡ cờ `NOT_FOUND` bằng `reportPackageFound` khi tìm thấy lại kiện (FE-3b-06). Mã QR cấp một lần lúc tạo, `updatePackage` không đổi nó. Seed: Long Bình 88 kiện đều `IMPORTED` — 48 kiện thêm tay theo loại kiện (kiện `RPK` cũ, kích thước của loại kiện,
30 kiện thuộc sáu yêu cầu giao của seed, FE-4b-01) và 40 kiện nhập file không gắn loại kiện, tám điểm đến thật, hai kiện mang cờ; Phương Nam 10 kiện.
*(đã điều chỉnh 03/10/2026, FE-4b-01, D-72, D-91 → D-93)* **Yêu cầu giao** thay đơn hàng `ORD` của Review 1. `DeliveryRequirement`
(`REQ-NNN`, Phương Nam `REQ-PN-NNN`; `requirement-model.ts`): `companyId`, `destinationName`, `address`, `lat?` / `lng?` (có cả hai hoặc
không có), `deadline` (ISO), `priority` (`LOW | NORMAL | HIGH | URGENT`), `packageIds`, `note?`, `status`, `tripId?`, người và thời điểm
lập *(đã điều chỉnh 03/10/2026, FE-4b-04: `assignment` tạm đã bỏ — dòng kiện của yêu cầu nằm ở `DbState.tripPackageLinks` với
`requirementId`, điểm giao của yêu cầu là điểm của các dòng đó)*. Kho **ghi** ba trạng thái của backend: `PENDING` → `ASSIGNED`
(đưa vào chuyến) → `IN_TRIP` (xe xuất phát); gỡ khỏi chuyến hoặc huỷ chuyến trước khi xe chạy đưa yêu cầu về `PENDING` (D-91). "Đã giao"
(`DELIVERED`) và "Giao thiếu" (`PARTIAL`) **suy lúc đọc** bằng `requirementStatus(requirement, kiện)`: có kiện mang cờ hoặc hoàn trả là giao
thiếu (D-92); đang giao mà mọi kiện đã giao là đã giao. Luật của kho (`db-requirements.ts`, `db-requirement-trips.ts`): kiện phải `IMPORTED`,
không cờ, chưa thuộc yêu cầu khác (kiện ghi `requirementId`); hạn phải ở tương lai theo đồng hồ của kho, chỉ kiểm khi tạo hoặc khi đổi hạn
(`REQUIREMENT_DEADLINE_PAST`); còn `PENDING` thì sửa mọi trường, đã vào chuyến chỉ sửa hạn và ưu tiên (`REQUIREMENT_NOT_PENDING`), đã giao
xong thì không sửa (`REQUIREMENT_STATUS_INVALID`); xoá chỉ khi `PENDING`. Ưu tiên → `priority` / `mustLoad` của dòng kiện khi vào chuyến chỉ
nằm ở **một bảng** `REQUIREMENT_CARGO_PRIORITY` (D-93 — *đã điều chỉnh 03/10/2026, FE-5b-05:* người dùng đã xác nhận, không còn là đề xuất: Khẩn 4 và bắt buộc xếp, Cao 3, Bình thường 2, Thấp 1);
đổi ưu tiên của yêu cầu đã vào chuyến còn lập kế hoạch thì dòng kiện đổi theo và phương án lỗi thời. Nhật ký: nhóm `requirement`
(`created`, `updated`, `deleted`, `assigned`, `unassigned`), đối tượng `requirement`. Seed (`seed-requirements.ts`): Long Bình sáu yêu cầu
`PENDING` do quản lý công ty lập — bốn yêu cầu tới KCN Hoà Khánh, Phú Bài, Thăng Long, Trà Nóc (hai kiện cuối của mỗi đợt nhập) và hai yêu
cầu tới Co.opmart Bình Dương, Bách Hoá Xanh Dĩ An (22 kiện đầu); Phương Nam một yêu cầu; toạ độ thật ở mức khu vực; hạn neo theo ngày và
`seed-shift.ts` không dời hạn.
*(đã điều chỉnh 03/10/2026, FE-4b-02)* **Màn Yêu cầu giao** (`features/requirements`): `requirements-api.ts` (`listDeliveryRequirements`,
`getDeliveryRequirement`, `createDeliveryRequirement`, `updateDeliveryRequirement`, `deleteDeliveryRequirement`, cùng đưa vào / gỡ khỏi
chuyến) → `useRequirementsQuery.ts`, khoá `['requirements', 'list' | 'one' | 'selectable' | 'assignable-trips', …]`; ghi yêu cầu làm mới
`['requirements']`, `['package-pool']`, và — khi sửa, đưa vào hay gỡ khỏi chuyến — `['trips']`, `['dashboard']`, `['warehouse']`. Bảng
(`RequirementsPage`, hàm thuần `requirement-list.ts`): mặc định sắp theo hạn gần nhất trước; lọc `trang-thai`, `uu-tien`, khoảng hạn
`han-tu` / `han-den` (ngày theo giờ Việt Nam) là slug trên URL; bấm mã yêu cầu mở `RequirementDetailDialog`. Form (`RequirementFormDialog`,
luật thuần ở `requirement-form.ts`, schema zod chỉ gắn câu lỗi vào ô): hạn nhập bằng ô ngày + ô giờ theo giờ của máy; ô chọn kiện có ô lọc
theo điểm đến ghi trong file; hai **cảnh báo không chặn lưu** — kiện khác loại hàng, điểm đến trong file khác điểm đến của yêu cầu
(`packageWarnings`); yêu cầu đã vào chuyến thì chỉ ô hạn và ưu tiên còn sửa. Ô theo dõi giá trị đang gõ (`useWatch`) đặt trong component
con để thân form và ô chọn kiện hàng trăm dòng không vẽ lại theo từng phím. *(đã điều chỉnh 03/10/2026, FE-4b-03)* Toạ độ là **ô riêng
của form** (`CoordinatePicker`): để trống cả hai ô là bỏ toạ độ; đổi địa chỉ không còn tự bỏ toạ độ. *(đã điều chỉnh 03/10/2026,
FE-4b-04)* Điều phối viên chỉ xem và "Đưa vào chuyến" (`RequirementAssignDialog`: chỉ chọn chuyến Nháp / Đã lập kế hoạch — **không chọn
điểm giao**, hộp thoại nói trước yêu cầu gộp vào điểm nào hay chuyến thêm điểm mới, `stopOfRequirement`); Chi tiết chuyến có thẻ "Yêu cầu
giao của chuyến" (`TripRequirementsCard`: theo thứ tự điểm giao, kèm hạn và ưu tiên).
*(bổ sung 03/10/2026, FE-4b-03, D-72)* **Ô chọn toạ độ** `CoordinatePicker` (`@/components/map`) dùng chung cho yêu cầu giao, điểm giao
thêm tay, kho xuất phát: giá trị là **chữ** của hai ô vĩ độ / kinh độ (`CoordinateText`), đổi thành số bằng `parseCoordinates` (thuần, trả
mã lỗi theo ô; nhận dấu chấm lẫn dấu phẩy); form giữ một trường `{ lat, lng }` qua `Controller` và chặn lưu bằng cùng hàm đó, câu lỗi của
từng ô do ô chọn toạ độ tự hiện (sau khi con trỏ rời nhóm ô, hoặc `showErrors` khi form đã bấm lưu). Ba lối nhập: danh sách **địa danh
mẫu** (`SEED_PLACES` ở `seed-places.ts` — 70 tỉnh, quận, khu công nghiệp, **toạ độ gần đúng ở mức khu vực**; tìm bỏ dấu `searchPlaces`,
combobox + listbox), gõ tay, và bấm lên bản đồ (`CoordinatePickerMap`, chunk lười) **chỉ khi có `VITE_GOONG_MAPTILES_KEY` và WebGL** —
không có khoá thì chỉ danh sách. Tìm địa chỉ đi qua `places-api.ts` (`searchAddress`, "chưa có ở BE", Q-20): trình duyệt không gọi Goong.
*(bổ sung 03/10/2026, FE-4b-04, D-73, D-76)* **Lập chuyến**: `Trip` có `departureAt` (ISO) và `depot` (`CompanyDepot`, mặc định kho của
công ty); `scheduledDate` luôn là ngày của `departureAt` theo giờ Việt Nam — đổi giờ xuất phát thì ngày chạy theo, chỉ đổi ngày thì giữ giờ
trong ngày; hai trường không làm phương án lỗi thời; kho đang xếp còn đổi giờ, không đổi kho đi (`TRIP_INVALID` khi giờ không đọc được
hoặc kho thiếu tên / toạ độ). Form chuyến nhập ngày + giờ theo giờ Việt Nam (`departureAtOf`) và **không nhập điểm giao khi tạo**; form
sửa chỉ đổi chữ của điểm đang có (điểm tự sinh khoá tên và địa chỉ). **Điểm giao tự sinh** (`trip-stops.ts`, thuần): đưa yêu cầu vào chuyến
(`assignDeliveryRequirement(requirementId, tripId)`) gộp vào điểm có cùng khoá `stopKey` — địa chỉ chuẩn hoá (chữ thường, bỏ dấu câu, gộp
khoảng trắng, **giữ dấu tiếng Việt**) + toạ độ tới 5 chữ số lẻ; chưa có toạ độ là một giá trị riêng — không có thì sinh điểm `generated`
cuối tuyến (mã `STOP-NN` kế tiếp). `DeliveryStop` thêm `lat?` / `lng?`, `generated?`, `deadline?`, `priority?`: hạn = hạn sớm nhất, ưu
tiên = cao nhất của các yêu cầu có dòng kiện ở điểm, kho ghi lại (`withStopDemands`) mỗi khi yêu cầu vào / rời chuyến, đổi hạn hay ưu
tiên, hoặc dòng kiện / thứ tự điểm đổi. Gỡ yêu cầu hoặc bỏ kiện: điểm `generated` không còn dòng kiện nào tự mất, kiện ở các điểm sau
đánh số lại; điểm thêm tay (Chi tiết chuyến → "Thêm điểm giao", `StopFormDialog`, `trip-stops-api.ts`) ở lại và không có hạn. Chuyến chưa
có điểm giao thì chưa gõ / nhập kiện tay được. *(đã điều chỉnh 03/10/2026, FE-4b-09)* Thêm, bớt điểm sau khi đã tối ưu tuyến đưa
chuyến về Nháp (mục "Dữ liệu dùng chung và tối ưu"). Khách của danh bạ seed (`seed-directory.ts`) có **toạ độ mẫu gần đúng ở mức khu vực**
lấy theo địa danh mẫu — trừ Điện máy Xanh Tân An, để chuyến nháp `TRIP-014` giữ một điểm chưa có toạ độ; hai khách của chuyến nháp Phương Nam
cũng chưa có.
*(bổ sung 03/10/2026, FE-4b-05, D-68 đường 2)* **Kiện Đã nhập đưa thẳng vào chuyến**: `addTripPackages(tripId, packageIds, target)` (điểm
đang có hoặc điểm tay mới), `removeTripPackage`, `listTripPackages` (kèm đường vào chuyến `REQUIREMENT | POOL | TRIP`) ở `db-trip-pool.ts`;
kiện phải `IMPORTED`, không cờ, không thuộc yêu cầu nào; sang `ASSIGNED`, không có hạn; bỏ khỏi chuyến về `IMPORTED`. Liên kết dòng mang
`fromPool`: sửa dòng chỉ đổi `stopId` của kiện, không ghi đè mã, kích thước, điểm đến. Lớp API `trips/trip-pool-api.ts` → `useTripPoolQuery.ts`
(khoá `['trips', tripId, 'pool-packages']`); Chi tiết chuyến có thẻ "Kiện đưa thẳng từ kho kiện" và hộp thoại `PoolPackagePicker` (ô chọn
điểm chỉ liệt kê điểm tay). Nhật ký: `trip.packagesAdded`, `trip.packageRemoved`. Kiện khác loại hàng của chuyến theo luật phân tách hàng
bên dưới (FE-4b-06).
*(bổ sung 03/10/2026, FE-4b-06, D-74)* **Phân tách hàng — một chuyến một loại hàng.** Luật thuần ở `domain/constraints/segregation.ts`:
`segregation(dòng kiện, xe)` trả loại đang khoá (loại của dòng kiện đầu tiên; dòng không ghi loại là `STANDARD`; chuyến rỗng là `null` — khoá
tự tính lại), nhóm theo loại, xung đột (mọi dòng khác loại đang khoá) và cảnh báo xe `HAZARDOUS_VEHICLE_REQUIRED` (có hàng nguy hiểm) ·
`REFRIGERATION_MISSING` (có hàng lạnh mà xe không có vật cản `COOLING_UNIT` — đề xuất D-74, chờ nhóm xác nhận); `addedConflicts` so trước /
sau. Kho kiểm **ở mọi lối kiện vào chuyến** qua một hàm `settleSegregation` (`db-trip-segregation.ts`), gọi trước khi ghi: đưa yêu cầu giao
vào chuyến, đưa kiện kho kiện thẳng vào chuyến, gõ / nhập / sửa / nhân bản dòng kiện (`updateTrip`), tạo chuyến có sẵn kiện. Có xung đột
**mới** mà chuyến chưa có lý do và nơi gọi không đưa lý do: `CARGO_SEGREGATION_CONFLICT { tripId, lockedClass, packages }` (mã của bên gửi
với kiện kho kiện, mã dòng với kiện gõ tay), không ghi gì. Nơi gọi đưa `overrideReason` (bắt buộc — `REASON_REQUIRED`; tối đa 500 ký tự —
`OVERRIDE_REASON_TOO_LONG`): kho lưu `Trip.overrideReason` và ghi `trip.segregationOverridden` (lý do, loại đang khoá, số kiện khác loại);
chuyến đã có lý do thì kiện khác loại thêm sau đi tiếp; chuyến hết kiện khác loại thì kho gỡ lý do. `getTripSegregation` đọc,
`overrideTripSegregation` ghi / sửa lý do cho xung đột đang có (chỉ khi còn lập kế hoạch). Kiểm tra sẵn sàng tối ưu có mục `CARGO_SEGREGATED`:
xung đột chưa có lý do là chưa đạt, đã có lý do là cảnh báo. Lớp API `trips/segregation-api.ts` → `useSegregationQuery.ts` (khoá
`['trips', tripId, 'segregation']`); `assignRequirementToTrip`, `addTripPackages`, `savePackage`, `importPackages` nhận thêm `overrideReason`.
UI: thẻ "Phân nhóm hàng" (`SegregationCard`, cột phải Chi tiết chuyến, mọi pha) và hộp vượt luật `SegregationOverrideDialog` dùng chung qua
`useSegregationGuard`: lần ghi bị từ chối vì xung đột mở hộp thoại, lưu lý do là gọi lại đúng lần ghi đó kèm lý do — mở từ một hộp thoại có
`<form>` thì đặt **ngoài** form đó.
*(đã điều chỉnh 03/10/2026, FE-3b-07, D-68)* **Kiện thêm ngay trong chuyến tự vào kho kiện**: sau mỗi lần ghi dòng kiện hay điểm giao của
chuyến (`createTrip`, `updateTrip`, gỡ yêu cầu giao khỏi chuyến), `syncTripPool` (`db-trip-packages.ts`) giữ cho mỗi instance của dòng (`quantity`) một bản
ghi `Package` nguồn `TRIP`, `ASSIGNED`, kèm chuyến và điểm giao, mã QR thật cấp ngay; `packageCode` là mã instance (`PKG-001-07`), điểm đến
là địa chỉ điểm giao, loại hàng lấy `handlingClass` của dòng (vắng là `STANDARD`). Tăng số lượng tạo thêm kiện; giảm số lượng hoặc xoá dòng
trả kiện về `IMPORTED` (rời chuyến và điểm giao); sửa kích thước, loại hàng hay điểm giao của dòng thì kiện đổi theo, mã QR giữ nguyên.
Không ghi sự kiện nhật ký riêng — `trip.created` / `trip.updated` đã nói. Liên kết instance ↔ kiện nằm ở `DbState.tripPackageLinks` (ngoài
`Trip`, kiện thứ i là instance thứ i của dòng); dòng của yêu cầu giao dùng kiện của yêu cầu (liên kết mang `requirementId` — *đã điều chỉnh 03/10/2026, FE-4b-04*), dòng của yêu cầu bị sửa số lượng thì
được cấp kiện riêng. **Mã băm theo chuyến + kiện (`hashedQrToken`) đã bỏ**: nhãn của chuyến (`tripLabels`), quét khi xếp / dỡ, in nhãn và tra
cứu đều dùng mã QR của kiện kho kiện; tiến độ chuyến ghi trạng thái cho cả kiện nguồn `TRIP` (`lineInstances`). Seed: kiện của 15 chuyến
Long Bình và 2 chuyến Phương Nam dựng bằng cách chạy lại các mốc của chuyến qua chính hàm của kho (`seed-trip-pool.ts`) — 2.863 + 70 kiện,
mã `PK-T…` / `PK-PN-T…` (`nextId` không tính: mã kế tiếp vẫn `PK-0089`), đứng **trước** kiện có từ trước nên bảng kho kiện vẫn mở đầu bằng
`PK-0088`; kho kiện Long Bình có 2.951 kiện. Mẫu nhập kiện trong chuyến thêm cột cuối tuỳ chọn `handlingClass` (mã hoặc nhãn vi / en, lỗi
`HANDLING_CLASS_INVALID`), form kiện có ô "Loại hàng" — chỉ ghi vào kiện khi người dùng chọn, để lưu lại một kiện cũ không làm phương án lỗi
thời; bảng kiện của chuyến có nút "In nhãn QR" (`labels.print`) mở `/kien-hang/nhan?chuyen=<mã>`.
*(đã điều chỉnh 03/10/2026, FE-3b-04)* **Loại hàng** `HandlingClass` (`STANDARD | FRAGILE | REFRIGERATED | HAZARDOUS | HIGH_VALUE`) khai ở
`domain/models/package.ts`; `CargoPackage` mang thêm `handlingClass?` — trường đầu tiên ngoài type Spec (D-04 "không thêm trường" đã bị
thay), khai tường minh trong `spec-contract.test.ts`. `cargoFromPackage(pkg, packageType?)` dựng dòng kiện Spec từ kiện kho kiện: có loại
kiện thì lấy hướng đặt, xếp chồng, tải trên của loại; không có thì mặc định theo loại hàng (`FRAGILE` không cho đè lên, loại khác chịu ba
lần khối lượng của nó). Nhãn loại hàng, trạng thái và cờ kiện khai một lần ở nhánh `common` (`handlingClasses`, `packageStatuses`,
`packageFlags`); chip loại hàng là `components/HandlingClassChip` — tint theo nghĩa (thường slate, bốn loại cần chú ý amber), nhận ra bằng
icon và chữ.
*(bổ sung 03/10/2026, FE-5b-01, D-78, D-79)* **Giới hạn theo loại xe và loại kiện.** Loại xe (`VehicleType`) thêm `frontAxleLimitKg?`,
`rearAxleLimitKg?` (để trống là chưa khai) và `maxCogOffsetRatio` (mặc định 0,15, trong (0, 0,5]; form `/doi-xe/loai-xe` nhập bằng %,
`vehicle-type-form.ts`). `VehicleConfig` có ba trường cùng tên, **ngoài type Spec** (khai ở `spec-contract.test.ts`): kho lưu xe không
kèm giới hạn và **ghép giới hạn của loại xe đang gắn lúc đọc** (`listVehicles`, `getVehicle` → `withTypeLimits`, `vehicle-limits.ts`),
nên request tối ưu và revision chụp đúng giới hạn lúc chạy; xe chưa gắn loại không có trường nào — tải trục so với
`axles[].maxLoadKg`, trọng tâm dùng `DEFAULT_MAX_COG_OFFSET_RATIO`. Sửa giới hạn của loại, hoặc gắn / gỡ loại làm **giới hạn hiệu lực**
của xe đổi (`sameLimits`), làm phương án của chuyến đang lập kế hoạch với xe đó lỗi thời, như khi sửa xe. Loại kiện (`PackageType`)
thêm `maxStackWeightKg`, `rotationAllowed`, `fragile` — hình chiếu của `maxTopLoadKg` / `stackable`, `allowedOrientations`,
`fragilityLevel`, kho ghi lại mỗi lần lưu (`backendLimitsOf`); chiều backend → Spec là `specFieldsOf` (`package-type-limits.ts`). Form
loại kiện có công tắc "Cho phép xoay kiện": bật khi còn hơn một hướng đặt, tắt đưa hướng đặt về riêng `LWH`.
*(bổ sung 03/10/2026, FE-5b-04, D-79)* **Ngưỡng ràng buộc.** Trọng tâm hàng (`checkCenterOfGravity`): lệch ngang `COG_LATERAL` và lệch
dọc `COG_LONGITUDINAL` (kèm phía bị dồn về) khi vượt `maxCogOffsetRatio` × chiều rộng / chiều dài lòng thùng; `COG_HIGH` giữ ngưỡng nửa
chiều cao (`COG_HEIGHT_RATIO`); cả ba là cảnh báo, không chặn Duyệt — hằng số 10 % của D-36 đã bỏ. Diện tích tựa tối thiểu mặc định
**0,7** ở một chỗ (`DEFAULT_MIN_SUPPORT_RATIO` của `domain/constraints`): dòng kiện dựng từ loại kiện / kiện kho kiện, kiện mới của form
và file nhập thiếu cột; kiện seed giữ số đã khai. Lý do chưa xếp thêm `CONSTRAINT_VIOLATED` kèm `violatedConstraints` (issue đủ mã +
tham số, dịch bằng `formatIssue` ở danh sách "Kiện chưa xếp"); mock dùng nó khi đặt kiện vào chỗ tìm được sẽ làm một nhóm trục vượt
giới hạn (`AXLE_OVERLOAD`) — xe không khai trục không có kiểm này. Thêm mã ràng buộc vẫn theo lối cũ: `CONSTRAINT_CODES`, `issues`
vi / en, một mẫu trong `issue-message.test.ts`.
*(đã điều chỉnh 03/10/2026, FE-3b-03, FE-3b-02)* **Màn Kho kiện** (`features/package-pool`): `package-pool-api.ts` → `usePackagePoolQuery.ts`,
khoá `['package-pool', 'list' | 'detail' | 'labels', …]` và `['package-types']`; tạo kiện, nhập file, gỡ cờ làm mới `['package-pool']`,
`['package-types']`, `['requirements']`. Bảng (`PackagesPage` + `PackagesTable`, hàm thuần `packages-list.ts`): mới nhất trước; tab trạng thái
`trang-thai` và ba bộ lọc `loai-hang`, `co`, `gan` (đã / chưa vào yêu cầu giao hay chuyến) là slug trên URL; bấm dòng mở `PackageDetailPanel` (mã QR,
cờ, lịch sử), panel mở thì bảng bỏ bốn cột đã có trong panel. **Lịch sử kiện** là `Package.history` do kho ghi ở đúng chỗ đổi kiện (tạo,
`movePackage`, gắn / gỡ cờ) — màn không suy từ nhật ký; `fetchPackageDetail` ghép tên người làm. Đăng ký theo loại kiện / theo số lượng đã bỏ:
"Thêm kiện" là form một kiện (`package-form.ts`, lỗi là mã). **Nhập file** (`package-pool-import.ts`, hàm thuần trả mã): cột `package_code,
length, width, height, weight, handling_class, destination` + tuỳ chọn `package_type`, tìm theo tiêu đề vi / en, đơn vị cm / kg; lỗi file là mã
`dataErrors` (`UNSUPPORTED_FILE_TYPE`, `EMPTY_FILE`, `FILE_TOO_LARGE` 10 MB, `BATCH_TOO_LARGE` 1.000 dòng, `IMPORT_COLUMNS_MISSING`); lỗi dòng
kèm số dòng của file (tiêu đề là dòng 1): `PACKAGE_CODE_REQUIRED`, `INVALID_DIMENSION`, `INVALID_WEIGHT`, `INVALID_HANDLING_CLASS`,
`DESTINATION_REQUIRED`, `DUPLICATE_PACKAGE_CODE`, `PACKAGE_TYPE_NOT_FOUND`; cảnh báo `PACKAGE_CODE_EXISTS` không chặn. Còn một dòng lỗi thì nút
Xác nhận vô hiệu và `confirmPackageImport` từ chối `PACKAGE_IMPORT_INVALID`; xác nhận gọi `createPackages(rows, 'IMPORT')` một lần, nhật ký
`package.importConfirmed` (thêm lẻ là `package.created`). Tìm nhanh: nhóm `pool` theo `packages.view`.
*(đã điều chỉnh 03/10/2026, FE-3b-05, D-71)* **Nhãn in** (`PackageLabel`, khổ ở `label-sheet.ts`): in bằng trình duyệt, A4 dọc lề 10 mm, **bốn
nhãn mỗi trang** (2 × 2, khe 4 mm), mỗi nhãn 93 × 134 mm — khổ PDF của backend chưa chốt. Nhãn có mã QR kèm mã chữ, mã của bên gửi, loại
hàng, kích thước (cm), khối lượng (kg), điểm đến, mã của kho kiện, logo `mono`, tên loại kiện (nếu có) và công ty; kiện `FRAGILE` thêm khung
"Hàng dễ vỡ". Không nền màu (in đen trắng), chữ dài xuống dòng chứ không cắt. Mọi cỡ trong nhãn là `em` của cỡ chữ gốc — bản in gốc 4 mm, bản
xem trên màn gốc 16 px — nên hai bản một bố cục. Trang nhãn đọc kiện từ URL: `?kien=<mã,…>` hoặc `?chuyen=<mã chuyến>`; không chọn gì thì
không có nhãn nào (không còn "in tất cả"). In lại giữ nguyên mã QR. Nút quay lại về nơi bấm in (`labelsBackTarget`): chuyến, Tra cứu kiện
(`&tu=tra-cuu`), không thì Kho kiện; người không mở được đích đó về Tra cứu kiện.
*(đã điều chỉnh 03/10/2026, FE-3b-06, D-63, D-92)* **Tra cứu kiện** `/tra-cuu-kien` (`PackageLookupPage`, hàm thuần `package-lookup.ts`): quét
bằng `QrScanDialog` (`scanPackage` → `GET /api/packages/scan/{qrToken}`) hoặc gõ mã QR / mã của bên gửi / mã của kho (`lookupPackages`, khớp
đúng cả mã, không phân biệt hoa thường). Mã đang tra nằm trên URL (`?ma=`, kiện đã chọn `&kien=`). Một kiện: thẻ kiện (mã, kích thước, khối
lượng, loại hàng, điểm đến, trạng thái, cờ, chuyến và điểm giao); nhiều kiện trùng mã của bên gửi: danh sách để chọn; không khớp, hoặc là
kiện của công ty khác: "Không tìm thấy" (`QR_UNKNOWN`), không lộ dữ liệu. Hành động theo vai trò (`lookupActions`): "In lại nhãn"
(`labels.print`); điều phối viên gỡ cờ, mở kiện ở Kho kiện và mở chuyến; nhân viên kho **quét** thấy kiện mang cờ "Không tìm thấy" thì cờ được
gỡ ngay, **gõ mã** thì thẻ có nút "Đã tìm thấy kiện này" — cả hai gọi `reportPackageFound` (chỉ vai trò kho, chỉ cờ `NOT_FOUND`), kho ghi sự
kiện `package.found` và điều phối viên thấy ở chuông. "Quét mã QR" là nút chính của màn. Màn nằm trong khung ứng dụng; nhân viên kho
(`warehouse.operate`) được nút, ô nhập 56 px, chữ từ 16 px và nút "Về màn kho" trên dải trời.
Mã QR là chuỗi
ngẫu nhiên `LM-XXXX-XXXX-XXXX` (Crockford base32) không chứa dữ liệu kiện, cấp cho mọi kiện kho kiện — kể cả kiện thêm trong chuyến.
Dưới Vitest mã QR mới sinh từ bộ số có hạt giống (tất định); app dùng `Math.random`.
*(bổ sung 03/10/2026, FE-6-03, FE-6-04, D-83)* **Đối chiếu kiện ba mức** — một hộp `components/PackageVerify` dùng chung cho kho và tài
xế (soạn hàng, nhận dọc đường nối sau): (1) quét QR (`QrCamera` của `QrScanDialog`); (2) gõ mã — mã QR in dưới hình, hoặc **mã của bên
gửi khi nó duy nhất trong chuyến** (trùng: `PACKAGE_CODE_AMBIGUOUS`; luật thuần `resolveVerifyCode`); (3) xác nhận tay — chọn kiện + lý do
(`MANUAL_CONFIRM_REASONS`: nhãn rách / mất, QR không đọc được, khác kèm ghi chú bắt buộc), kho in lại được nhãn của kiện (`loadingLabelPath`,
mã QR giữ nguyên, nút quay lại về đúng phiên xếp). Hộp không biết kiện nào đúng: nơi gọi gửi mã / kiện cho kho và trả kết quả về (`result`
là vùng `status` / `alert`); nút 56 px, chữ 16 px. `QrScanDialog` chỉ còn quét + gõ mã cho Tra cứu kiện — danh sách chọn tay không lý do
đã bỏ. Kho ghi **mỗi lần đối chiếu** vào `Trip.verifications` (`PackageVerification`: bước `LOADING` / `UNLOADING`, cách `QR` / `CODE` /
`MANUAL`, người, thời điểm; mã `VF-NNN` trong chuyến); `steps[].via: 'qr'` và `qrConfirmedIds` vẫn nghĩa là "đã đối chiếu bằng nhãn" (quét
hoặc gõ). Hàm của kho: `confirmLoadingByQr` / `confirmUnloadByQr` nhận thêm `method`; `confirmLoadingManually` / `confirmUnloadManually` ghi
kiện như đã xếp / đã dỡ để làm tiếp, kèm xác nhận tay `MANUAL_PENDING`. **Kho tự chặn** (giao diện bị bỏ qua cũng không qua):
`completeLoading` và `completeStop` từ chối `MANUAL_CONFIRM_PENDING` khi còn xác nhận tay chờ của bước xếp / của điểm đó — lớp `-api.ts` của
kho không tự hoàn tất xếp khi còn chờ, màn hiện nút mờ kèm lý do. Điều phối viên (`manualConfirm.approve`; kho kiểm vai trò:
`ROLE_NOT_ALLOWED`) duyệt — `approveManualConfirmation`, kiện giữ kết quả — hoặc từ chối kèm lý do bắt buộc — `rejectManualConfirmation`,
kết quả xếp / dỡ của kiện bị gỡ nên bước hiện tại của kho quay về đúng kiện đó và dòng kiện của tài xế về "chưa dỡ" kèm lý do
(`rejectedConfirms`). Xác nhận tay còn chờ bị thay khi kiện được đối chiếu lại bằng nhãn, và bị bỏ khi kiện được ghi lại không qua đối
chiếu (bước xếp ghi tay, bỏ đánh dấu đã dỡ). Thẻ "Xác nhận tay chờ duyệt" đứng đầu cột chính của Chi tiết chuyến
(`trips/ManualConfirmCard`, `manual-confirm-api.ts` → `useManualConfirmQuery.ts`, khoá `['trips', tripId, 'manual-confirms']`): kiện, bước,
người gửi, lý do, thời điểm; người chỉ xem thấy danh sách không có nút. Nhật ký: nhóm `manualConfirm` (`requested`, `approved`, `rejected`),
đối tượng là chuyến. *(đã điều chỉnh 03/10/2026, FE-6-05, FE-6-06)* Không còn lối ghi không đối chiếu: nút "Xác nhận đã xếp" của kho, ô đánh
dấu dỡ của tài xế và hai hàm `recordLoadingStep`, `recordUnload` của kho đã bỏ. Bước đối chiếu có thêm `STAGING` (soạn hàng).
*(bổ sung 03/10/2026, FE-6-02, FE-6-05, FE-6-06, FE-6-07, D-82, D-84, D-91, D-92)* **Soạn → xếp → giao, và chuyển ngược**. Kho giữ luồng
dù giao diện bị bỏ qua:
- **Soạn hàng** (`db-staging.ts`, `StagingStepPage`): `startLoading` đưa chuyến sang Đang xếp hàng ở bước soạn (`loading.stagedIds`); kho
  đối chiếu từng kiện vào khu chờ, không cần thứ tự (`confirmStagingByQr` — quét lại kiện đã soạn trả `alreadyStaged`, không ghi;
  `confirmStagingManually`); mã ngoài chuyến là `PACKAGE_NOT_IN_TRIP`. "Báo thiếu" (`reportStagingShortage`) ghi `loading.shortages`, dòng
  phụ "Thiếu kiện — chờ điều phối"; điều phối viên quyết ở thẻ "Kiện kho báo thiếu" của Chi tiết chuyến (`trips/MissingPackagesCard`,
  `shortage-api.ts`, theo `trips.edit`; kho kiểm vai trò): `resolveStagingShortage` `KEEP_SEARCHING` đóng báo thiếu, `DROP` bỏ kiện khỏi
  chuyến. Soạn đủ mới xếp được (`STAGING_INCOMPLETE`); bước của chuyến là `loadingStep` (còn kiện chưa soạn là soạn).
- **Xếp** theo `loadingOrder`, mỗi kiện phải đối chiếu (sai kiện / sai thứ tự: `WRONG_PACKAGE_SCANNED`). "Kiện hỏng"
  (`reportDamagedPackage`, kiện của bước hiện tại): trong **phương án** không kiện nào tựa lên nó (`restingOnIds` của domain) thì kiện bị
  bỏ lại kho — bước ghi `outcome: 'damaged'`, kho xếp tiếp, tài xế không phải dỡ (`leftOutIds` thay `missingIds`) —; có kiện tựa lên thì
  chuyến quay về Đã lập kế hoạch. Xong xếp khi mọi kiện đã soạn, đã có kết quả và không còn xác nhận tay chờ (`LOADING_INCOMPLETE`,
  `MANUAL_CONFIRM_PENDING`). Thẻ hướng dẫn nói vùng của kiện ("Vùng <điểm giao> — sát cửa", `zonePlace`).
- **Chuyển ngược `LOADING → PLANNED`** (`db-replan.ts`): kiện bị bỏ rời hẳn chuyến (dòng kiện bớt một, `inputVersion` tăng → phương án
  lỗi thời), về `IMPORTED` kèm cờ, vẫn do yêu cầu giao của nó giữ (yêu cầu đọc ra giao thiếu); chuyến bỏ tiến độ và các lần đối chiếu của
  phiên, mang `Trip.replan` (lý do, có phải dỡ ra không) để kho thấy "Chờ điều phối tối ưu lại". Kiện đã soạn giữ `STAGED`: bắt đầu lại
  thì vẫn tính là đã soạn.
- **Tài xế**: "Xuất phát" (`startDelivery`, chỉ khi xếp xong) → mỗi điểm "Đã đến" (`arriveAtStop` ghi `StopProgress.arrivedAt`) rồi mới
  dỡ, báo sự cố theo kiện và hoàn tất điểm (`STOP_NOT_ARRIVED`); dỡ chỉ qua hộp đối chiếu; "Khách từ chối" bỏ dấu đã dỡ của kiện — kiện
  ở lại xe, thành `RETURNED` khi hoàn tất điểm. Một nút chính theo bước: Xuất phát → Đã đến điểm n → Hoàn tất điểm giao.
- **Huỷ chuyến** (`cancelTrip`): từ Nháp, Đã lập kế hoạch, Đang xếp hàng — kiện về `IMPORTED`, yêu cầu giao về `PENDING`; huỷ lúc
  đang xếp thì sự kiện mang `loaded` (số kiện đã lên xe) và kho được báo dỡ ra. *(đã điều chỉnh 03/10/2026, FE-6-07)* Chuyến **Đang vận
  chuyển** huỷ được **chỉ khi có sự cố cấp chuyến chưa xử lý** (`OPEN` hoặc `ESCALATED`; `canCancelTrip` — kho và hộp thoại dùng cùng
  hàm): kiện chưa giao (còn `IN_TRANSIT`, kể cả kiện đã dỡ ở điểm chưa hoàn tất) thành `RETURNED` và **ở lại chuyến**, yêu cầu giao giữ
  `IN_TRIP` và đọc là "Giao thiếu" (D-92), vị trí xe ghi bù tới lúc huỷ rồi dừng, sự kiện `trip.cancelled` mang `returned` (số kiện hoàn
  trả) — quản lý công ty thấy ở chuông; sự cố chưa xử lý ở lại như đã ghi. Trạng thái khác (Đang vận chuyển không có sự cố đang mở, Đã
  giao, Đã huỷ): `INVALID_TRIP_STATUS_TRANSITION`. Menu thao tác của Chi tiết chuyến có mục "Huỷ chuyến" cho chuyến Đang vận chuyển; hộp
  thoại đọc sự cố của chuyến và hoặc nói bao nhiêu kiện thành Hoàn trả, hoặc để nút huỷ mờ kèm lý do.
- *(bổ sung 03/10/2026, FE-6-14)* **Báo cáo chuyến** (`tripReport(trip, plan, { exceptions, reroutes })`, thuần): mỗi điểm giao có giờ
  đến dự kiến của tuyến (`routePlan`), giờ đến thật (`arrivedAt`), hạn giao kèm mức hạn — đã đến thì "Đến kịp hạn" / "Đến trễ hạn" theo
  giờ đến thật, chưa đến thì mức hạn của tuyến — và số kiện hoàn trả; thêm số kiện đã soạn, bảng cách đối chiếu theo bước (lần đối
  chiếu mới nhất của từng kiện), xác nhận tay kèm người gửi và người duyệt, sự cố cấp chuyến (chuyển quản lý, gia hạn, xử lý), tuyến đã
  đổi (`listTripReroutes`, MOCK RESULT), lý do chở chung khác loại hàng. Chuyến bị huỷ lúc đang vận chuyển: kiện của điểm chưa hoàn tất
  tính là hoàn trả, "đã giao" chỉ tính điểm đã hoàn tất. Menu thao tác hiện mục "Báo cáo chuyến" cho **mọi người xem được chuyến** (quản
  lý công ty mở từ đây) khi chuyến đã giao hoặc bị huỷ lúc đang vận chuyển; sửa, đổi xe, huỷ vẫn theo `trips.edit`. Bản in: chữ dài
  xuống dòng (`print:line-clamp-none`), không cắt.
- Seed: mọi chuyến đã ở kho đều soạn đủ và mọi kiện đều đối chiếu bằng quét; kiện "thiếu" của `TRIP-003` nay là kiện hỏng ở bước 16
  (`PK-T00730`, cờ `DAMAGED`); điểm đã tới có `arrivedAt`. Test và E2E đưa chuyến qua các bước bằng `src/test/trip-flow.ts`
  (`stageAll`, `loadAll`, `loadTrip`, `unloadStop`) — E2E gọi qua `e2e/operations-helpers.ts`.

### Dữ liệu dùng chung và tối ưu *(bổ sung 15/09/2026, D-06, D-30, D-31)*

- Dữ liệu đi qua nhiều màn (xe, chuyến, kiện, revision kết quả) nằm trong **mock repository
  in-memory** (`src/lib/mock-db/`, LM-026) → `features/<tên>/<tên>-api.ts` → hook TanStack Query.
  Ghi bằng `useMutation` rồi invalidate. Không thêm store client (Zustand, Redux, Context giữ dữ liệu nghiệp vụ).
- Tối ưu đi qua interface `OptimizationService` (`src/services/optimization`). Hiện có mock chạy trên luồng gọi
  (`MockOptimizationService`), trong Web Worker (`WorkerOptimizationService`) và bản giả lập sự cố
  (`UnavailableOptimizationService`); API thật sau này thay tại `-api.ts`, UI không đổi. Kết quả mock luôn
  `isMockResult: true`.
  Mock thuần là `runMockOptimization` (tất định theo request + `randomSeed`, `runtimeMs` qua `clock` tiêm vào);
  `FAILED` chỉ khi request sai schema hoặc có lỗi toàn cục — contract không có `warnings`, nên UI chạy `validateRequest`
  trước khi gọi. `message` của kiện chưa xếp là `reasonCode`, UI dịch mã (LM-024).
- *(bổ sung 03/10/2026, FE-5b-02, D-79)* **Vùng theo điểm giao và số lần dỡ-xếp lại.** Hàm thuần `stopZones(vehicle, stops)`
  (`@/domain/zones`): chiều dài vùng i = (L − (n − 1) × 10 cm) × tỷ lệ thể tích hàng của điểm i, giữa hai vùng liền nhau có đệm
  10 cm; `stops` theo thứ tự giao — điểm đầu sát cửa (X lớn), điểm cuối sâu nhất (X = 0). Mốc tính cộng dồn từ vách trong, làm tròn
  0,1 cm, mốc cuối đặt đúng L: tổng vùng + đệm luôn bằng L. `stopId` của vùng là **số điểm giao** (`CargoPackage.deliveryStop`) vì
  request của Spec không mang mã điểm nào khác; `id` là `ZONE-<số điểm>`. **Vùng của một kiện là vùng chứa tâm kiện theo X**
  (`locateInZones`; tâm rơi vào đệm thuộc vùng gần hơn, đúng giữa thì vùng sâu hơn); kiện có vùng khác vùng của điểm giao mình là
  **một lần dỡ-xếp lại** (định nghĩa của backend; LIFO vẫn đếm riêng). Kết quả tối ưu thêm ba trường ngoài type Spec, khai ở
  `spec-contract.test.ts`: `result.stopZones`, `placement.stopZoneId`, `metrics.rehandlingCount` — vắng ở kết quả `FAILED` và kết quả
  dựng tay không chia vùng. Mock chia vùng theo thể tích các kiện **còn xếp được** (đã qua kiểm request và dành tải). Khi
  `enforceLifo`, mock xếp theo vùng, điểm cuối trước (`packShelves`): mỗi vùng một dải bắt đầu ở mép sâu của vùng; kiện không vừa
  vùng của mình xếp nhờ vào đuôi còn trống của vùng sâu hơn liền kề, hoặc tràn sang đầu vùng kế phía cửa — hai chỗ duy nhất không
  đặt kiện sau lưng hàng giao muộn hơn, nên **kết quả `enforceLifo` không bao giờ có `LIFO_BLOCKED`** (test thuộc tính 500 request
  kiểm). Vùng chia theo thể tích nên có điểm cần nhiều sàn hơn vùng của nó: còn kiện ở lại vì hết chỗ thì mock xếp lại với các dải
  lùi về phía vách trong vừa đủ (đo chiều dài từng điểm cần trên thùng trống), và cuối cùng là một dải liền như khi chưa có vùng;
  lấy lượt xếp được nhiều kiện nhất, hoà thì lượt bám vùng hơn — **mock không bao giờ xếp ít kiện hơn trước khi có vùng**. Không bật
  `enforceLifo` thì xếp theo thứ tự chọn như trước, vùng chỉ dùng để đo. Duyệt (`approvedResult`) ghi lại `stopZoneId` và đếm lại
  `rehandlingCount` theo các vùng của lần tối ưu, không chia lại vùng. Seed: 15 chuyến đều xếp đủ kiện như trước; bản đang hiện của
  chuyến chính `TRIP-2026-0914` không có kiện ngoài vùng; sáu chuyến có — `TRIP-005` 42 kiện, `TRIP-008` 40, `TRIP-011` 10, `TRIP-010` 8,
  `TRIP-009` 4, `TRIP-013` 4 — vì ở đó có điểm giao cần nhiều sàn hơn vùng chia theo thể tích của nó *(đã điều chỉnh 03/10/2026,
  FE-5b-05: số của phương án ít dỡ-xếp lại — bản seed duyệt; ở `TRIP-005` và `TRIP-013` nó chọn một dải liền có ít kiện ngoài vùng hơn
  cách xếp theo vùng, trước là 56 và 10)*.
- Kết quả là **revision bất biến** theo `jobId`. Duyệt tạo revision approved mới; sửa xe/kiện sau
  khi tối ưu làm revision lỗi thời và chặn Duyệt. Kho và tài xế chỉ đọc revision đã duyệt.
- *(bổ sung 03/10/2026, FE-5b-05, D-77)* **Ba phương án ứng viên mỗi lần chạy.** `OptimizationService.optimizeCandidates(request)` (ngoài
  Spec; `optimize(request)` của Spec giữ nguyên, một kết quả) chạy **một job** ra ba kết quả theo `PLAN_OBJECTIVES` của domain — `MAX_VOLUME`
  (A), `AXLE_BALANCE` (B), `MIN_REHANDLING` (C); nhãn suy từ mục tiêu (`PLAN_LABELS`), không lưu riêng. Mock thuần `runMockCandidates` (tất
  định theo request + seed; `jobId` của từng kết quả là mã job kèm nhãn, `MOCK-…-A`) dựng vài **cách xếp** trên cùng request
  (`candidate-layouts.ts`): *dồn sát* — một dải liền từ vách trong, không chừa vùng; *lùi về phía cửa* — dải liền đó bắt đầu cách vách trong
  một đoạn, tìm nhị phân trên lưới 5 cm điểm hàng thôi nặng đầu (hai nhóm trục cùng mức dùng — `balancedCenterXCm`; xe không đủ dữ liệu
  trục thì trọng tâm hàng về giữa thùng), chỉ thử khi lượt dồn sát nặng đầu và không thiếu chỗ; *theo vùng điểm giao* — `packShelves` của
  FE-5b-02. Rồi mỗi mục tiêu lấy cách tốt nhất **theo chỉ số của chính nó**: A cách xếp được nhiều thể tích nhất (hoà: nhiều kiện hơn,
  rồi cách dồn về vách trong hơn); B, trong các cách xếp được nhiều kiện nhất, cách lệch mức dùng giữa hai nhóm trục ít nhất
  (`axleImbalance`); C, trong các cách xếp được nhiều kiện nhất, cách ít kiện nằm ngoài vùng điểm giao nhất (hoà: cách theo vùng). **Không
  mục tiêu nào đổi kiện lấy chỉ số**, và **mock không sửa số cho khác đi**: hai mục tiêu chọn trùng một cách xếp thì hai phương án giống
  hệt nhau (hàng kín sàn, xe đã nặng đuôi, hàng vượt tải) và màn so sánh hiện đúng như vậy. Kiện đặt chỗ theo điểm giao khi `enforceLifo`,
  không bật thì theo thứ tự chọn; lượt theo vùng luôn theo điểm giao; cả ba không có `LIFO_BLOCKED` khi `enforceLifo` (test thuộc tính 300
  request, kèm "mỗi mục tiêu tốt nhất ở chỉ số của mình"). `runtimeMs` của từng phương án là thời gian kiểm request + lượt xếp của mục
  tiêu đó + phần domain tính cho nó. Ba phương án chạy trong **một worker** (`start-candidates`): tiến trình báo theo từng mục tiêu
  (`CandidateProgress`), huỷ hay hết giờ là bỏ cả ba, kho không lưu gì. Đo ở máy dev: 132 kiện 7 ms → 18 ms, 1.000 kiện 42 ms → 130 ms
  (một kết quả → ba phương án); cổng bench 1.000 instance ≤ 1 s áp cho cả job.
- *(bổ sung 03/10/2026, FE-5b-05)* **Lần chạy và revision của nó.** `saveOptimizationRun({ tripId, request, jobId, plans })` lưu mỗi phương
  án một revision bất biến mang `runId` và `run: { objective, algorithm }` (bản duyệt giữ của bản nguồn), theo thứ tự A · B · C — bản mới
  nhất chưa duyệt của chuyến là phương án C — cùng **một** lần chạy `OptimizationRun { algorithm, jobId, plans[] }` và **một** sự kiện
  `optimization.saved { runId, revisionId: 'REV-028, REV-029, REV-030' }`. Chỉ khi chuyến **Đã lập kế hoạch**: còn Nháp là
  `ROUTE_NOT_PLANNED`, đã sang pha vận hành là `TRIP_LOCKED`; `trip-readiness` thêm `ROUTE_PLANNED`, và Thiết lập tối ưu có nhóm kiểm tra
  "Tuyến" (lý do nằm trên nút Tối ưu, kèm lối về Chi tiết chuyến). `addRevision` giữ lối ghi **một** kết quả dựng tay (test, dữ liệu mẫu) —
  một lần chạy một phương án, không kiểm chuyến đã lập kế hoạch. Mục tiêu không còn là lựa chọn của lần chạy; thuật toán kho ghi là
  `EP_DBLF` (`OPTIMIZATION_ALGORITHMS` chỉ còn một mã tới FE-8-05), lần chạy hỏng chỉ mang thuật toán và mã lý do. Lớp API
  `runOptimization` (`optimization-api.ts`) trả `{ run, revisions }`; chạy xong màn mở `/chuyen/:id/so-sanh?lan-chay=<runId>`. Hộp thoại
  đang chạy có một dòng tiến trình cho mỗi phương án; "Kết quả một phần" chỉ báo khi **không phương án nào** xếp hết, kèm số kiện chưa xếp
  của phương án xếp được nhiều nhất. Bảng lần chạy (`RunHistoryCard`): mỗi lần chạy ba dòng phương án (mở Planner), liên kết "So sánh", và
  cột Duyệt nói phương án nào đã duyệt; lần chạy "chờ duyệt" là lần chạy chứa revision mới nhất chưa duyệt, không lỗi thời. Thẻ Tiến trình
  của Chi tiết chuyến tìm người chạy tối ưu theo `runId` của sự kiện.
- *(đã điều chỉnh 03/10/2026, FE-5b-08, D-80)* **Kho tự kiểm luật duyệt** — không tin giao diện. `approveRevision(revisionId, patches,
  { force })` áp draft (`approvedResult`) rồi chạy constraint engine trên **chính bản sẽ duyệt** (`approvalIssues` ở `revisions.ts` →
  `approvalBlockers` của domain): còn lỗi ràng buộc, `AXLE_OVERLOAD` hoặc `MUST_LOAD_UNPLACED` là `APPROVAL_BLOCKED { revisionId, count,
  codes }`; lỗi thời vẫn là `REVISION_STALE`. Qua được các lý do chặn, tuyến của chuyến (`Trip.routePlan`) có điểm `MISSED` mà không có
  `force` là `LATE_STOPS_UNCONFIRMED { tripId, stopIds, stopNumbers }`. **`force` chỉ là lời xác nhận cho điểm trễ hạn**: không gỡ được
  lý do chặn nào; có `force` thì sự kiện `revision.approved` ghi thêm `lateStops` (số điểm trễ hạn đã xác nhận). Điểm `AT_RISK` không
  đòi gì. Không lưu gì khi từ chối. Lớp API: `approveLoadPlan(revisionId, patches, { force })` ở `viewer3d/viewer-api.ts`.
- *(bổ sung 03/10/2026, FE-5b-08, D-80)* **Đổi xe của chuyến Đã lập kế hoạch.** Hàm thuần `vehicleFit(xe, dòng kiện)`
  (`domain/constraints/vehicle-fit.ts`) trả mã + tham số, chỉ kiểm **điều kiện cần** trên tổng hàng (không xếp thử): `CARGO_TOO_LARGE`
  (dòng kiện không có hướng đặt nào vừa lọt cửa kèm clearance vừa nằm trong lòng thùng), `CARGO_VOLUME_EXCEEDED`,
  `CARGO_WEIGHT_EXCEEDED`, `AXLE_CAPACITY_EXCEEDED` (tổng hàng nặng hơn phần hai nhóm trục còn nhận được: giới hạn − tải rỗng; xe chưa
  khai trục hoặc một nhóm chưa có giới hạn thì không kiểm) là **lỗi**; loại hàng là **cảnh báo** của luật phân tách hàng
  (`REFRIGERATION_MISSING`, `HAZARDOUS_VEHICLE_REQUIRED` — hiện ở dòng xe, không khoá xe, như D-74). Kho: `changeTripVehicle(tripId,
  vehicleId)` (`db-trip-vehicle.ts`) từ chối theo thứ tự — chuyến đã sang pha vận hành `TRIP_LOCKED`, còn Nháp `TRIP_NOT_PLANNED`, xe
  của công ty khác `FORBIDDEN_COMPANY`, trùng xe đang dùng `VEHICLE_UNCHANGED`, đang bảo dưỡng `VEHICLE_IN_MAINTENANCE`, đang chạy
  chuyến khác `VEHICLE_BUSY { vehicleId, tripId }`, có lỗi `vehicleFit` (trên xe đã ghép giới hạn của loại xe) `VEHICLE_UNFIT
  { vehicleId, reasons }`. Đổi xong `inputVersion` tăng — **mọi phương án của chuyến lỗi thời**, bản đã duyệt cũng phải tối ưu lại rồi
  duyệt; điểm giao không đổi nên `routePlan` và trạng thái Đã lập kế hoạch giữ nguyên. Nhật ký `trip.vehicleChanged { fields: 'vehicleId',
  before, after }` — mang `fields` như `trip.updated` để thanh lỗi thời (`staleReason`) đọc được lần đổi xe. Lớp API
  `trips/trip-vehicle-api.ts` (`changeTripVehicle`, `fetchVehicleChoices` — mọi xe kèm trạng thái và `vehicleFit`) →
  `useTripVehicleQuery.ts`, khoá `['trips', tripId, 'vehicle-choices']` (`staleTime: 0`); đổi xe làm mới `['trips', tripId]`,
  `['trips', 'list']`, `['dashboard']`, `['warehouse']`. UI: `ChangeVehicleDialog` theo `trips.edit` — mở từ mục "Phương tiện" và menu
  "Thao tác" của Chi tiết chuyến, và từ góc khung 3D của Planner (mục 7); mọi xe của công ty hiện kèm chip trạng thái, xe chọn được
  đứng trước, xe không chọn được **mờ kèm lý do ngay tại dòng** (xe đang dùng, đang phục vụ chuyến nào, bảo dưỡng, từng lỗi `vehicleFit`
  — nối vào ô chọn bằng `aria-describedby`); hộp thoại nói trước việc phương án sẽ lỗi thời. Chuyến **Nháp** vẫn đổi xe ở form sửa
  chuyến ("Đổi xe" của mục Phương tiện là liên kết tới form) — `updateTrip({ vehicleId })` chưa kiểm `vehicleFit`.
- *(LM-088)* Chi tiết chuyến chỉ cho sửa khi `can('trips.edit') && phase === 'planning'`; form sửa chuyến mở ở `planning`, `loading`,
  `loaded` (hai pha sau khoá xe và điểm giao). Lý do khoá hiện bằng `TripLockBanner` (chi tiết chuyến, Thiết lập tối ưu). Hộp thoại mở từ
  mục `DropdownMenu` dùng `modal={false}` cho menu để focus về đúng hộp thoại.
- *(bổ sung 19/09/2026, LM-081 → LM-083)* Kho lưu **pha** chuyến `planning → loading → loaded → delivering → completed` (+ `cancelled`);
  trạng thái hiển thị lấy qua `tripStatus(trip, revisions)` (pha `planning` vẫn suy từ revision). *(đã điều chỉnh 02/10/2026, FE-0-05,
  D-81)* `TripStatus` là 6 trạng thái của backend: `DRAFT`, `PLANNED`, `LOADING` (pha `loading`/`loaded`), `IN_TRANSIT` (`delivering`),
  `DELIVERED` (`completed`), `CANCELLED`. *(đã điều chỉnh 03/10/2026, FE-4b-09, PRD v2 mục 7.1)* Pha `planning`: chuyến **đã tối ưu
  tuyến** (`Trip.routePlan`) là `PLANNED`, chưa là `DRAFT` — `tripStatus(trip)` không còn đọc revision (luật tạm "có revision là
  `PLANNED`" của FE-0-05 đã bỏ). `optimizeTripRoute` (`db-trip-route.ts`, mock `@/domain/routing`, không tốn credit) cần ít nhất một điểm
  (`ROUTE_STOPS_REQUIRED`) và mọi điểm có toạ độ (`MISSING_STOP_COORDINATES { stopIds, stopNumbers }` — chỉ đúng điểm thiếu), xếp lại
  `Trip.stops` theo thứ tự đi và đánh số lại `deliveryStop` của dòng kiện (thứ tự đổi thì `inputVersion` tăng — phương án 3D lỗi thời),
  ghi `routePlan` (giờ đến dự kiến và mức hạn từng điểm theo đúng thứ tự `Trip.stops`, điểm trễ, km, phút, người và giờ bấm,
  `isMockResult`) và nhật ký `trip.routeOptimized`. Sau đó mọi lần ghi chuyến đi qua `withFreshRoute` (`trip-route.ts`, thuần): **thêm hoặc
  bớt điểm** (kể cả điểm tự sinh khi đưa yêu cầu vào chuyến, điểm tay của kiện kho kiện) hoặc một điểm mất toạ độ thì kho bỏ `routePlan` —
  chuyến **về Nháp**; đổi thứ tự điểm (kéo thả), giờ xuất phát, kho đi, hạn của điểm thì giờ đến và mức hạn tính lại, trạng thái không đổi.
  `getTripEta` đọc tuyến (`null` khi chưa tối ưu). Seed: mọi chuyến đã có phương án (và chuyến huỷ có đủ toạ độ) có `routePlan` theo đúng
  thứ tự điểm của seed, không ghi sự kiện; hai chuyến nháp và chuyến huỷ `TRIP-004` (điểm Tân An chưa có toạ độ) thì không — số chuyến theo
  trạng thái của seed giữ nguyên. *(đã điều chỉnh 03/10/2026, FE-5b-05)* Tối ưu xếp hàng đòi chuyến Đã lập kế hoạch (`saveOptimizationRun` → `ROUTE_NOT_PLANNED`); bắt đầu xếp ở kho thì kho chưa đòi.
  Lớp API `trips/route-api.ts` (`optimizeTripRoute`, `getTripEta`) → `useRouteQuery.ts` (khoá `['trips', tripId, 'eta']`); Chi tiết chuyến:
  `RoutePlanBar` đầu card sơ đồ tuyến (nút phụ "Tối ưu tuyến" theo `routes.optimize`, MOCK RESULT, km · thời gian, số điểm trễ; câu nói giờ
  đến là ước lượng theo đường nối thẳng), mỗi điểm có "Dự kiến đến" và mức hạn (Kịp hạn xanh lá · Sát hạn hổ phách · Trễ hạn dự kiến đỏ,
  luôn kèm chữ), điểm chưa có toạ độ mang nhãn "Chưa có toạ độ", bản đồ `RouteMap` dưới hàng điểm. Dòng phụ `tripSubStatus`, hiện bằng
  `TripSubStatusTag`: dưới `PLANNED` (và dưới `DRAFT` của chuyến đã có phương án mà chưa / không còn tuyến) là `awaitingApproval` ·
  `approved` · `stale` (theo revision hiển thị: bản duyệt mới nhất, không có thì bản mới nhất), dưới `LOADING` là `loading` đã ghi / tổng ·
  `loaded`; `tripRouteSubStatus` thêm `lateStops` khi tuyến có điểm trễ hạn dự kiến. Lọc/nhóm
  theo trạng thái; logic kho, tài xế và số "cần bạn xử lý" theo pha hoặc dòng phụ. Tab danh sách chuyến: Tất cả · Nháp · Đã lập kế hoạch
  (thêm số hổ phách: chờ duyệt + lỗi thời; *(đã điều chỉnh 02/10/2026, FE-0-04)* chữ và số "cần bạn xử lý" — ở dòng số dưới tiêu đề và trên
  tab — chỉ hiện với người có `plans.approve`, quản lý công ty chỉ thấy các số thường) · Đang xếp hàng · Đang vận chuyển · Đã giao · Đã huỷ; `trang-thai` trên URL là slug không dấu
  (`nhap`, `da-lap-ke-hoach`, `dang-xep-hang`, `dang-van-chuyen`, `da-giao`, `da-huy`), giá trị cũ (`da_duyet`, `hoan_thanh`, `sap-chay`,
  `dang_giao`…) đọc sang slug mới (`normalizeStatusFilter`). Từ `loading` trở đi xe/điểm giao/kiện,
  tối ưu và Duyệt bị từ chối `TRIP_LOCKED`. Tiến độ kho (`loading.steps`) và giao (`delivery.stops`, `issues`) chỉ ghi qua hàm vận hành
  của kho (`startLoading`…`completeStop`). Bảo dưỡng xe lưu ngoài `VehicleConfig` (`listVehicleStates`, D-04).
- Người dùng và mật khẩu nằm trong kho; kho giữ **phiên** như cookie server (`authenticate`, `restoreSession`) và mọi hàm ghi thêm
  một sự kiện nhật ký `{ action, actorId, companyId, target, params }` — không lưu câu chữ, UI dịch nhánh `audit`. Lỗi của kho (`MockDbError`)
  hiện cho người dùng qua `dataErrorMessage(error, t)` (nhánh `dataErrors`, key trùng mã).
- Seed neo theo ngày (D-44): `getMockDb()` neo hôm nay giờ Việt Nam, dưới Vitest và `createMockDb()` mặc định neo `SEED_ANCHOR_DATE`
  (14/09/2026) để test tất định. Chuyến chính `TRIP-2026-0914` luôn đứng đầu `listTrips` và giữ `REV-001`/`REV-002`; test so số
  của seed (tổng kiện, số xe…) phải cập nhật khi đổi `seed-trips.ts`. *(đã điều chỉnh 02/10/2026, FE-0-02)* Dữ liệu của Phương Nam
  (`seed-phuong-nam.ts`) nối **sau** dữ liệu của Long Bình và mang mã `…-PN-…`: thứ tự, mã và mã kế tiếp (`TRIP-015`, `VEHICLE-009`,
  `REV-028`…) của Long Bình không đổi; test đọc kho không phiên thấy cả hai công ty. Dựng seed ≈ 0,3 s một lần mỗi ngày neo.
  *(đã điều chỉnh 03/10/2026, FE-5b-05)* Mỗi chuyến seed đã tối ưu có **một lần chạy ba phương án** (`seed-plan.ts` chạy
  `runMockCandidates`): phương án ít dỡ-xếp lại (C) — bản điều phối viên seed duyệt — giữ **mã số** (`REV-001`), hai phương án kia mang mã
  của nó kèm nhãn (`REV-001-A`, `REV-001-B`; Phương Nam `REV-PN-001-A`…), dạng mà `nextId` không tính. Thứ tự ghi là A, B, C rồi bản
  duyệt, nên `listRevisions` của chuyến chính là `REV-001-A`, `REV-001-B`, `REV-001`, `REV-002`; kho có 55 revision của Long Bình (27 mang
  mã số) và mã kế tiếp vẫn là `REV-028`, `RUN-016`. Lần chạy hỏng `RUN-001` của chuyến chính chỉ còn thuật toán và lý do. **Trục của xe
  mẫu là số ước lượng theo cỡ xe, chưa đối chiếu thông số nhà sản xuất** (`twoAxles` ở `seed-vehicles.ts`; bảy xe Long Bình và hai xe
  Phương Nam, "Truck 6m" của Spec không khai): trục trước ở −100 cm, trục sau giữa hốc bánh; phần hai trục còn nhận được lớn hơn tải trọng
  xe khai và xe chở đủ tải dàn đều thùng không vượt trục nào; loại xe seed lấy giới hạn trục từ đó (`axleLimitsFromAxles`). Dựng seed
  chậm hơn trước: đo dưới Vitest ở máy dev khoảng 0,45 s → 0,75 s (lượt đầu 0,9 s) — phần chạy mock của 15 lần chạy tăng từ khoảng 130 ms
  lên khoảng 400 ms, chủ yếu vì phần domain tính (thứ tự xếp / dỡ, ràng buộc, chỉ số) chạy cho ba kết quả thay vì một.
  Mở app sớm hơn việc "hôm nay" muộn nhất của seed thì mọi mốc giờ seed lùi cùng một khoảng (`seed-shift.ts`): lịch sử không có sự kiện
  ở tương lai, sự kiện mới luôn nằm trên sự kiện seed; ngày chạy không đổi.
- *(đã điều chỉnh 03/10/2026, FE-6-08, D-85)* **Đồng hồ của kho là đồng hồ mô phỏng** (`clock.ts`: `createSimClock`): mọi mốc giờ kho ghi
  (`ctx.nowIso`) và vị trí xe đọc cùng một đồng hồ. Nó bắt đầu **đúng giờ máy** lúc tạo kho — seed neo và `seed-shift.ts` không đổi, không
  mốc nào nhảy — rồi chạy nhanh `speed` lần; `getMockDb()` đọc `?toc-do=<n>` (`clockSpeedFrom`, tối đa 3.600) **một lần lúc tải trang**, đổi
  route trong app không đổi tốc độ. Ở tốc độ 1 (không có tham số, mọi test, cả Vitest) đồng hồ trả thẳng giờ của `now` được tiêm: test giả
  `Date` hay tiêm `now` thấy đúng giờ mình đặt; test tua nhanh truyền `createMockDb({ now, speed })`. `setSpeed` đổi tốc độ mà giờ không nhảy
  (chỗ cho "Dùng GPS thật", FE-6-13). Khi tua nhanh, giờ của kho đi trước giờ máy: chỗ nào ở giao diện so mốc của kho với `new Date()`
  ("hôm nay" của bảng điều khiển, chuông) sẽ lệch — chỉ là chế độ demo.
- *(đã điều chỉnh 03/10/2026, FE-6-08, FE-6-09)* **Vị trí xe và ETA trực tiếp** (`db-tracking.ts`, hàm thuần `trip-tracking.ts`, kiểu ở
  `tracking-model.ts`; `postDriverLocation`, `getLatestLocation`, `getLocationHistory`, `getTripMonitoring`, `listTripMonitoring`). Kho
  **không chạy hẹn giờ nào**: mỗi lần được đọc, nó ghi bù các điểm vị trí mô phỏng từ điểm đã ghi tới giờ của kho — một điểm mỗi 30 giây
  mô phỏng kể từ lúc tài xế xuất phát, mỗi điểm tính **như lúc đó** nên kết quả không phụ thuộc lúc nào có người đọc; lịch sử giữ 2.000
  điểm gần nhất mỗi chuyến (`DbState.tracking`, seed để trống — chuyến seed đang chạy đứng theo tiến độ giao của nó ở giờ hiện tại). Xe
  mô phỏng (`@/domain/routing` `simulateVehicle`): mỗi chặng nối thẳng mất đúng thời gian của công thức D-76 (xe chạy 50 km/h trên quãng
  đường × 1,3), sự cố làm xe đứng thêm đúng số phút chậm (tham số `delays`, FE-6-11 truyền vào), "Đã đến" (`StopProgress.arrivedAt` — FE-6-06
  ghi) đặt xe tại điểm, và xe **chờ ở điểm chưa hoàn tất** tới khi tài xế hoàn tất điểm (tuyến đưa vào mô phỏng cắt tại điểm đó; 15 phút
  dừng mỗi điểm chỉ còn trong lịch thuần và trong ETA). Sau mỗi điểm vị trí, `liveEta` tính lại giờ đến các điểm chưa xong **từ vị trí** —
  không cộng phút chậm lần hai; mức hạn của một điểm **xấu đi** (kịp → sát → trễ) thì kho ghi một sự kiện hệ thống `delivery.etaRisk`
  (`ctx.logSystem`: người làm `null`, công ty của chuyến), một lần cho mỗi lần chuyển; mức khởi đầu là mức của `routePlan`, tốt lên thì
  không báo. Điểm GPS thật (`postDriverLocation`, nguồn `GPS`) tính ETA cùng cách và giữ xe mô phỏng không ghi trong 90 giây kể từ điểm
  GPS cuối. *(bổ sung 03/10/2026, FE-6-13, D-95)* **"Dùng GPS thật"** là công tắc trên màn điểm giao của tài xế khi chuyến Đang vận
  chuyển (`driver/DriverGpsToggle` + `useDeviceLocation`): `navigator.geolocation.watchPosition`, điểm đầu gửi ngay rồi vị trí mới nhất
  mỗi 30 giây qua `postDriverLocation`; `setDriverGps(tripId, bật)` của kho cho đồng hồ mô phỏng chạy theo giờ thật khi bật (giờ không
  nhảy) và, khi tắt, cho xe mô phỏng ghi tiếp ngay từ nhịp kế rồi trả đồng hồ về tốc độ `?toc-do`. Tài xế tắt, trình duyệt từ chối quyền,
  mất tín hiệu, kho từ chối điểm, hoặc rời màn chuyến: thôi theo dõi, về mô phỏng, màn nói lý do; thiết bị không có định vị thì công tắc
  mờ kèm lý do. Màn nói rõ khi chưa có máy chủ vị trí chỉ hiện trong trình duyệt này. Test giả `navigator.geolocation`
  (`DriverGpsToggle.dom.test.tsx`); E2E dùng `context.setGeolocation`. Vị trí nào hiện ra cũng kèm nhãn nguồn ("Mô phỏng" / "GPS"), giờ đến tính từ vị trí mang **MOCK RESULT**. Màn đọc lại theo
  `refreshMs` kho trả (thời gian thật tới điểm kế tiếp, ít nhất 1 giây; `null` khi chuyến không còn chạy) bằng `refetchInterval` của
  Query (`useTripMonitoringQuery` `['trips', tripId, 'monitoring']`, `useFleetMonitoringQuery` `['trips', 'monitoring']`) — không
  `setInterval` riêng, gỡ màn là hết nhịp, không chuyến nào đang chạy thì không có nhịp. Ở Chi tiết chuyến chỉ `TripRouteCard` vẽ lại theo
  nhịp đó. E2E có giá trị đang chạy chờ tới trạng thái dừng (xe tới điểm), không chờ theo giờ (`e2e/live-tracking.spec.ts`).
- *(đã điều chỉnh 03/10/2026, FE-6-10)* **Màn Giám sát `/giam-sat`** (`monitoring.view`): `fetchMonitoringBoard` (`['trips',
  'monitoring-board']`) đọc phần ít đổi — chuyến Đang vận chuyển, xe, tài xế, điểm giao, tên người dùng; vị trí, ETA và sự cố đi theo nhịp
  của `useFleetMonitoringQuery`. **Chỉ thành phần con đọc theo nhịp** (`MonitoringBoard`, `EscalationTab`, số trên tab, `BoardSync`): dải
  tiêu đề không vẽ lại theo từng điểm vị trí; dòng danh sách là `memo`, và `RouteMap` giữ mốc theo khoá — xe chạy chỉ dời mốc của nó
  (`setLngLat`), không dựng lại mốc kho và điểm giao. Bản đồ vẽ xe của **mọi** chuyến đang chạy (`RouteMap` `others`, mốc kèm nhãn "mã chuyến ·
  nguồn vị trí"), còn tuyến, kho và điểm giao là của chuyến đang chọn; danh sách cạnh nó là bản thay thế bản đồ cho trình đọc màn hình. Tab,
  chuyến đang chọn và hai công tắc lọc nằm trên URL (`tab=su-co-can-xu-ly`, `chuyen`, `nguy-co-tre`, `co-su-co`). `subscribeTrip`
  (`monitoring-api.ts` → `monitoring-events.ts`) là kênh sự kiện **trong bộ nhớ** thay WebSocket của backend: sự kiện (`LocationUpdate`,
  `EtaUpdate`, `EtaRiskAlert`, `ExceptionUpdate`, `TripCompleted`) phát khi một lần đọc giám sát trả về điều gì mới; lịch sử vị trí của chuyến
  đang chọn làm mới theo kênh đó (`useTripChannel`), không có hẹn giờ riêng. `TripMonitoring` mang thêm `exceptions` và `reroute`.
- *(đã điều chỉnh 03/10/2026, FE-6-11, FE-6-12, D-87)* **Sự cố cấp chuyến** (`exception-model.ts`, `db-exceptions.ts`,
  `DbState.exceptions`; khác sự cố giao của từng kiện): `TripException` (`EXC-NNN`) — loại (`TRAFFIC`, `ACCIDENT`, `ROAD_CONSTRUCTION`,
  `VEHICLE_BREAKDOWN`, `OTHER`; nhãn ở `common.tripExceptionTypes`), mô tả, số phút dự kiến chậm (0 → 480), trạng thái `OPEN` →
  `ESCALATED` → `RESOLVED`. Kho **xét vai trò của phiên** cho các lệnh ghi (không có phiên thì không xét; sai là `ROLE_NOT_ALLOWED`, xét sau
  công ty): `reportTripException` — điều phối viên hoặc tài xế của chính chuyến, chuyến phải Đang vận chuyển; `escalateTripException`,
  `resolveTripException`, `requestReroute`, `confirmReroute` — điều phối viên; `renegotiateDeadline` — quản lý công ty. Mỗi sự cố thêm một
  khoảng giữ xe mô phỏng (`TripIncidents.holds` → tham số `delays` của `simulatedSnapshot`): xe đứng thêm **đúng số phút chậm**, ETA tự dời
  theo vị trí — không cộng lần hai. Sự cố `OPEN` quá 30 phút theo đồng hồ của kho thì kho tự chuyển quản lý ở lần đọc kế tiếp
  (`advanceTracking`, sự kiện hệ thống `exception.escalated`, ghi đúng mốc 30 phút). **Tuyến thay thế** (`@/domain/routing`
  `rerouteOptions`, mock — hằng số ở `REROUTE_CONSTANTS`, chờ nghiệp vụ xác nhận): 2–3 đường tới **điểm kế tiếp** từ vị trí xe (đường tránh
  +15 %, vành đai +30 %, cao tốc +50 % ở 70 km/h khi chặng còn từ 15 km), mang MOCK RESULT; chọn một thì khoảng giữ đang chạy bị cắt và xe
  đứng thêm phần đường vòng chậm hơn đường nối thẳng (`delaysAfterReroute`), nhật ký `trip.rerouted`. **Thứ tự điểm giao không bao giờ đổi
  khi xe đang chạy** và đường vẽ vẫn nối thẳng. **Gia hạn**: trên sự cố `ESCALATED`, quản lý ghi đã liên hệ khách (bắt buộc) và nhập hạn mới
  cho một yêu cầu giao của chuyến — phải sau giờ của kho (`REQUIREMENT_DEADLINE_PAST`); hạn của điểm giao và mức hạn tính lại ngay
  (`refreshLiveEta`), sự cố giữ `ESCALATED` tới khi điều phối viên đánh dấu đã xử lý. Mã lỗi mới: `EXCEPTION_INVALID`,
  `EXCEPTION_STATUS_INVALID`, `REROUTE_UNAVAILABLE`; nhật ký nhóm `exception` (`reported`, `escalated`, `resolved`, `deadlineRenegotiated`).
  Lệnh ghi của màn làm mới `['trips']`, `['notifications']`, `['requirements']`, `['dashboard']`. E2E `e2e/monitoring.spec.ts` đi cả luồng
  trên một tab với `?toc-do=60`.
- *(bổ sung 07/10/2026, FE-7-01, D-88)* **Yêu cầu nhận dọc đường** (`pickup-model.ts`, `db-pickups.ts`, `DbState.pickups`): `PickupRequest`
  (`PKR-NNN`, Phương Nam `PKR-PN-NNN`) mang `companyId` của chuyến, `tripId`, điểm nhận và điểm giao (`PickupPoint`: tên, địa chỉ, toạ độ),
  `deadline?`, `packages` (`PickupPackage`: mã của bên gửi, cm, kg, loại hàng), `status`, `validationResults` (kết quả `evaluatePickup`, rỗng
  khi chưa kiểm), `overrideReason?`, người và lúc tạo, `approvedBy` / `approvedAt` từ lúc `APPROVED`. Trạng thái **ghi thật**, chỉ
  `updatePickupStatus` đổi, theo bảng `PICKUP_TRANSITIONS`: `PENDING → VALIDATED | REJECTED`, `VALIDATED → APPROVED | REJECTED`, `REJECTED →
  APPROVED` (duyệt kèm lý do vượt luật), `APPROVED → LOADED → DELIVERED`; sai bảng là `INVALID_PICKUP_STATUS_TRANSITION`. Hàm của kho đều
  nhận mã chuyến và lọc công ty qua chuyến như endpoint `/api/trips/{id}/pickup-requests` của backend: `listPickupRequests`,
  `getPickupRequest`, `createPickupRequest` (chuyến phải Đang vận chuyển — khác là `INVALID_TRIP_STATUS_TRANSITION`, không kiện nào là
  `PACKAGES_REQUIRED`, trường sai là `PICKUP_INVALID` kèm tên trường), `updatePickupStatus(tripId, pickupId, status, details?)`. Kho **chưa** kiểm
  luật, tạo kiện kho kiện, chèn điểm, ghi nhật ký hay xét vai trò — lớp duyệt (FE-7-03, FE-7-04) làm trên các hàm này. `DeliveryStop.kind`
  (`DELIVERY | PICKUP`) vắng nghĩa là `DELIVERY` (`stopKindOf`), nên điểm có từ trước không phải sửa. Seed: một yêu cầu `PKR-001` chờ duyệt trên
  `TRIP-009` (chuyến Đang vận chuyển duy nhất của Long Bình), điểm giao là điểm 3 của chuyến; Phương Nam không có.
- *(bổ sung 07/10/2026, FE-7-02, D-88)* **Mười luật nhận hàng dọc đường** (`@/domain/pickup`, thuần): `evaluatePickup(context)` trả đúng 10
  kết quả `{ rule, passed, code, params, estimated }` theo thứ tự luật 1 → 10, luôn đánh giá đủ cả mười (luật trước không đạt không bỏ qua
  luật sau); mã `PICKUP_*` ở `PICKUP_RULE_CODES`, UI dịch từng mã. `context` là mọi thứ luật cần — yêu cầu (`request`: điểm nhận, điểm giao,
  hạn, kiện), `vehicle`, vị trí xe `position` và giờ kho `at`, `stops` (mọi điểm của chuyến theo thứ tự tuyến: `completed`, `onboardCount`,
  `arrivedAt`, `number` khớp `StopZone.stopId`), `zones` của phương án đã duyệt, `onboard` (kiện còn trên xe: hộp đã xếp + khối lượng),
  `tripCargo` (dòng kiện của chuyến) và `overrideReason` — để kho dựng từ chuyến, phương án đã duyệt, vị trí xe và tiến độ giao. **Điểm hiện
  tại** là điểm đầu tiên chưa hoàn tất; **điểm được bảo vệ** là điểm đầu tiên sau nó còn `onboardCount` > 0. Luật 1: khoảng cách từ điểm nhận
  tới đường gấp khúc vị trí xe → các điểm chưa hoàn tất ≤ 10 km (đúng 10 km vẫn đạt) và không nằm sau vị trí xe. Luật 2: tiến độ của điểm giao
  dọc đường từ điểm hiện tại phải > 0 và không quá tiến độ của điểm được bảo vệ (trùng vẫn đạt); không có điểm được bảo vệ thì chỉ cần sau điểm
  hiện tại. Luật 3 đạt khi tổng kiện còn trên xe + kiện nhận ≤ tải trọng (đúng bằng vẫn đạt). Luật 8 dùng `addedConflicts` của
  `domain/constraints/segregation`: kiện nhận khác loại đang khoá thì không đạt, trừ khi chuyến đã có lý do vượt luật. Luật 9: ETA tới điểm giao
  từ `liveEta` trên tuyến **sau khi chèn**, đạt khi không `MISSED` (đúng hạn vẫn đạt); yêu cầu không có hạn thì `PICKUP_NO_DEADLINE`. **Luật
  4–7 và 10 là ước lượng** (`estimated: true`): vùng đã trống là vùng của các điểm đã hoàn tất (`zones` lọc theo `completed`), kiện nhận đặt
  một lớp ở giữa vùng đó — thể tích so với thể tích vùng (4), tải trục `axleLoadsOf` (5) và trọng tâm `checkCenterOfGravity` (6) của khối hàng
  gộp kiện còn trên xe với kiện nhận, hàng dễ vỡ bị đè khi kiện nhận cần hơn một lớp trên sàn vùng trống (7), kiện còn trên xe nằm trong vùng
  trống thì kiện nhận chắn nó (10); xe không khai trục thì luật 5 đạt với `PICKUP_AXLE_UNAVAILABLE`. Hằng số (10 km, 50 m coi là cùng một điểm)
  ở `PICKUP_CONSTANTS`. `insertPickupStops(stops, { pickupStopId, deliveryStopId }, deliveryLocation)` đặt điểm nhận rồi điểm giao **ngay sau
  điểm hiện tại**, không đổi chỗ điểm cũ nào; điểm giao trùng một điểm có sẵn sau điểm hiện tại và không quá điểm được bảo vệ thì dùng lại
  (`deliveryReused`), không còn điểm chưa hoàn tất thì `null`.
- Trạng thái demo lỗi service bật bằng tham số URL (`?mo-phong=loi`), đọc ở `-api.ts`, không đưa
  công tắc kỹ thuật lên UI vận hành. `-api.ts` lấy service qua `createOptimizationService({ simulateFailure })`:
  Web Worker trong trình duyệt, chạy trên luồng gọi khi không có Worker (jsdom), mọi đường kết thúc đều `terminate` (LM-025).

### Kiểm thử *(bổ sung 15/09/2026, D-15, D-39)*

- `pnpm test` chạy Vitest: project `unit` (node) cho `tests/**/*.test.ts` và `src/**/*.test.ts`;
  project `dom` (jsdom + React Testing Library) cho `src/**/*.dom.test.tsx`, setup ở `src/test/setup-dom.ts`.
- Test ở **seam** đã thống nhất (giao diện công khai), không test file nội bộ. Ví dụ: domain geometry
  chỉ test qua `@/domain/geometry`.
- Logic domain làm theo TDD: một test đỏ → cài đặt tối thiểu → xanh, rồi mới sang test sau.
  Giá trị kỳ vọng lấy từ nguồn độc lập (literal trong Spec, số đã kiểm bằng máy), không tính lại
  theo cách code tính.
- Benchmark domain: `pnpm test:bench` (file `*.bench.ts`). Vitest 5 lấy `bench` từ context của
  `test` (`test(name, async ({ bench }) => …)`), không còn `import { bench } from 'vitest'`.
- **Cổng ngân sách constraint engine** (D-29, LM-023): `constraint-engine.bench.ts` **fail** khi p95 của dựng + `evaluateAll`
  1.000 kiện vượt 50 ms hoặc `evaluateMove`/`commitMove` vượt 8 ms (75/12 ms khi có biến `CI`). p95 tính từ mẫu
  (`retainSamples`), không lấy p99 thay. Ghi số đo: `BENCH_RECORD=docs/benchmarks/<tên>-<ngày>.json pnpm test:bench`.
  Đổi engine hoặc lưới không gian thì chạy lại cổng này.
- File `*.bench.ts` được kiểm kiểu bằng `tsconfig.bench.json` (có kiểu Node để ghi file); `tsconfig.app.json` loại chúng
  ra để code app không thấy kiểu Node.
- Màn tính theo "hôm nay" (kỳ của bảng điều khiển) giả đồng hồ bằng `vi.useFakeTimers({ toFake: ['Date'] })` về ngày neo seed; chỉ
  giả `Date` để `setTimeout` (độ trễ kho, `findBy…`) vẫn chạy thật (LM-090).
- Project `dom` chờ tối đa 15 giây mỗi test (màn đi cả luồng người dùng chạy song song cả bộ, LM-085).
- E2E: `pnpm test:e2e` (Playwright, `e2e/*.spec.ts`, project `desktop`/`tablet`/`phone` theo tag
  `@tablet`/`@phone`). Tự bật Vite ở `127.0.0.1:5175`; cổng đang do checkout khác giữ thì đặt
  `E2E_PORT`. Trước khi so tư thế camera phải chờ camera đã vẽ xong (`waitCameraSettled`) —
  overlay debug có thể báo nghỉ sớm. CI: `.github/workflows/ci.yml` (LM-006). *(bổ sung 02/10/2026)* CI chia E2E thành **3 phần chạy
  song song** trên ba máy (`--shard=n/3`, chia theo file spec, mỗi máy vẫn một worker) — một lượt E2E một máy mất hơn 30 phút. Ở máy dev
  chỉ chạy các spec bị thay đổi đụng tới (`pnpm test:e2e e2e/<tên>.spec.ts`); bộ đủ để CI chạy.
- *(bổ sung 20/09/2026, LM-101)* **Máy CI chậm hơn máy dev nhiều** — mọi thứ đo bằng thời gian phải chịu được điều đó:
  - Không bấm nút đóng của toast: sonner chỉ dừng đếm giờ khi con trỏ nằm **trên** toast, nên trên máy chậm toast đã tự tắt trước
    khi bấm và lệnh chờ tới hết giờ. Chờ `[data-sonner-toast]` về 0 thay vì bấm.
    Cùng lý do, đừng dựa vào toast còn trên màn để khẳng định một việc đã xảy ra.
  - Thao tác sau khi gõ vào ô lọc phải chờ danh sách lọc xong (URL hoặc số dòng), vì giữa gõ và lọc có debounce.
  - Chữ tiếng Việt lọt vào giao diện `en` có thể là **tên riêng trong dữ liệu**: Radix Select dựng sẵn `<option>` ẩn cho form nên
    tên tài xế, tên xe vào DOM ngay khi truy vấn về. Cổng `i18n-en.spec.ts` lấy danh sách tên từ kho (`seedNames`), không liệt kê tay.
  - Đo hiệu năng 3D ở CI (SwiftShader, 2 nhân) chạy dưới 4 FPS là bình thường; test phải hỏi "loop còn chạy không", không hỏi
    "có frame nào trong 250 ms vừa rồi không". Dựng lại máy chậm tại chỗ bằng CDP `Emulation.setCPUThrottlingRate` (40×).
  - Cửa sổ lấy mẫu animation tính từ lúc animation **hiện ra**, không từ lúc bấm: máy chậm tiêu hết cửa sổ cho quãng bấm → React
    render → spring chạy.
  - Root R3F lấy theo canvas **đang có mặt** và chờ nó xuất hiện (`_roots.get(canvas)`), vì canvas có thể vừa được dựng lại.
  - Chờ scene nghỉ bằng `waitDemandIdle` (đọc thẳng R3F lúc luồng chính rảnh: không còn frame được xin, renderer không vẽ thêm), không
    theo `data-idle` của overlay — overlay lấy mẫu 500 ms một lần nên còn giữ mẫu cũ. Lấy mẫu animation tới khi nó **chạy xong**, không
    theo cửa sổ thời gian: react-spring tiến tối đa 64 ms mỗi frame, hình dỡ 260 ms cần 5 frame. CDP không hãm tiến trình GPU: dựng lại
    2–4 FPS bằng `E2E_FRAME_INTERVAL_MS`, hãm CPU bằng `E2E_CPU_THROTTLE` (`emulateSlowMachine` ở `e2e/viewer-helpers.ts`).
- *(bổ sung 23/09/2026)* Playwright **cuộn được cả vùng `overflow-hidden` bằng code** (`scrollIntoView` trước mỗi thao tác), nên màn
  người dùng không lăn được vẫn xanh. Kiểm cuộn bằng `page.mouse.wheel` (`layout-1366.spec.ts`, test "mouse wheel"); thêm màn cuộn
  dài mới thì thêm vào danh sách của test đó.

### Chia chunk theo route

Mọi màn trong `app/App.tsx` đều `lazy()`. Nhờ đó Three.js chỉ tải khi mở màn 3D, thư viện biểu đồ
chỉ tải khi mở màn cần nó, và máy tính bảng ở kho không gánh code của dispatcher.
Thêm màn mới thì thêm theo đúng lối này.

## 10. Khả năng truy cập

- Tương phản chữ tối thiểu 4,5:1. Không dùng chữ mảnh hoặc xám nhạt cho nội dung quan trọng.
- Vùng chạm tối thiểu 44px desktop, **56px trên tablet và điện thoại**.
- Hộp thoại chọn kết quả (tìm nhanh) theo mẫu combobox + listbox (`aria-activedescendant`), con trỏ ở ô nhập; mở bằng phím tắt thì đóng
  xong trả con trỏ về chỗ cũ (LM-099).
- Màn hình dispatcher phải dùng được hoàn toàn bằng bàn phím. Màn 3D có phím tắt: Space phát/dừng, ←/→ lùi/tiến một bước, Home về đầu. Kéo thả điểm giao làm được bằng bàn phím qua dnd-kit (Space nhấc, mũi tên di chuyển, Space thả).
- Màu điểm giao luôn đi kèm nhãn hoặc số, không bao giờ chỉ dựa vào màu. Trong 3D, chèn nhãn ẩn `sr-only` cho khối màu.
- Chữ tối thiểu 16px trên tablet và điện thoại.
- Mọi màn toàn màn hình (kho, tài xế, 3D) phải có lối thoát nhìn thấy được. Màn kiosk không có nghĩa là không có đường ra.

## 11. Khi dựng lại màn hình từ mockup

*(bổ sung 25/09/2026)* Mockup hiện hành là `design/v2.3/screens/` (ảnh `.jpg` là đích, `.html` để đo). Làm theo từng đợt ở
`design/v2.3/README.md`. Trước khi sửa một màn: chụp màn hiện tại bằng Playwright **cùng kích thước khung**, so với ảnh đích và
ghi danh sách lệch vào issue (`design/v2.3/CHANGES.md` mục 5). Sau khi sửa: chụp lại và so lần nữa; lệch có chủ ý ghi vào bảng
cuối mục này. Chữ trong mockup không phải chuẩn — chuẩn là `lib/i18n`; số trong mockup lấy từ seed, lệch thì tin `lib/mock-db`.

1. Xác định trước những component **đã tồn tại** trong repo có thể dùng lại. Không tạo component mới trùng chức năng.
2. Lấy màu và khoảng cách từ token, không đo từ ảnh.
3. Nếu mockup vi phạm luật ở mục 5, **làm theo luật ở mục 5** và nói rõ chỗ đã lệch khỏi mockup.
4. Dữ liệu để mock đặt trong file riêng `*.mock.ts` (xem mục 3 để biết đặt ở đâu), không nhúng vào component.
5. Không viết một file dài quá 250 dòng. Tách sớm — thường tách được ngay ở phần header hoặc từng panel.
   *(bổ sung 16/09/2026, LM-041)* Giới hạn này tính cho file **có logic**: component, hook, module. File chỉ
   chứa dữ liệu phẳng — từ điển `src/lib/i18n/{vi,en}/*.ts`, `*.mock.ts`, fixture — được dài hơn, vì cắt chúng
   ra chỉ thêm chỗ để hai bản dịch lệch nhau. Mỗi nhánh của từ điển vẫn phải có chú thích nói nó phục vụ màn nào.

### Những chỗ đã lệch khỏi bản design gốc, có chủ ý

| Bản design | Đã làm | Vì |
|---|---|---|
| Bóng `0 1px 2px` trên card | Chỉ viền 1px | Mục 5 cấm bóng trên card |
| Nhãn mục viết hoa + giãn chữ | Viết thường | Mục 5 cấm viết hoa toàn bộ |
| Nút "XÁC NHẬN ĐÃ XẾP" xanh lá, viết hoa | Nút primary, viết thường | Mục 5 chỉ định nghĩa nút chính nền `--primary` |
| Nút "Chỉ đường" màu primary trên màn tài xế | Đổi sang secondary | Mỗi màn chỉ một nút primary |
| Chữ 11px và 13px rải rác | Ép về 11px (micro) hoặc 12/14px | Giữ thang chữ ở mục 4 |
| Màn kho không có nút thoát | Thêm nút quay lại 56px | Mục 10: màn toàn màn hình phải có lối ra |
| Ô vị trí 3D ở màn kho là ảnh tĩnh | Three.js xoay được | Công nhân cần nhìn quanh kiện để đặt đúng |

## 12. Tối ưu token và context *(bổ sung)*

- Dùng trạng thái code hiện tại làm nguồn chuẩn cho task tiếp theo. Không đọc lại toàn repo hoặc file đã audit nếu chúng không thay đổi.
- Ưu tiên `git diff`, tìm symbol và import/reference; chỉ mở đúng phần liên quan. Tận dụng findings và kết quả kiểm tra đã có.
- Nếu cần research song song, chỉ dùng tối đa 1–2 subagent với scope hẹp, không giao đọc trùng code. Subagent trả findings ngắn, không viết essay hoặc paste code dài.
- Làm song song **nhiều issue** thì mỗi issue một git worktree riêng, chỉ giao issue không sửa chung file và đã đủ phụ thuộc. Agent không sửa `docs/progress.md`; người điều phối gộp nhánh và cập nhật tiến độ sau khi kiểm tra lại lint/build/test trên nhánh gộp.
- Không refactor ngoài scope, không over-engineer; chỉ thêm abstraction/dependency khi có nhu cầu đã chứng minh.
- Khi giải pháp đơn giản đạt acceptance criteria và performance target, dừng khám phá phương án khác.
- Chạy full `pnpm lint`, `pnpm build` và `pnpm test` để xác nhận cuối task (thêm `pnpm test:e2e` khi task đụng UI, sau LM-005); không lặp lại sau từng thay đổi nhỏ nếu chưa có lỗi hoặc rủi ro mới cần kiểm tra.
- Mỗi task xong: ghi kết quả vào file issue tương ứng và thêm một mục nhật ký có ngày vào `docs/progress.md`.
- Giữ chất lượng implementation và bằng chứng kiểm thử, đồng thời giảm tối đa context/token không cần thiết.

## 13. Git, nhánh và bộ mặt repo *(bổ sung 22/09/2026)*

Repo là thứ người ngoài mở ra xem trước cả khi chạy app. Mọi luật dưới đây sinh ra từ một lần phải **viết lại toàn
bộ 124 commit** để dọn — làm đúng từ đầu thì không phải làm lần hai.

### Danh tính commit

- Trước commit đầu tiên trong **mỗi checkout mới** (clone, worktree, máy khác), kiểm `git config user.email`.
  Email toàn cục trên máy dev đang là `Kangnahyun23@github.com` — email này **không gắn với tài khoản GitHub nào**,
  commit ký bằng nó hiện avatar xám và không được tính là đóng góp. Repo này ký bằng `tankhang6a6@gmail.com`.
- Thông điệp commit chỉ nói **việc đã làm và vì sao**: không dòng đồng tác giả, không tên công cụ, không "Generated with".
  Tên nhánh và merge message cũng thế — đặt theo việc (`feat/lm-095-bo-cuc`), không theo công cụ sinh ra nó.

### Nhánh và CI

| Nhánh | Dùng làm gì |
|---|---|
| `main` | bản đã nghiệm thu; **không push thẳng**, vào bằng PR |
| `developer` | nhánh phát triển hằng ngày |
| `feat/**`, `fix/**` | một việc một nhánh, gộp về `developer` |

- CI (`.github/workflows/ci.yml`) chạy cho `main`, `developer`, `feat/**`, `fix/**`. **Đặt kiểu tên nhánh mới thì thêm
  vào trigger ngay trong cùng commit** — `fix/**` từng nằm ngoài CI và 6 lỗi TypeScript ngồi im ở đó nhiều ngày,
  không ai thấy cho tới lúc định gộp.
- Không gộp nhánh chưa từng qua CI. Chạy `pnpm lint && pnpm build && pnpm test` trên chính nhánh đó trước, kể cả khi
  đó là code của người khác.

### Bộ mặt repo

- Gốc repo chỉ giữ: file cấu hình công cụ bắt buộc, `README.md`, `AGENTS.md`. **Tài liệu mới đặt trong `docs/`**,
  không thêm `.md` ở gốc. Cấu hình cá nhân của công cụ soạn thảo không commit (đã nằm trong `.gitignore`).
- *(bổ sung 01/10/2026)* **`docs/` nằm trong `.gitignore`**: PRD, issue, nhật ký, bàn giao, ảnh chụp, số đo chỉ lưu trên máy, không
  commit, không đưa lên GitHub; chia sẻ với nhóm bằng kênh khác. Test và script chỉ được **ghi** vào `docs/` (ảnh, số đo), không được
  **đọc** từ đó — CI không có thư mục này. Liên kết tới `docs/` trong `AGENTS.md`, `README.md` chỉ mở được ở bản checkout có thư mục đó.
- `README.md` là trang đọc đầu tiên: mô tả sản phẩm, cách chạy, trạng thái và số liệu kiểm thử **thật**. Trạng thái đổi
  thì sửa README cùng lúc — repo từng để nguyên template mặc định của Vite suốt nhiều tuần.

### Tài liệu không trích mã commit

Nhật ký, issue và nghiệm thu **không** dẫn chứng bằng mã commit: một lần viết lại lịch sử là 76 mã trong `docs/` trỏ
vào hư không. Dẫn bằng mã issue (LM-xxx), ngày, tên file hoặc tên test — những thứ không đổi theo lịch sử.

### Di chuyển file tài liệu

Đổi chỗ file `.md` thì sửa hết đường dẫn tương đối rồi **kiểm bằng máy**: quét mọi `](…)` trong file `.md` và mở thử
từng đường dẫn. Lần dọn gốc gần nhất làm gãy 12 liên kết mà đọc bằng mắt không thấy.

### Viết lại lịch sử — chỉ khi thật cần, theo đúng thứ tự

1. `git bundle create <file> --all` để sao lưu toàn bộ ref.
2. Viết lại trên **bản sao**, không làm trên repo đang có việc chưa commit.
3. So `git rev-parse <nhánh>^{tree}` trước và sau: phải **trùng khít** — chỉ thông điệp được đổi, nội dung thì không.
4. Push, rồi đồng bộ repo đang làm việc bằng cách dời ref (giữ nguyên phần chưa commit).
5. Báo mọi người clone lại; ai push từ bản cũ là lịch sử cũ quay về.
