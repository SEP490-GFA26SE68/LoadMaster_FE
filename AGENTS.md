# AGENTS.md — LoadMaster Web

Đọc file này trước khi viết bất kỳ dòng code nào trong repo.

File này là **luật sống**: khi thực tế phát triển cho thấy một luật cũ sai hoặc thiếu,
sửa luật ở đây cùng lúc với sửa code, đừng để code và luật lệch nhau. Mỗi luật mô tả trạng thái **hiện tại**; mã issue trong ngoặc (FE-6-03…)
chỉ để tìm lại lý do.

## 1. Sản phẩm

LoadMaster là hệ thống lập kế hoạch và tối ưu chất xếp hàng hóa 3D cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam. Đây là repo frontend.

Giao diện **tiếng Việt**. Một codebase responsive phục vụ **8 vai trò** của backend v2 (FE-0-01, FE-0-03, FE-0-06, D-63) — ba vai trò nền
tảng, năm vai trò của công ty logistics (khách hàng của app); `ROLES` là đúng tám vai trò này. Mã FE là nội bộ; mã backend nằm ở
`BACKEND_ROLE_CODES` (`types/user.ts`), `-api.ts` đổi khi nối API:

| Vai trò (mã FE · mã backend) | Thiết bị | Đặc điểm |
|---|---|---|
| Quản trị hệ thống (`systemAdmin` · `SYSTEM_ADMIN`) | Desktop | Nền tảng: công ty `/nen-tang/cong-ty` (FE-8-06), người dùng, nhật ký, ma trận quyền; không có quyền vận hành |
| Quản lý nền tảng (`systemManager` · `SYSTEM_MANAGER`) | Desktop | Nền tảng: danh mục gói cước `/nen-tang/goi` (FE-8-02) |
| Hỗ trợ khách hàng (`systemSupporter` · `SYSTEM_SUPPORTER`) | Desktop | Nền tảng: yêu cầu hỗ trợ của mọi công ty `/ho-tro` (FE-8-07) |
| Quản trị công ty (`companyAdmin` · `COMPANY_ADMIN`) | Desktop | Người dùng, nhật ký, gói cước và credit `/goi-cuoc` (FE-8-03) |
| Quản lý công ty (`manager` · `COMPANY_MANAGER`) | Desktop / tablet | Dashboard, biểu đồ, xuất báo cáo; lập yêu cầu giao (FE-4b-02); xem chuyến và phương án chỉ đọc |
| Điều phối viên (`dispatcher` · `DISPATCHER`) | Desktop | Dữ liệu dày, phiên làm việc dài, bảng nhiều cột; quản lý kho kiện (thêm kiện, nhập file, in nhãn QR), lập chuyến, tối ưu, duyệt phương án |
| Nhân viên kho (`warehouse` · `WAREHOUSE_WORKER`) | Tablet tại kho | Sáng, đeo găng, nhìn xa, một thao tác mỗi màn |
| Tài xế (`driver` · `DRIVER`) | Điện thoại ngoài trời | Nắng, một tay, mạng yếu |

Backend là Spring Boot monolith + PostgreSQL, cộng một Python FastAPI service riêng cho tối ưu. Giao tiếp REST + WebSocket.

**Trạng thái hiện tại:** toàn bộ dữ liệu là mẫu; riêng **đăng nhập** nối được vào Keycloak của backend khi đặt `VITE_AUTH_SOURCE=keycloak`
(mặc định vẫn là kho mẫu — mục 9 "Nối backend"). Kho nằm trong bộ nhớ từng tab; các tab **cùng trình duyệt** dùng chung
nó qua `BroadcastChannel` (mục 9, FE-BL-06): hai tab mở hai người dùng khác nhau thấy việc của nhau, nhưng không lưu bền (đóng hoặc tải lại
mọi tab là về seed) và không thay backend (trình duyệt hay máy khác không thấy gì). Phân quyền **giả lập ở FE** (LM-084, D-41).

**Phân quyền**

- Ma trận `features/auth/permissions.ts`: **một bảng** `ROLE_PERMISSIONS` theo PRD v2 mục 5.2, đúng 33 quyền; đọc quyền qua
  `can`/`permissionsOf`; thứ tự `PERMISSIONS` là thứ tự dòng của Ma trận quyền. Ba vai trò nền tảng **không có quyền vận hành**: quản trị hệ
  thống chỉ có `companies.manage`, `users.manage`, `audit.view`; quản lý nền tảng `subscriptionPlans.manage`; hỗ trợ khách hàng `support.handle`.
  Quản trị công ty có `users.manage`, `audit.view`, `billing.manage`, `support.create`.
- Mỗi nhóm route bọc `RequirePermission` trong `app/App.tsx`, thiếu quyền là màn 403 (`app/ForbiddenPage.tsx`) có nút về màn chính; thanh
  điều hướng chỉ hiện mục có quyền; nút ghi ẩn qua `useCan()`. Backend thật phải kiểm lại ở server. Màn mới thêm route vào đúng nhóm quyền.
- **Quyền theo màn:** `requirements.view` mở `/yeu-cau-giao` (quản lý công ty, điều phối viên; `/don-hang` chuyển hướng sang đó), tạo, sửa, xoá theo
  `requirements.edit` — chỉ **quản lý công ty**; đưa yêu cầu vào chuyến / gỡ khỏi chuyến là sửa chuyến, theo `trips.edit` của điều phối viên;
  kho không xét vai trò cho các hàm yêu cầu giao (D-72). `packages.view` mở Kho kiện `/kien-hang` (điều phối viên quản lý; quản lý công ty chỉ
  đọc: không nút ghi, không chọn kiện in nhãn, không gỡ cờ), nút ghi của màn đó và `/loai-kien` theo `packages.manage` của điều phối viên;
  `labels.print` mở In nhãn `/kien-hang/nhan`, `packages.lookup` mở Tra cứu kiện `/tra-cuu-kien` — điều phối viên và nhân viên kho.
  `routes.optimize`: nút "Tối ưu tuyến" ở Chi tiết chuyến (điều phối viên, FE-4b-09). `manualConfirm.approve`: Duyệt / Từ chối ở thẻ "Xác nhận
  tay chờ duyệt" (điều phối viên, FE-6-04). `pickups.create`: nút "Nhận hàng dọc đường" ở Chi tiết chuyến và `/giam-sat` (điều phối viên) và ở
  màn điểm giao (tài xế, FE-7-03); `pickups.approve`: Từ chối / Duyệt (điều phối viên, FE-7-04). `subscriptionPlans.manage`: `/nen-tang/goi`
  (FE-8-02). `billing.manage`: `/goi-cuoc` và `/thanh-toan/gia-lap` (FE-8-03, FE-8-04). `companies.manage`: `/nen-tang/cong-ty` (FE-8-06).
  `support.create`: mục "Yêu cầu hỗ trợ" của menu tài khoản (năm vai trò công ty); `support.handle`: `/ho-tro` (FE-8-07). Giám sát (FE-6-10 → FE-6-12):
  `monitoring.view` mở `/giam-sat` và vị trí xe ở Chi tiết chuyến (điều phối viên, quản lý công ty), `exceptions.report` ("Báo sự cố" ở `/giam-sat`
  của điều phối viên, "Sự cố trên đường" ở màn điểm giao của tài xế), `exceptions.resolve` (tìm tuyến khác, chuyển quản lý, đã xử lý — điều phối
  viên), `deadlines.renegotiate` (tab "Sự cố cần xử lý" — quản lý công ty).
- **Điều phối viên duyệt phương án** (FE-0-07, D-80): `plans.approve` (chỉnh tay và Duyệt trong Planner) là của điều phối — lập chuyến, chạy tối ưu,
  chỉnh tay, rồi "Duyệt phương án" / "Duyệt bản chỉnh". Quản lý công ty chỉ đọc + xuất báo cáo: mở Planner ở chế độ chỉ xem, một dòng lý do. Không có hàng đợi `/duyet` hay quyền duyệt của quản lý.
- Đường dẫn của các màn đã bỏ (`/lo-hang`, `/nhan-hang`, `/duyet`) là màn 404.
- E2E đăng nhập bằng `login(route, role)`; không còn vai trò toàn quyền nên kịch bản đi qua nhiều vai trò **đăng nhập đúng vai trò của từng
  bước**, đổi người trong app bằng `switchUser` (`e2e/spec-flow-helpers.ts` — tải lại trang là mất kho); test DOM đăng nhập đúng người bằng
  `signedInAs(vai trò | mã người dùng seed)`.

**Tài khoản, công ty, phạm vi**

- Tài khoản công ty gắn `User.companyId`; ba tài khoản nền tảng không có công ty và không có kho (`User.depot` tuỳ chọn; kho bỏ cả hai khi vai
  trò là nền tảng). Hai vai trò quản trị mở cùng màn `/nguoi-dung`, `/nhat-ky` (FE-0-08, D-65); **phạm vi theo vai trò, kho kiểm như server**
  (`lib/mock-db/user-scope.ts`, `db-users.ts`), màn chỉ làm mờ trước kèm lý do (`admin/account-guards.ts`, dùng cùng `isLastActiveAdmin`,
  `userScopeOf` với kho).
- Quản trị hệ thống: thấy mọi tài khoản (cột Công ty, bộ lọc `cong-ty` — mã công ty hoặc `nen-tang`); **tạo, sửa, xoá** tài khoản nền tảng (form chỉ
  mời ba vai trò nền tảng, không có ô kho); với nhân sự công ty chỉ **khoá, mở khoá, đặt lại mật khẩu** — sửa, xoá là `USER_MANAGED_BY_COMPANY`.
  Quản trị công ty: chỉ người của công ty mình (kho không trả tài khoản nền tảng hay người công ty khác: đọc `NOT_FOUND`, ghi `FORBIDDEN_COMPANY`);
  tạo, sửa, khoá, đặt lại mật khẩu, xoá với năm vai trò công ty; tài khoản mới nhận công ty của người tạo. Tạo hoặc đổi sang vai trò ngoài phạm vi
  là `ROLE_OUT_OF_SCOPE` — không tài khoản nào đổi giữa nhóm vai trò nền tảng và nhóm vai trò công ty, nên vai trò công ty luôn có công ty. Không
  ai tự khoá, xoá, đổi vai trò mình (`SELF_CHANGE_FORBIDDEN`); `LAST_ADMIN` **theo phạm vi**: nền tảng giữ một quản trị hệ thống đang hoạt động,
  mỗi công ty giữ một quản trị công ty đang hoạt động. Kho **không kiểm quyền** (`users.manage`) — đó là việc của route; kho chỉ xét phiên thuộc
  phạm vi nào.
- Nhật ký: quản trị hệ thống đọc cả hệ thống, lọc theo công ty (`cong-ty`); quản trị công ty đọc sự kiện của công ty mình. **Sự kiện về một tài
  khoản thuộc công ty của tài khoản đó**, ai làm cũng vậy (`auditEventCompany` — một luật cho seed và `ctx.log`; ghi nhật ký trước khi xoá tài
  khoản): quản trị hệ thống khoá một nhân viên thì quản trị công ty của người đó đọc được, kèm tên người làm (`listAuditNames` trả thêm người
  làm ngoài công ty); việc trên tài khoản nền tảng không thuộc công ty nào.
- **Màn công ty** `/nen-tang/cong-ty` (`companies.manage`, màn chính của quản trị hệ thống, FE-8-06): danh sách công ty (tên, gói, trạng thái gói,
  số người dùng), tạo công ty **kèm Quản trị công ty đầu tiên** (mật khẩu tạm hiện một lần, như màn Người dùng), sửa thông tin và kho xuất phát;
  công ty mới chưa có gói. Chi tiết ở mục 9.
- Kho **lọc dữ liệu theo công ty của phiên** (mục 9 "Lớp dữ liệu", FE-0-02, D-64): người của một công ty chỉ thấy xe, loại xe, loại kiện, kiện,
  yêu cầu giao, chuyến, phương án, người dùng và nhật ký của công ty mình; ba vai trò nền tảng bị mọi hàm dữ liệu vận hành từ chối
  (`COMPANY_REQUIRED`), chỉ đọc người dùng, nhật ký và danh sách công ty. Mỗi công ty có kho xuất phát kèm toạ độ (`Company.depot`).
- **Seed:** hai công ty logistics, 20 tài khoản, mỗi công ty đủ năm vai trò công ty. Nhân viên seed thuộc `LOG-001` (Long Bình); năm tài
  khoản `@phuongnam.vn` thuộc `LOG-002` (Phương Nam; `viet.lam@phuongnam.vn`, `US-0015`, là nhân viên kho). Dữ liệu vận hành có từ trước
  thuộc Long Bình; Phương Nam có bộ nhỏ riêng ở `seed-phuong-nam.ts` (`TRIP-PN-001` đã duyệt, gán `taixe@phuongnam.vn`; `TRIP-PN-002` nháp). Mã của
  Phương Nam và tài khoản seed thêm ở FE-0-03 mang `PN` / `NT` / `LB` (`TRIP-PN-…`, `VEHICLE-PN-…`, `REV-PN-…`, `US-NT-…`, `US-LB-…`, `US-PN-…`)
  nên `nextId` không tính: mã kế tiếp ghi trong test giữ nguyên (ví dụ `US-0016`).
- Ô đăng nhập nhanh (`DemoAccounts`) chia ba nhóm — "Nền tảng" (đủ ba tài khoản `quantri@`, `nentang@`, `hotro@`), Long Bình, Phương Nam (tên
  công ty lấy từ seed).

**Điều hướng**

- Mục điều hướng khai **theo vai trò** ở `app/nav-items.ts` (FE-0-04): `NAV_SCREENS` là các màn có mục — chỉ màn đang có route (D-20) — và
  `NAV_ITEMS` là danh sách của từng vai trò theo thứ tự của vai trò đó, màn chính đứng đầu; quyền vẫn là cổng (`navItemsFor` bỏ mục thiếu quyền).
  Quản trị hệ thống: Công ty · Người dùng · Nhật ký. Quản trị công ty: Người dùng · Nhật ký · Gói và credit. Quản lý công ty: Bảng điều khiển ·
  Yêu cầu giao · Kho kiện (chỉ đọc) · Chuyến hàng · Giám sát · Đội xe. Điều phối viên: Chuyến hàng · Giám sát · Kho kiện · Yêu cầu giao · Đội xe ·
  Bảng điều khiển. Kho, tài xế: một mục về màn của mình (thanh chỉ hiện với họ ở màn hồ sơ). Quản lý nền tảng: Gói cước. Hỗ trợ khách hàng: Hỗ
  trợ. Màn mới thêm một dòng vào `NAV_SCREENS` và mã của nó vào `NAV_ITEMS`, trong issue của màn đó.
- Loại kiện và In nhãn không có mục riêng, mở từ màn Kho kiện (nút "Loại kiện" trên dải tiêu đề, nút quay lại ở hai màn kia); Loại xe mở từ màn
  Đội xe; Tra cứu kiện: điều phối viên mở bằng nút "Tra cứu kiện" trên dải tiêu đề của Kho kiện, nhân viên kho bằng nút 56 px ở thanh màn chính `/kho`.
- `app/role-routes.dom.test.tsx` kiểm bằng **bảng route thật** và ma trận quyền: màn chính, đích của logo, mọi mục điều hướng và mọi nhóm tìm
  nhanh của từng vai trò là route có thật mà vai trò mở được; mọi màn có tiêu đề tab và nhánh `titles` không còn tên của màn đã bỏ — bỏ một
  route hay một quyền mà quên các chỗ đó là test đỏ.
- Nhật ký và chuông chỉ biến đối tượng thành liên kết khi người xem có quyền mở trang đích (`describeEvent(…, can)`) — quản trị viên đọc nhật
  ký nhưng không xem được chuyến, xe. Màn kho và tài xế chỉ còn vai trò của chính nó mở được.
- Logo mở `/` khi có quyền bảng điều khiển, không thì màn chính của vai trò. Đăng nhập xong mở màn của vai trò (`features/auth/landing.ts`,
  `ROLE_HOME`: điều phối `/chuyen`, quản lý `/`, kho `/kho`, tài xế `/tai-xe`, quản trị hệ thống `/nen-tang/cong-ty`, quản trị công ty
  `/nguoi-dung`, quản lý nền tảng `/nen-tang/goi`, hỗ trợ khách hàng `/ho-tro`) — màn chính phải là màn vai trò đó mở được, vì nút "Về màn
  chính" của 403 / 404, logo và nút thoát đều dẫn tới đó; liên kết sâu mở trước khi đăng nhập được giữ, gốc `/` thì không. Đăng xuất không ghi
  nhớ trang đang đứng (`RequireAuth` chỉ nhớ trang khi người **chưa** đăng nhập mở nó).
- Nút thoát ở màn kho/tài xế theo vai trò (`features/auth/exit.ts`): nhân viên kho và tài xế **ở màn danh sách** thì **đăng xuất**, **trong phiên
  xếp / trong chuyến** thì về danh sách (`/kho`, `/tai-xe`, LM-086/087); vai trò khác về màn chính của mình; vai trò xem được chuyến về trang
  chuyến đã mở màn đó (`exitAction` hỏi quyền `trips.view`, không hỏi tên vai trò).
- **Thanh ngang 60 px trên dải trời** (`app/NavRail.tsx`, V2.3): logo trái, nhóm mục giữa trên kính tối (`.glass-nav`), tìm nhanh · ngôn ngữ ·
  chuông · tài khoản phải. Mục đang mở nằm dưới kính cyan (trong + viền + quầng, `--nav-on`), và kính đó là **chỉ báo trượt theo con trỏ**
  (`useGlassFollow`, `.glass-follow`): bám mục đang rê / focus, về mục đang mở khi con trỏ rời thanh. Chỉ báo là phản hồi nền duy nhất; mục
  đang mở chỉ có chữ trắng 600, **không** nền riêng, nếu không sẽ thành hai lớp chồng nhau. Ngôn ngữ trên thanh là một nút "VI" mở menu chọn
  (`components/LanguageMenu.tsx`); màn toàn màn hình kho/tài xế giữ hai nút `LanguageSwitch` 56 px. Vòng focus trên dải trời là `--cyan-300`
  (`--primary` không đủ tương phản trên nền tối). Thanh còn có nút Tìm nhanh (Ctrl+K / ⌘K, LM-099 — chỉ nhóm có quyền xem, `searchGroupsFor`; màn
  toàn màn hình không có), chuông thông báo (LM-098 — sự kiện nhật ký liên quan vai trò, không gồm việc chính mình làm; "đã đọc" là state giao
  diện trong tab, `read-state.ts`) và mục "Hồ sơ cá nhân" trong menu tài khoản (`/ho-so`, LM-096 — mọi người đã đăng nhập; mục "Yêu cầu hỗ trợ" kế
  bên là của năm vai trò công ty, FE-8-07; kho/tài xế mở từ nút tài khoản 56 px ở màn chính). Nút hành động trên thanh dùng
  `components/NavRailButton.tsx`. Thêm mục vào thanh phải đo lại ở 1.366 px (`e2e/layout-1366.spec.ts` đo thanh của điều phối viên và quản lý
  công ty ở cả hai ngôn ngữ).
- **Màn kho** (`/kho`, soạn, xếp, xếp xong, chờ duyệt lại; V2.3 đợt 6) có thanh trên là dải trời cao 80 px (`components/TouchTopBar`) với điều
  khiển **đặc**, không kính: nền `--sky-solid`, viền `--sky-solid-border` (token ở `index.css`), nút `variant="skySolid"`, và `tone="sky"` của
  `ExitIconButton`, `LanguageSwitch`, `NotificationBell variant="touch"`, `AccountMenu` — mặc định vẫn nền sáng. **Màn tài xế** (`/tai-xe`, điểm
  giao, tổng kết, màn thông báo) dùng cùng thanh và điều khiển đặc: không logo ở thanh; `wrap` cho thanh cao theo nội dung và dưới 480 px đẩy
  tiêu đề xuống hàng riêng (hàng trên là thoát, ngôn ngữ, chuông, tài khoản — bốn điều khiển 56 px), `below` đặt dải tiến độ theo điểm giao
  ngay trong dải trời; thanh thấp hơn offset 152 px của toast nên toast không che điều khiển nào. Panel và nút nổi trên khung 3D của kho và
  tài xế cũng là bề mặt tối đặc (`--panel-dark`, `--border-dark`), không `glass`. Kính ở hai màn này chờ số đo thiết bị thật (mục 5, luật kính).
- **Tìm nhanh theo vai trò** (FE-0-04): quản trị hệ thống, quản trị công ty tìm người dùng; quản lý công ty tìm chuyến, kiện, yêu cầu giao
  (`requirements.view`), kho kiện (`packages.view`), xe; điều phối viên thêm loại kiện (`packages.manage`); kho, tài xế, quản lý nền tảng, hỗ
  trợ khách hàng không có nhóm nào nên không có nút và không bắt Ctrl+K. `search-api.ts` chỉ gọi hàm kho mà nhóm của vai trò cần.

**Chuông thông báo theo vai trò**

`NOTIFICATION_ACTIONS` quyết định ai nhận gì; vai trò không có nguồn nào (quản lý nền tảng, hỗ trợ khách hàng) không có chuông; sự kiện của
luồng mới thêm ở issue của luồng đó.

- Điều phối viên: đồng nghiệp duyệt phương án, kho báo thiếu kiện lúc soạn / kiện hỏng lúc xếp / xếp xong, sự cố giao, chuyến hoàn thành,
  chuyến bị huỷ, xác nhận tay mới gửi (`manualConfirm.requested`), `pickup.requested`, tài xế báo sự cố (`exception.reported`), kho tự chuyển sự cố
  cho quản lý sau 30 phút (`exception.escalated`, sự kiện của hệ thống), quản lý đã nhập hạn mới (`exception.deadlineRenegotiated`, để xử lý tiếp).
  Còn nhận **nguy cơ trễ hạn giao** (`delivery.etaRisk`, sự kiện của hệ thống, không có người làm) ở chuông **và toast**: `EtaRiskWatcher`
  (`features/monitoring`, đứng cạnh chuông, không vẽ gì) đọc giám sát của các chuyến Đang vận chuyển theo nhịp điểm vị trí; cảnh báo kho phát sau
  lần đọc đầu thành toast (sát hạn: cảnh báo; trễ hạn dự kiến: lỗi) và chuông đọc lại ngay, cảnh báo có từ trước chỉ nằm ở chuông.
- Quản lý công ty: chuyến hoàn thành, chuyến bị huỷ, sự cố giao, kiện **của một yêu cầu giao** bị bỏ khỏi chuyến vì thiếu hoặc hỏng (yêu cầu
  thành giao thiếu, D-92), sự cố chuyển lên mình (`exception.escalated`). Không nhận `delivery.etaRisk`. `EtaRiskWatcher` chạy cho cả hai vai trò
  (kho chỉ tự chuyển sự cố khi có người đọc giám sát) và hiện toast cảnh báo khi một sự cố vừa chuyển lên — trừ sự cố chính người đó vừa chuyển.
- Nhân viên kho: quyết định của điều phối viên với kiện **mình báo thiếu** và chuyến bị huỷ **lúc đang xếp** (dỡ phần đã xếp). Nhân viên kho và
  tài xế có thêm đúng một loại cá nhân: xác nhận tay **của chính mình** bị từ chối (`manualConfirm.rejected`, lọc theo `requestedBy` —
  `PERSONAL_ACTIONS`); chuông của họ là nút 56 px ở thanh màn chính `/kho`, `/tai-xe` (`NotificationBell variant="touch"`, chữ 16 px), và thông
  báo về một chuyến mở chuyến đó ở màn của vai trò (`operationHref`), vì họ không mở được Chi tiết chuyến.
- Tài xế: `pickup.approved` / `pickup.rejected` — chỉ của **chuyến mình** (`PICKUP_DECISIONS`, tham số `driverId` của sự kiện); `trip.stopsReordered`
  khi điều phối viên đổi thứ tự điểm chuyến của mình (FE-BL-03).
- Quản trị hệ thống, quản trị công ty: việc trên tài khoản và đăng nhập sai. Quản trị công ty còn nhận **"Sắp hết credit"** (`credit.lowBalance`,
  sự kiện hệ thống khi số dư sau một lần chạy tối ưu 3D xuống tới `BILLING_CONSTANTS.lowCreditThreshold` — đề xuất, chờ nhóm xác nhận): bấm
  mở `/goi-cuoc`; đối tượng `company` của sự kiện là liên kết tới đó cho người có `billing.manage`, nhật ký cũng vậy.
- Mọi vai trò công ty: **trả lời yêu cầu hỗ trợ của chính mình** (`ticket.replied`, lọc theo người gửi — tham số `requestedBy`).
- Chuông không tự lọc theo công ty — kho lọc: quản trị công ty chỉ nhận sự kiện tài khoản của công ty mình (kể cả việc quản trị hệ thống làm
  trên người của công ty), không nhận gì về tài khoản nền tảng hay công ty khác.

**Quy tắc nền của Spec**

- **Bắt buộc theo Spec** ([docs/build-spec.md](docs/build-spec.md); quyết định ở [docs/prd.md](docs/prd.md) D-01 → D-39): đơn vị cm/kg, hệ toạ độ, mô hình
  dữ liệu và contract `OptimizationService`, validation, nhãn **MOCK RESULT**, acceptance criteria mục 15. Khi luật trong file này mâu thuẫn
  với phần bắt buộc của Spec, Spec thắng và phải sửa luật. Cấu trúc thư mục, component, thư viện được điều chỉnh cho khớp repo.
- Mọi kết quả từ mock có badge **MOCK RESULT** (không dịch). Không có chữ kiểu "AI optimized", không đặt tên service là `AIService`.
- Giao diện chuyển được **vi / en** (D-07); tiếng Việt là ngôn ngữ mặc định và nguồn chuẩn của từ điển.
- Quyết định và issue của giai đoạn sau Review 1 nằm ở [docs/prd-v2.md](docs/prd-v2.md) và [docs/issues-2-fe/](docs/issues-2-fe/README.md) — tài liệu
  nội bộ, chỉ có trên máy của nhóm (mục 13); đọc hai tài liệu đó trước khi làm việc thuộc giai đoạn này. Luật ở các mục dưới mô tả code hiện tại;
  issue nào đổi luật thì sửa luật ở đây cùng lúc (danh sách ở `docs/prd-v2.md` mục 15). Tiến độ: [docs/progress.md](docs/progress.md).

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
qrcode-generator         — mã hoá QR (MIT, không phụ thuộc) cho components/QrCode; quét QR dùng BarcodeDetector gốc
                           của trình duyệt trong components/QrScanDialog, không thêm thư viện quét
maplibre-gl              — bản đồ (FE-4b-07, D-75), khoá đúng một version; CHỈ import trong src/components/map, tải lười cùng CSS
                           và worker của nó (không CDN). Nền Goong qua VITE_GOONG_MAPTILES_KEY; không có khoá thì nền trống
lucide-react             — icon, KHÔNG dùng bộ khác
sonner                   — toast
keycloak-js              — đăng nhập qua Keycloak của backend; CHỈ import (động) trong features/auth/keycloak-session.ts
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
@playwright/test         — E2E trình duyệt thật
```

Bản đồ (FE-4b-07): màn import `RouteMap` từ `@/components/map`, không import `maplibre-gl`. **Không dùng nền
OpenStreetMap** hay nguồn gạch nào ngoài Goong (D-75: không bảo đảm thể hiện Hoàng Sa, Trường Sa). Khoá map tiles chỉ nằm ở `.env.local`
(mẫu: `.env.example`; mọi `.env*` khác bị `.gitignore` chặn); dev, CI và test chạy không khoá. Khoá REST của Goong không bao giờ ở FE.

**Không dùng:** `framer-motion-3d` (deprecated, không hỗ trợ React 19) · Redux · Zustand (state dùng chung đi qua mock repository + TanStack Query, D-06) · thư viện i18n (từ điển tự viết, D-07) · axios (dùng fetch) · moment.js · thư viện UI khác.

### Radix trực tiếp, không dùng shadcn CLI

shadcn bản hiện tại sinh code trên **Base UI** chứ không phải Radix, và variant mặc định của nó lệch spec design (nút `h-8` thay vì 40/56px,
`active:translate-y-px` vi phạm luật hover ở mục 5, `disabled:opacity-50` thay vì nền `--border`). Nên: cài thẳng `@radix-ui/react-*` cho phần cần
hành vi và khả năng truy cập (Select, Dialog, DropdownMenu, Checkbox, Switch, RadioGroup, Tabs, Tooltip, ScrollArea, Separator, Slot), rồi **tự
viết lớp giao diện** trong `components/ui/`. Không chạy `shadcn add`.

### TanStack Table v9

API v9 khác hẳn v8: dùng `useTable` + `tableFeatures({})` + `createColumnHelper`, **không** dùng `useReactTable`/`getCoreRowModel`. Tài liệu chính
chủ nằm trong `node_modules/@tanstack/react-table/skills/`.

## 3. Cấu trúc thư mục

```
src/
  app/                  router, providers, app shell, thanh điều hướng, route-title.ts (tiêu đề tab)
    design-system/      2 trang tài liệu bàn giao (/kieu-dang, /thanh-phan)
  components/ui/        primitive tự viết trên Radix
  components/brand/     logo LoadMaster: LogoMark (biểu tượng SVG), Logo (bộ ghép + khẩu hiệu), Lumo (linh vật)
  components/           component dùng chung: StatusBadge, DataTable, FilterBar, EmptyState, TripLockBanner, ConfirmDialog,
                        StopChip / StopDot (số điểm giao trên màu định danh), VehicleName (tên xe không bẻ biển số), PageHero (thanh tiêu đề màn),
                        TouchTopBar (thanh dải trời điều khiển đặc của màn cảm ứng, kho và tài xế), KpiTile (ô số liệu),
                        QrCode / QrScanDialog (vẽ và quét mã QR), PackageVerify (đối chiếu kiện ba mức)...
  components/map/       bản đồ dùng chung: RouteMap (kho, điểm giao, tuyến, xe), nơi duy nhất import maplibre-gl; CoordinatePicker
                        (ô chọn toạ độ), `places-api.ts` (tìm địa chỉ — chưa có ở BE, Q-20)
  features/
    auth/               đăng nhập, phiên, RequireAuth
    trips/              danh sách, chi tiết, form chuyến, so sánh phương án
    monitoring/         vị trí xe và ETA trực tiếp của chuyến Đang vận chuyển (`LiveLocationBar`, `EtaRiskWatcher`), màn Giám sát `/giam-sat`
                        (`MonitoringPage` → `MonitoringBoard`; hàm thuần `monitoring-view.ts`), kênh sự kiện `monitoring-events.ts`
                        (`subscribeTrip`), sự cố cấp chuyến (`exceptions-api.ts`, `ReportExceptionDialog`, `RerouteDialog`,
                        `TripExceptionList`; màn tài xế mở `ReportExceptionDialog` từ tờ "Thêm" của `driver/StopMoreActions`), tab của quản lý
                        (`EscalationTab`, `RenegotiateDialog`)
    optimization/       chạy job, theo dõi tiến trình
    viewer3d/           toàn bộ code Three.js, tách biệt hoàn toàn
    warehouse/          luồng xếp hàng ở kho
    driver/             luồng giao hàng
    manager/            dashboard
    fleet/              đội xe
    admin/              người dùng
    package-pool/       kho kiện `/kien-hang` (danh sách, thêm kiện, nhập file, chi tiết kiện), loại kiện, nhãn QR `/kien-hang/nhan`,
                        tra cứu kiện `/tra-cuu-kien`
    requirements/       yêu cầu giao `/yeu-cau-giao`: danh sách, form tạo / sửa, chi tiết, đưa vào chuyến
    pickups/            nhận hàng dọc đường: `PickupRequestDialog`, mười luật `PickupRulesList` (câu dựng từ mã + tham số ở `pickup-rule-text.ts`),
                        thẻ yêu cầu của chuyến `PickupRequestsCard` (Chi tiết chuyến, Giám sát); nút của tài xế là hàng "Nhận hàng dọc đường"
                        trong tờ "Thêm" của `driver/StopMoreActions`
    vehicle-types/      danh mục loại xe
    billing/            gói cước và credit của công ty `/goi-cuoc`, trang thanh toán giả lập `/thanh-toan/gia-lap`
    platform/           màn của nền tảng: danh mục gói cước `/nen-tang/goi`, Công ty `/nen-tang/cong-ty`
    support/            yêu cầu hỗ trợ: màn `/ho-tro`, hộp thoại `SupportTicketDialog` của người dùng công ty, cuộc trao đổi dùng chung `TicketThread`
  lib/                  format, helper, mock dùng chung, api client
    i18n/               từ điển vi/en (mỗi nhánh một file trong vi/, en/), provider, hook
    mock-db/            kho in-memory (LM-026). Quy ước tên: `<x>-model.ts` kiểu + hằng số + luật thuần, `db-<x>.ts` hàm kho (mọi hàm
                        đọc/ghi qua `ctx.scope`), `db-api-<x>.ts` hàm công khai, `seed-<x>.ts` dữ liệu mẫu. Đáng biết: `tenancy.ts` (cách ly theo
                        công ty của phiên; `tenancy.test.ts` liệt kê mọi hàm công khai), `session-role.ts` (người đăng nhập và kiểm vai trò),
                        `db-revisions.ts` + `revisions.ts` (revision bất biến, Duyệt, lần chạy tối ưu), `seed-phuong-nam.ts`, `seed-shift.ts`, `clock.ts` (đồng hồ mô phỏng), `tab-sync.ts` + `tab-sync-tables.ts` (đồng bộ
                        kho giữa các tab cùng trình duyệt; `app-db.ts` nối nó vào kho của app), `trip-stops.ts` (điểm giao tự sinh, thuần),
                        `trip-route.ts` (tuyến của chuyến), `trip-report.ts` (báo cáo chuyến, thuần), `verify-model.ts` (đối chiếu kiện ba
                        mức), `source-types.ts` + `db-api-review1.ts` (kiểu và hàm của loại kiện, loại xe, lần chạy, nhãn QR, seal)
  types/                type dùng từ hai feature trở lên
  domain/               logic nghiệp vụ THUẦN theo Spec — không React, không Three.js
    geometry/           số (roundCm, EPSILON), hộp, chồng lấn, biên thùng, 6 hướng đặt, lưới không gian
    models/             type contract Spec + zod schema; ba mục tiêu của phương án ứng viên `plan-objective.ts`
    constraints/        validation và ràng buộc, trả mã lỗi; phân tách hàng `segregation.ts`; luật duyệt `approval.ts`; xe có chở được hàng của
                        chuyến không `vehicle-fit.ts`; kiện còn trên xe có dỡ được theo thứ tự điểm mới không `stop-reorder.ts` (`checkStopReorder`)
    metrics/            tỷ lệ sử dụng, trọng tâm; tải trục trước / sau theo mô hình đòn bẩy `axle-load.ts`; độ lệch tải giữa hai nhóm trục
                        `axle-balance.ts`
    fixtures/           dữ liệu mẫu Spec mục 12
    cargo/              mở rộng quantity thành instance, trùng ID, mã kiện mới
    routing/            mock tối ưu tuyến: haversine, thứ tự điểm, ETA, mức hạn; hằng số ở `ROUTING_CONSTANTS`; xe mô phỏng dọc tuyến
                        `simulate.ts` (`simulateVehicle`, nhịp 30 giây ở `SIMULATION_CONSTANTS`) và ETA từ vị trí xe `liveEta`; mock tuyến thay
                        thế `reroute.ts` (`REROUTE_CONSTANTS`); luật thứ tự khi đổi điểm lúc xe đang chạy `reorder.ts` (`checkProposedOrder`)
    zones/              vùng theo điểm giao: `stopZones`, vùng của một kiện và số lần dỡ-xếp lại (`locateInZones`, `zonePlacements`)
    pickup/             nhận hàng dọc đường: mười luật `evaluatePickup`, chèn điểm `insertPickupStops`, vùng trống sau các điểm đã giao
                        `freedZones` (`freed-zones.ts`)
  services/
    optimization/       interface OptimizationService, MockOptimizationService, worker; mock xếp kệ theo vùng điểm giao (`shelf-packer.ts`,
                        `shelf-walls.ts`); ba phương án ứng viên một job (`mock-candidates.ts`, `candidate-layouts.ts`, `mock-plan.ts`); xếp kiện
                        nhận dọc đường vào vùng trống `reoptimize-freed-zone.ts`
  test/                 setup và dữ liệu test dùng chung (setup-dom.ts, spec-13.ts, placements.ts, engine-plans.ts)
tests/                  unit test của viewer3d (Vitest)
e2e/                    Playwright
```

Mỗi feature tự chứa component, hook, type của nó. Chỉ đưa lên `components/`, `lib/`
hoặc `types/` khi có **từ hai feature trở lên** dùng chung.

**`src/domain` và `src/services`** (D-19): không import React, Three.js, router hay
component. Mọi hàm tính toán ở đây là pure function có unit test. Feature và engine 3D gọi vào
domain, không bao giờ ngược lại. Three.js không quyết định tính hợp lệ của placement.

**Đặt mock ở đâu**: mock chỉ một feature dùng thì để trong feature đó
(`features/viewer3d/benchmark.mock.ts`). Dữ liệu nghiệp vụ nhiều feature dùng chung nằm ở kho `lib/mock-db`, không
thêm mock riêng lên `lib/`.

## 4. Design tokens

Đặt trong `src/index.css`. Mọi màu, khoảng cách, bo góc **phải** lấy từ đây, không hardcode hex trong component.

Tailwind v4 nối token qua khối `@theme inline`, nên `bg-surface`, `text-text-2`,
`rounded-md`… trỏ thẳng vào `var()` chứ không sao chép giá trị. Sửa token chỉ ở một chỗ.

### V2.3 "Cyan kính"

Bản thiết kế đã chốt nằm ở `design/v2.3/` (`README.md` thứ tự làm, `SCREENS.md` màn → route, `CHANGES.md` việc cần làm). Token **giữ tên cũ**,
giá trị cyan, thêm thang `--cyan-*`, `--n-*`, `--amber/azure/green/red-*`, `--sky`, `--card-shadow`, `--glass-dark*`, `--primary-fill-*`,
`--on-primary`, `--font-display`. Khối dưới đây là trạng thái hiện tại; chỗ nào luật cũ ở mục 4–5 khác V2.3 thì theo V2.3.
`design/v2.3/tokens/v3.css` chỉ để tham chiếu, không import vào `src/`.

- `@theme` xoá thang mặc định `cyan/amber/green/red` của Tailwind rồi khai lại bằng token (cùng `violet`/`purple` để không lọt màu tím): `bg-cyan-600`, `text-red-700`… là màu
  của bảng này, không có bậc nào ngoài bảng (`bg-red-300` không sinh class).
- `font-display` là họ chữ trong `cn()` (`THEME_FONT_FAMILIES` của `lib/utils.ts`); thêm họ chữ mới vào `@theme` thì thêm tên vào đó.
- Token riêng của dải trời và thành phần: `--sky-end`, `--sky-h`, `--sky-dots`, `--sky-overlap`, `--sky-text*`, `--sky-glass*`, `--sky-solid*`,
  `--nav-on*`, `--avatar-fill`, `--logo-*` (ba màu logo), `--scrim`, `--danger-shadow`, `--meter-fill`, `--focus-ring`, `--error-ring`,
  `--table-head`, `--spring` (chuyển động của chỉ báo trượt). Lớp dùng chung trong `index.css`: `.sky`, `.glass-nav`, `.glass-dark`,
  `.glass-follow` (chỉ báo điều hướng, mục 1), utility `sky-overlap`.

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
Thêm **Archivo** (variable, `--font-display`, độ rộng 106–112 %) cho tiêu đề màn, tiêu đề card /
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
| lede | 13,5/22 | câu mô tả dưới tiêu đề màn (`PageHero`) |
| micro | 11/14 | nhãn trục biểu đồ, nhãn trong panel nổi |
| note | 11,5/17 | ghi chú nguồn của ô số liệu (`KpiTile`) |
| small | 13/18 | chữ phụ trong card, ghi chú đầu card, nút `sm`, mô tả toast |
| fine | 12,5/18 | chip trạng thái, gợi ý và lỗi dưới ô nhập, tooltip |

**Số liệu lớn** không nằm trong thang trên vì chúng là hình khối chứ không phải chữ đọc:
`18px` mã kiện trên header · `22px` mã chuyến · `40px` tỷ lệ lấp đầy trong hộp thoại — JetBrains Mono.
Số KPI `26px` dùng **Be Vietnam Pro** `tabular-nums`, không mono: mono dành cho mã và số
đo đọc trong bảng, số tổng hợp là nội dung thông thường. Không phát sinh thêm cỡ ngoài danh sách này.

Spacing bội số 4px.

**Token cỡ chữ và `cn()`** (LM-055): `cn()` trong `lib/utils.ts` dùng
tailwind-merge đã khai báo các cỡ chữ của `@theme` (`display`, `h1`, `h2`, `h3`, `body-lg`, `body`,
`caption`, `micro`, `note`, `lede`). Thiếu khai báo thì tailwind-merge coi `text-body` là màu chữ và **bỏ mất `text-white`**
của nút. Thêm token `--text-*` mới vào `@theme` thì phải thêm tên vào `THEME_FONT_SIZES`.

**Nguồn quét class của Tailwind** (LM-005): `src/index.css` khai báo
`@import 'tailwindcss' source('.')` — chỉ quét `src/`. Không bỏ `source('.')`: mặc định Tailwind v4 quét
cả gốc repo (`AGENTS.md`, `docs/` và các thư mục tạm) và **tải lại toàn trang** dev server
mỗi khi một file ngoài app đổi, làm mất state và làm E2E đỏ ngẫu nhiên. Class chỉ được sinh từ code
trong `src/`; muốn dùng class từ nơi khác thì thêm `@source` tường minh.

## 5. Luật thành phần

### Nút

- Nút chính: cao 40px desktop, **56px tablet và điện thoại**. Padding ngang 16px. Chữ 14px weight 600. Nền gradient dọc `--primary-fill-from → --primary-fill-to`,
  viền 1 px `--primary-fill-border`, **chữ tối `--on-primary`** (7,7:1), bo `--r-md` (10 px), phản sáng trong 1 px và quầng
  cyan nhẹ. `--primary` (cyan-700) dành cho link, vòng focus, ô đã chọn và biểu đồ — không tô nền nút bằng nó. Vẫn một nút chính mỗi màn.
- Màn **điều phối** (danh sách/chi tiết/form chuyến, kiện, thiết lập tối ưu, so sánh, đội xe, dashboard) tạm thời
  **chỉ hỗ trợ desktop**: nút giữ 40px, không bắt buộc 56px. Luật 56px áp cho màn cảm ứng: kho, tài xế, Planner 3D.
- Hover chỉ đổi nền, **không** phóng to, **không** nhấc lên. Nút chính: gradient trượt xuống một bậc cyan (`--primary-fill-hover-from →
  --primary-fill-hover-to`, chữ tối vẫn 5,8:1). Vô hiệu hoá: bỏ gradient, nền `--border`, chữ `--text-disabled`, không bóng.
- Focus: vòng 2px `--primary` cách 2px. Tailwind v4: `outline-none` tắt biến `--tw-outline-style`,
  nên `index.css` đặt lại `solid` cho `:focus-visible` ngoài `@layer` để `focus-visible:outline-2` vẽ được vòng — không bỏ rule đó.
- Loading: giữ nguyên chiều rộng, thêm spinner 16px bên trái chữ.
- Nút phụ: nền trắng, viền 1px `--border`. Nút ghost: trong suốt. Nút nguy hiểm: nền đặc `--danger`. Nút phụ có bóng 1 px (`--e1`), nút nguy hiểm có quầng đỏ (`--danger-shadow`); thêm `variant="glass"` cho
  nút phụ **trên nền tối** (dải trời, khung 3D) và cỡ `sm` 32 px / `lg` 48 px. Nút phụ trên dải trời dùng `glass`, không dùng nút trắng.
- Nút chỉ có icon: 36×36 desktop, 48×48 di động.
- Nút dùng `asChild` bọc `<Link>` thì **không kèm spinner** — Radix `Slot` chỉ nhận đúng một phần tử con.
- Hành động bị chặn vì luật (tự khoá mình, người quản trị cuối cùng, ngoài phạm vi của vai trò…; LM-092) hiện mờ kèm lý do ngay tại chỗ, không để
  bấm rồi mới báo lỗi; luật cần dữ liệu khác thì để kho trả mã và hiện bằng `dataErrorMessage`.
- Lớp nổi mở từ trong hộp thoại (Select) phải cao hơn lớp phủ Dialog (`z-300`): `SelectContent` dùng `z-400`.
- Biểu đồ 2D (LM-090) dùng token qua `var()`: một chuỗi một màu `--primary`, không chú giải; tám màu điểm giao chỉ cho điểm giao;
  lưới `--border` 1 px; nhãn trục micro 11 px, số mono; cột ≤ 24 px bo 4 px đầu dữ liệu; tắt animation; tooltip là lớp nổi (`--e2`).
  Hình `aria-hidden`, có bảng số `sr-only` cùng giá trị (`ChartCard`/`ChartTable`).

### Thành phần V2.3

Mẫu: `design/v2.3/screens/web/ThanhPhan.jpg`, `TrangThaiChung.jpg`, `MenuToanCuc.jpg`; kiểu gốc `design/v2.3/tokens/v3.css` (LM-102).

- **Chip trạng thái** (`Badge`, `StatusBadge`): cao 26, chữ `fine` 600, nền tint không viền. **Ngữ pháp chấm**: đặc = trạng thái · vòng
  rỗng = chờ người kế tiếp · quầng = đang chạy · quay = đang tính. Màu kể giai đoạn của chuyến: xám nháp, hổ phách cần bạn (đã tối ưu vòng
  rỗng, cần xem lại có quầng + viền), cyan đã duyệt, **xanh lam** đang chạy (đang tối ưu, đang xếp, đã xếp xong vòng rỗng, đang giao), xanh lá
  hoàn thành, đã huỷ chip đỏ trọn (không gạch chữ). Xe: sẵn sàng xanh lá, đang phục vụ chuyến xanh lam có quầng, bảo dưỡng xám. Tài khoản: đang
  hoạt động xanh lá, đã khoá xám. `shape="tag"` (20 px) cho phiên bản, "Đã chỉnh tay" (xanh lam) và **MOCK RESULT** (`tone="mock"`).
  Thang **xanh lam** `--azure-*` (khác hẳn cyan thương hiệu) cho "đang chạy"; `@theme` xoá thang `violet`/`purple` của Tailwind: không dùng tím ở
  đâu trong app. "Đã huỷ" là chip đỏ trọn, không gạch chữ.
  Chuyến có **6 trạng thái của backend** (`DRAFT`, `PLANNED`, `LOADING`, `IN_TRANSIT`,
  `DELIVERED`, `CANCELLED`): nháp xám đặc · đã lập kế hoạch cyan đặc · đang xếp hàng và đang vận chuyển xanh lam có quầng · đã giao
  xanh lá đặc · đã huỷ đỏ đặc. "Đang tối ưu" là tiến trình job (hộp thoại tối ưu), không phải trạng thái. Phương án và tiến độ kho là
  **dòng phụ** `TripSubStatusTag` cạnh/dưới chip (`shape="tag"`) — màu "cần bạn" (hổ phách) nằm ở dòng phụ: dưới Đã lập kế hoạch là
  "Chờ duyệt" hổ phách chấm vòng rỗng, "Đã duyệt" cyan, "Lỗi thời — cần tối ưu lại" hổ phách có viền; dưới Đang xếp hàng là "Đang xếp
  110 / 280" và "Xếp xong — chờ xuất phát" xanh lam, và "Thiếu kiện — chờ điều phối" hổ phách có viền khi kho còn báo thiếu chờ quyết (FE-6-02).
  Tuyến đã tối ưu có điểm tới nơi sau hạn thì
  thêm một dòng phụ thứ hai "Có điểm trễ hạn dự kiến" hổ phách có viền, **đứng cạnh** dòng phụ của phương án (danh sách chuyến, đầu Chi
  tiết chuyến — `tripRouteSubStatus`, FE-4b-09), không thay nó. Chuyến đang xếp hoặc đang giao còn xác nhận tay
  chờ duyệt có dòng phụ thứ hai "Chờ duyệt xác nhận tay (n)" hổ phách chấm vòng rỗng (`tripManualSubStatus`), cùng chỗ đó (FE-6-04). Màn cảm ứng (kho, tài xế) phóng nhãn phụ lên 16 px cùng chip.
- **Card**: `Card`/`CardHeader`/`CardTitle` (Archivo 650 16/22)/`CardMeta`/`CardActions`; bo 14, `--card-shadow`.
- **Ô nhập** (`components/ui/field-styles.tsx`, dùng chung cho Input, Textarea, Select, SelectField): nhãn `small` 600 `--ink-2`, viền
  `--line-strong`, focus viền `--cyan-500` + quầng `--focus-ring` (thay vòng outline), lỗi viền đỏ + `--error-ring` + icon.
  Dấu `*` bắt buộc là `aria-hidden`, ô có `aria-required`: tên truy cập giữ đúng chữ nhãn ("Tên xe", không
  "Tên xe *") — test đọc nhãn bằng `exact: true`.
- **Tab**: `TabsList tone="light"` gạch chân `--cyan-500` trên nền trắng; `TabCount` Archivo, `tone="warn"` nền hổ phách; số của
  `TabCount` viết theo ngôn ngữ đang chọn ("2.714" · "2,714").
  `tone="sky"` là **nhóm tab kính** trong dải trời: khay `--sky-glass` viền bo 12, tab 36 px bo 10, tab mở là
  kính cyan của thanh điều hướng (`--nav-on`); khay căn trái theo tiêu đề và cách card đè dải 16 px, số 0 mờ đi.
- **Hộp thoại**: bo 18, lớp phủ `--scrim`; `DialogHeader` có ô icon 40 px theo nghĩa; chân nền `--n-25`, nút dồn phải.
  **Tờ trượt từ đáy** (V2.3 đợt 6): `DialogContent sheet` là biến thể trình bày của chính hộp thoại Radix — dưới 768 px hộp thoại trượt
  lên từ đáy (bo góc trên `--r-xl`, thanh nắm chỉ để trang trí, nội dung cuộn bên trong, cao tối đa `100dvh − 5rem`, dùng `dvh` để bàn phím ảo không che ô đang nhập,
  chân hộp thoại `sticky bottom-0`), từ 768 px vẫn ở giữa màn; focus trap, Esc, tiêu đề có nhãn không đổi, reduced-motion theo luật chung. Dùng ở màn tài xế:
  "Báo sự cố" của kiện (`ReportIssueDialog`), "Sự cố trên đường" (`ReportExceptionDialog touch`), tờ "Thêm" (`StopMoreActions`), hộp đối chiếu ba mức (`PackageVerify`, cũng dùng ở kho: máy tính bảng từ 768 px vẫn là hộp giữa màn) và hộp nhận hàng dọc đường
  (`PickupRequestDialog`, điều phối viên trên desktop vẫn là hộp giữa màn). **Toast ở màn cảm ứng của kho và tài xế**: không có toast thành công khi chính
  màn đã cho thấy kết quả (banner giờ đến, dòng kiện đổi trạng thái, số liệu tiến độ, sang điểm giao kế tiếp, vùng kết quả trong hộp đối chiếu, số seal đã ghi);
  nơi thay toast là vùng đọc được bằng trình đọc màn hình (`role="status"` / `aria-live`). Lỗi và cảnh báo (khách từ chối, xác nhận tay chờ duyệt, báo thiếu,
  kiện hỏng) luôn có toast. Toast thành công chỉ giữ khi màn không cho thấy gì khác.
- **Toast**: bo 14, ô icon 30 px tô theo nghĩa; đặt dưới nút hành động của dải trời (`offset` 152).
- **Banner** (`components/Banner.tsx`): info / warning / danger / neutral, hành động dồn phải. `TripLockBanner` dựng trên nó.
- **Trạng thái rỗng**: không khung nét đứt; ô minh hoạ 64 px bo 18 theo nghĩa (`icon` + `tone`), tiêu đề Archivo 700. Màn không có dữ liệu
  dùng Lumo (`mascot`, LM-105) thay ô icon; `compact` 96 px trong card; `wide` cho mô tả tới 520 px trong card rộng (LM-106).
- **Menu, Select, tooltip**: menu trắng đặc bo 14 padding 6, mục 36 px, `tone="danger"`; tooltip nền `--cyan-950`.

### V2.3 đợt 7 — đội xe, quản trị, đăng nhập, hồ sơ, màn lỗi

Mẫu: `design/v2.3/screens/web/DoiXe.jpg`, `ChiTietXe.jpg`, `NguoiDung.jpg`, `MaTranQuyen.jpg`, `NhatKy.jpg`, `DangNhap.jpg`, `HoSo.jpg`.

- **Vai trò** hiện bằng `components/RoleBadge` (nhãn slate, icon theo vai trò, tên từ từ điển; `size` `sm` | `md`): bảng và panel người dùng,
  dưới tên người làm ở Nhật ký, hộp tài khoản dùng thử, thẻ nhận diện của Hồ sơ.
- **Đội xe**: dòng dưới tiêu đề là số đếm từ danh sách xe (`FleetHeroSummary`). Cột lòng thùng vẽ hình nhìn từ trên bằng SVG, cùng tỉ lệ cho
  mọi dòng (`vehicle-top-view.ts`; vật cản xám, cạnh cửa sau cyan) kèm thể tích m³. Cột trạng thái ghi mã chuyến kèm pha của chuyến
  (`fetchVehicleStates` đọc thêm `listTrips` khi có xe đang chạy) hoặc "Từ ngày · ghi chú bảo dưỡng". Bốn `KpiTile` vẫn là công tắc lọc.
- **Form xe**: `PageHero` (crumbs, chip trạng thái ở `badge`, nút Lưu là nút chính duy nhất), một thẻ ba phần đánh số (`VehicleFormSection`),
  thẻ xem trước 3D nền tối đặc, tóm tắt lỗi đánh số; bảng vật cản giữ hai dòng mỗi vật cản. Mọi ô bắt buộc có dấu `*` (`aria-hidden`):
  test tìm ô bằng role + `name`, không bằng `getByLabel` khớp cả chuỗi.
- **Người dùng**: dòng dưới tiêu đề là số đếm từ danh sách người xem đọc được; dòng đang chọn có vạch cyan bên trái; nút thao tác của panel
  rộng hết panel. Kho không lưu ai khoá và khoá lúc nào nên panel không có dòng "Khoá lúc … bởi …".
- **Ma trận quyền** dựng bằng `<table>` riêng, không qua `DataTable` (có dòng khu vực và dòng tổng giữa các dòng dữ liệu). Quyền xếp theo khu vực
  ở `admin/permission-groups.ts` — suy từ tiền tố mã quyền, giữ đúng thứ tự `PERMISSIONS`, có test canh; thêm quyền thì thêm tiền tố và nhãn
  `admin.permissions.groups`. Số tài khoản dưới tên vai trò: quản trị hệ thống thấy đủ tám vai trò, quản trị công ty chỉ năm vai trò công ty
  (không liệt kê được tài khoản nền tảng, ghi "0" là sai).
- **Nhật ký** vẫn là bảng. Khoảng ngày là nút `AuditDateRange` mở bảng nhỏ (Dialog Radix không modal; tham số `tu`, `den` giữ nguyên); nút ghi
  ngày bằng `format` của app, hai ô nhập bên trong là ô ngày của trình duyệt. Sự kiện có `before` + `after` hiện chip "trước → sau"
  (`audit-change.ts`, chữ đầy đủ ở `sr-only`). Nhãn "Chỉ đọc" là `badge` của `PageHero`.
- **Đăng nhập**: card trắng đặc nổi trên nền `.sky` toàn trang, không kính. Hộp tài khoản dùng thử tự cuộn trong card từ 1.024 px (trang không
  cuộn ở 1.366×768); nút "VI | EN" (`LanguageSwitch tone="sky"`, 56 px trên máy cảm ứng) nằm trong `<header>` ngoài `main` — test đếm nhóm tài
  khoản dùng thử đếm trong `main`. Hình đẳng cự và ba ý chính ở bên phải, ẩn dưới 1.024 px.
- **Ô mật khẩu** dùng `components/ui/PasswordInput`: nút mắt `type="button"` có `aria-pressed`, tên "Hiện mật khẩu" / "Ẩn mật khẩu"
  (`auth.passwordToggle`); khi đang hiện thì tắt soát chính tả / tự sửa chữ, và tự ẩn lại lúc form gửi đi. Tên truy cập của ô vẫn là chữ nhãn.
- **Nhãn, gợi ý và lỗi của ô nhập** (`field-styles.tsx`) lên 16 px trên máy có con trỏ cảm ứng; máy bàn giữ 13 / 12,5 px.
- **Hồ sơ**: thẻ nhận diện bên trái, hai thẻ form riêng bên phải, thẻ đầu đè lên dải trời (`overlap`). **Màn lỗi** 404 / 403 / lỗi tải dùng
  `ErrorScreen`: card trắng bo 18 giữa trang, Lumo, chip mã, "Về màn chính" là nút chính; ngoài khung ứng dụng có dải trời mang logo.

### Thanh tiêu đề màn

**Planner** (LM-094, LM-107): từ 1.366 px thanh trên 56 px là hàng điều khiển duy nhất (mã chuyến, MOCK RESULT, chỉ số, Xếp/Dỡ, điểm giao, góc
nhìn, trạng thái duyệt, Chỉnh sửa, So sánh, Duyệt); hẹp hơn thì điều khiển mô phỏng và Chỉnh sửa xuống thanh công cụ riêng (tablet hai hàng 56
px). Thêm gì vào hàng này phải đo lại ở 1.366 px (`e2e/planner-compact.spec.ts`). Thanh công cụ Planner dùng `PlannerSelect` (Select Radix); ô
chọn kiện (tới 1.000 dòng) giữ `<select>` gốc. Trang Planner nền tối `--canvas-1`; thanh trên là kính tối (`.glass-dark`) nổi cách mép 14 px từ
1.280 px, vẫn cao 56 px. Tiêu đề là tên tuyến **chỉ từ 1.680 px**; hẹp hơn là mã chuyến và dòng dưới chỉ còn mã revision — không cắt chữ bằng dấu
ba chấm (`layout-1366`). Nhãn "Duyệt bởi <tên> lúc" mang họ tên người duyệt (FE-0-07): rộng tới 208 px (điện thoại 160 px; tên dài hơn cắt bằng
dấu ba chấm, tên đầy đủ ở `title`), và từ 1.536 tới dưới 1.760 px — nơi nút So sánh phương án có chữ (chỉ icon dưới 1.536 px) — nhãn chỉ hiện
"Đã duyệt lúc", tên người duyệt ở `title`; không làm vậy thì nhãn "Đã chỉnh tay" (1.536 px) và tên tuyến (1.680 px) đè lên chỉ số. `planner-compact` đo
thêm bản đã duyệt ở 1.680 px và bản đã duyệt có chỉnh tay ở 1.536 px. Revision là phương án ứng viên (hoặc bản duyệt dựng từ nó) của một lần
chạy nhiều phương án thì khối tiêu đề có nhãn **một chữ cái** A · B · C cạnh MOCK RESULT (tên đầy đủ "Phương án C" ở `title` và cho trình đọc màn
hình — nhãn có chữ không vừa 1.366 px; FE-5b-06), và nút So sánh mở `/chuyen/:id/so-sanh?lan-chay=<mã lần chạy>`; revision khác vẫn mở ma trận mọi
revision (`fetchPlanApproval` trả `candidate`). Bản đã chỉnh tay không kèm chữ cái — nhãn "Đã chỉnh tay" nói thay, hai nhãn cùng lúc không vừa 1.536
px — nhưng nút So sánh vẫn mở lần chạy đó. Nút "Đổi xe" **không** nằm trên hàng này mà ở góc dưới phải khung 3D (mục 7 "Operations", FE-5b-08).
Thanh thông báo (lỗi thời, khoá theo pha, bản chưa duyệt, chỉ xem) nằm trong luồng trang giữa thanh trên và khung 3D (`PlannerNotices`), không
nổi đè lên cảnh. Panel trong khung 3D dùng kính tối; bề mặt đọc lâu (hộp Chi tiết / Hiển thị, thẻ kiện đang chọn) nền tối đặc. Nhãn neo trên
kiện là thẻ tối hai dòng (vai trò · điểm giao / mã kiện) dựng bằng DOM/SVG, nền đặc 85 % thay `backdrop-filter` vì chúng di chuyển mỗi khung hình.
Nút nhấn giữ (Xếp/Dỡ, Theo bước) là nền cyan mờ + viền trong, không gradient. Số đo và mã giữ JetBrains Mono; đơn vị có khoảng trắng thật sau số
("120 × 100 × 100 cm", "200,0 kg").

**PageHero** (V2.3): thanh tiêu đề của màn trong khung ứng dụng nằm trên **dải trời** nên cao theo nội dung (tiêu đề 32 px + mô tả, thêm tab nếu màn
có), không cố định chiều cao. Chỉ **56px** cho màn xem phương án 3D, vì ở đó chiều cao nhường cho khung 3D. Màn trong khung ứng dụng dùng
`components/PageHero.tsx` trên dải trời (`.sky`): tiêu đề h1 **Archivo 700 32 px rộng 112 %** chữ trắng, `meta` (số đếm, mã) mono `--sky-text-3`,
một câu mô tả từ nhánh `pageHero` của từ điển, hành động ở phải, tab của màn (`TabsList tone="sky"`) truyền làm `children`. Luật của nó: `<h1>` chỉ
chứa chữ tiêu đề (test đọc `exact: true`); hành động nằm trong **cùng** `<header>` với tiêu đề; mô tả ẩn dưới 768 px. Mô tả nói màn dùng để làm gì —
không số, không trạng thái. Ngoại lệ (LM-103): dòng dưới tiêu đề được là **dòng số đếm lấy từ kho** (danh sách chuyến: "15 chuyến · 3 đang chạy ·
2 cần bạn xử lý") hoặc **dòng dữ liệu của đối tượng** (chi tiết chuyến: ngày chạy · xe · tài xế) — không bao giờ là số nghĩ ra. Chi tiết chuyến
dùng `PageHero` với tên tuyến, `crumbs` ("Chuyến hàng / TRIP-…"), `badge` (chip trạng thái, nằm ngoài `<h1>`) và `children` là bước tiến trình +
banner theo pha. Thanh 56 px của Planner vẫn là header riêng theo lề `px-shell`. Không đưa hoạ tiết đường nét phía sau tiêu đề vào production.
**Dải trời nối liền**: thanh điều hướng và `PageHero` là hai phần tử cùng lớp `.sky` gắn ảnh vào khung nhìn (`background-attachment: fixed`), không
phải một khối bọc. **Card đè lên dải**: `overlap` kéo dải thêm `--sky-overlap` (44 px) và vùng cuộn đặt `sky-overlap` (`margin-top: -44px`, lề trên
0). Chỉ bật khi thứ đầu tiên của vùng cuộn là card nền đặc — chữ trần trên dải trời không đọc được (Bảng điều khiển có dòng chọn kỳ: chưa bật).

Lề ngang của thanh điều hướng, thanh tiêu đề và vùng cuộn dùng utility `px-shell` (`index.css`): 24 px, và khi cột rộng hơn `--shell-max` thì nội
dung dừng ở `--shell-max`, căn giữa. Là padding chứ không phải một div `max-w` bọc ngoài, để vùng cuộn vẫn rộng hết cột (thanh cuộn ở mép) và nền
chrome vẫn tràn ngang — trên màn 2K logo, mục điều hướng, tiêu đề và nội dung cùng thẳng một cột. Không đặt lại `px-6`/`px-8` cho màn trong khung
ứng dụng.

**Ô số liệu** là `components/KpiTile.tsx`: **card nền đặc** (bo `--r-lg`, viền, `--card-shadow`); `variant="sky"` là ô kính tối chỉ đặt trên dải
trời. Icon trên nền tint theo nghĩa cố định (mục 4); số 26 px **Archivo 700** `tabular-nums` `--ink-strong` (không mono — mono dành cho mã); nhãn
`--ink-2`; ghi chú nguồn cỡ `note` `--ink-3`. Mọi số cùng màu mực — màu chỉ ở icon, không nói số tốt hay xấu. Vỏ ngoài `role="group"` +
`aria-label` = nhãn; `value` và `unit` là hai text node liền nhau, không khoảng trắng JSX ở giữa. Ô số liệu làm **công tắc lọc** (Đội xe): truyền
`onPress` + `pressed`; ô dựng `<button aria-pressed>` **bên trong** vỏ group, không biến vỏ thành nút. Bấm đi qua `list.setFilter` của
`useListUrlState` (URL đổi, cùng bộ lọc với ô chọn), bấm lại ô đang lọc thì bỏ lọc. Rê chuột đổi viền sang `--cyan-300`, không phóng to, không nâng
bóng; đang lọc: viền `--primary` đậm gấp đôi. Số của ô đếm trên cả tập dữ liệu, không theo ô tìm.

### Thương hiệu

Nguồn: `design/brand/` (`source/` là file người dùng giao; `logo-mark*.svg`, `logo-horizontal*.png` là bản xuất). Kế hoạch và quyết định (LM-105):
[LM-105](docs/issues/LM-105-thuong-hieu.md).

- **Logo** là biểu tượng khối (nắp · chữ L · chữ n) dựng lại bằng SVG: `components/brand/LogoMark.tsx` (`tone` `color` nền sáng · `dark`
  nền tối, chữ n trắng · `mono` `currentColor` cho giấy in) và `components/brand/Logo.tsx` (biểu tượng + chữ "LoadMaster" Archivo 700 +
  khẩu hiệu tuỳ chọn, `role="img"`, trong liên kết đã có nhãn thì `decorative`). Ba màu `--logo-sky`, `--logo-blue`, `--logo-navy`
  **chỉ dùng trong logo** — giao diện vẫn cyan; logo giữ màu xanh gốc.
- Khẩu hiệu "Plan smarter. Load further." (`BRAND_TAGLINE`) và tên linh vật **Lumo** là tên riêng: tiếng Anh ở mọi ngôn ngữ, không vào
  từ điển. Khẩu hiệu viết như câu, không viết hoa giãn chữ như bản gốc (luật "Cấm tuyệt đối").
- Chỗ đặt: thanh điều hướng, màn đăng nhập (logo ngang + khẩu hiệu), màn lỗi / 404 / 403, trang tài liệu (`BrandCard` ở `/thanh-phan`),
  `favicon.svg` (chữ n đổi trắng khi tab tối), `apple-touch-icon.png`, `icon-192/512.png`, `manifest.webmanifest`, README; bản
  `mono` ở góc **nhãn QR** (in đen trắng dán lên kiện) và đầu **báo cáo chuyến bản in**; thanh màn chính của kho (`/kho`). **Không** đặt
  logo ở thanh của tài xế (điện thoại 360–390 px: tiêu đề gãy ba dòng) và ở thanh phiên xếp / điểm giao (một thao tác mỗi màn).
- Nhỏ nhất 16 px; chừa trống quanh logo ít nhất một phần tư chiều cao biểu tượng. Không đổ bóng, không đặt logo trong ô màu.
- **Lumo** (`components/brand/Lumo.tsx`, `pose`; ảnh WebP 320 px khoảng 20 KB mỗi tư thế ở `src/assets/brand/lumo/`, tải theo màn):
  mỗi tư thế **một nghĩa cố định** — `greet` chào (đăng nhập) · `empty` chưa có dữ liệu (danh sách rỗng) · `notFound` không tìm thấy (404)
  · `error` có sự cố (lỗi tải, 403, lỗi render, chuyến đã huỷ ở kho / tài xế) · `done` xong việc lớn (kho xếp xong, tài xế giao xong)
  · `warehouseWaiting` kho chờ hàng · `driverWaiting` tài xế chờ chuyến. Trạng thái rỗng dùng `EmptyState mascot`
  (`compact` 96 px trong card); `ErrorScreen` bắt buộc `mascot`; `WarehouseEmpty` / `DriverNotice` mặc định tư thế chờ. Luôn `alt=""` +
  `aria-hidden`, không động. **Không** ở bảng, form, Planner, bảng điều khiển (kể cả kỳ không có dữ liệu), toast, hộp thoại; ở màn kho và
  tài xế chỉ màn rỗng, màn lỗi và màn xong việc.

### Cấm tuyệt đối

- Không dùng chữ gạch chân làm nút hành động. Gạch chân chỉ cho link trong đoạn văn.
- Không gradient trên nút, card hay thanh tiêu đề. Ngoại lệ, đều khai trong token: nền **nút chính** (`--primary-fill-*`), **dải trời** `--sky`
  đầu màn (thanh điều hướng + tiêu đề + tab) và thanh tiến độ/thước đo. Card, bảng, form, hộp thoại vẫn nền đặc; nền trang là `--app` phẳng.
- Kính (blur nền, viền sáng) dùng **theo lớp**, không rải tuỳ ý. **Được** ở chrome điều hướng (`.glass-nav` trên dải trời) và panel điều khiển
  nổi đè lên khung 3D nền tối (`.glass-dark`): kính là kính **tối**. Ô số liệu là card nền đặc. **Không** ở bảng, form, inspector và mọi bề mặt
  người dùng đọc lâu — những chỗ đó giữ nền đặc, phân tách bằng viền 1px. Không lồng kính trong kính. Luôn có nền đặc dự phòng khi trình duyệt
  thiếu `backdrop-filter`, và tôn trọng `prefers-reduced-transparency`. Viền phát sáng không dùng ngoài các chỗ kể trên. Màn kho và tài xế dùng
  điều khiển đặc (mục 1); blur ở đó (tablet trong kho sáng, đeo găng; điện thoại ngoài nắng) chưa có số đo tương phản và FPS trên thiết bị thật,
  phải đo trước khi coi kính ở hai màn đó là đã chốt.
- Toast nằm dưới thanh tiêu đề (`offset` trên 80 px): không che nút hành động ở góc phải header — rê chuột lên toast làm nó dừng đếm giờ
  (LM-101 phát hiện toast che nút Duyệt của Planner). Thanh trên của màn kho cao 80 px, thấp hơn `offset` 152 px của toast nên toast không che nút
  nào của thanh; `offset` không đổi. Đổi chiều cao thanh `TouchTopBar` thì kiểm lại con số này.
- Không đổ bóng lên card, trừ `--card-shadow` rất nhẹ (bo `--r-lg` 14 px); không thêm bóng nào khác, không nâng card khi rê chuột. Card phân tách
  bằng viền 1px `--border`. Bóng chỉ dùng cho dropdown, modal, toast, popover, và **thẻ đang được kéo** (lúc đó nó là lớp đang nhấc khỏi mặt phẳng).
- Không emoji trong giao diện. Icon dùng Lucide, nét 1,5px, cỡ 16/20/24.
- Không viết hoa toàn bộ, không giãn chữ trang trí.
- Không bo góc tròn hoàn toàn cho nút hành động. Dạng viên thuốc chỉ cho badge, chip lọc và thanh tiến độ.
- Chỉ dùng ba độ đậm chữ: 400, 500, 600. Riêng Archivo (`--font-display`) được 650 và 700 cho tiêu đề và số lớn.
- Không dùng màu ngoài bảng token. Tám màu điểm giao **chỉ** để định danh điểm giao, không dùng trang trí.
- Không kẻ sọc xen kẽ cho bảng. Dùng đường phân cách 1px.
- Không dữ liệu giả kiểu Lorem hay "Sample Item 1". Dùng dữ liệu tiếng Việt thật khi làm mẫu.

### Bố cục: màn có dữ liệu và màn không có dữ liệu

- **Màn vận hành** (có dữ liệu): nội dung căn trái, bám mép trên, không tiêu đề khổng lồ căn giữa, không hình minh hoạ lớn. Đây là mặc định.
- **Màn không có dữ liệu** (đăng nhập, 404, trạng thái rỗng): được phép bố cục hai cột, căn giữa theo chiều dọc, và có hình minh hoạ. Hình minh
  hoạ phải dựng từ chính sản phẩm (phép chiếu đẳng cự ở `lib/isometric.ts`, bảng màu điểm giao) hoặc là linh vật **Lumo** (LM-105, theo bảng tư thế
  ở mục "Thương hiệu"); không mượn ảnh trang trí bên ngoài.

**Cuộn trong khung ứng dụng**: trang không bao giờ cuộn; mỗi màn tự cuộn vùng nội dung của nó. `AppShell` đặt màn
trong một **hàng** flex `relative min-h-0` dưới thanh điều hướng. Gốc màn `flex min-w-0 flex-1 flex-col`, vùng cuộn
`min-h-0 flex-1 overflow-auto`. Ba lỗi đã gặp, cả ba chỉ lộ khi lăn chuột thật:
- Đặt màn thẳng vào cột flex: gốc màn cao theo nội dung (`min-height: auto`), `overflow-hidden` của khung cắt phần dưới.
- Con `overflow-hidden` trực tiếp của cột flex (khung bo góc quanh bảng) được **co về 0** — phải `flex-none`, không thì bảng bị
  cắt còn chiều cao khung và vùng cuộn không có gì để cuộn (nhật ký 50 dòng chỉ thấy 10).
- Phần tử `absolute` không có tổ tiên định vị (`sr-only` của biểu đồ, ô ẩn của Radix) kéo cả tài liệu dài ra, trang cuộn và đẩy thanh
  điều hướng khỏi màn — hàng chứa màn phải `relative`.

### Phân cấp thị giác

Mỗi màn hình chỉ có **đúng một** hành động chính dùng nút primary. Mọi hành động khác dùng nút phụ hoặc ghost.

Không phải thứ gì cũng cần card. Nhóm nội dung bằng khoảng trắng trước, viền sau, nền surface cuối cùng.

### Bảng dữ liệu

Bảng có trạng thái theo dòng — menu thao tác, hộp thoại mở từ dòng — **phải** truyền `getRowId` cho `DataTable` (LM-101). Mặc định của TanStack là
khoá theo **vị trí**: lọc hay sắp xếp trong lúc menu đang mở thì dòng bị gỡ (menu biến mất) hoặc menu nhảy sang người khác và thao tác chạy nhầm
đối tượng. Chỉ truyền khi mã chắc chắn duy nhất — kiện có thể trùng mã khi dữ liệu còn lỗi, bảng kiện giữ khoá theo vị trí.

TanStack Table v9 dựng mỗi hàm `cell`/`header` thành **một component** (`createElement(columnDef.cell)`): dựng lại mảng cột là mọi ô gỡ ra gắn lại —
menu Radix đang mở trong ô bị rời khỏi DOM giữa cú bấm. Màn Người dùng từng gặp: cột memo theo `users`, truy vấn `staleTime: 0` về lại sau đăng nhập,
menu "Khoá tài khoản" biến mất (E2E đỏ 1/4 lần). Bảng có trạng thái trong ô (menu, hộp thoại, ô nhập): khai hàm ô **một lần ở cấp module**, giá trị
thay đổi (dữ liệu, người đang chọn, callback) đưa qua context hoặc `meta` của bảng; chỉ dựng lại cột khi đổi ngôn ngữ hay đổi tập cột
(`features/admin/users-table-context.ts`).

Ảnh đại diện chữ cái đầu trong nội dung (bảng người dùng, nhật ký, hồ sơ, panel) là **ô vuông bo góc**; hình tròn chỉ ở nút tài khoản trên thanh điều
hướng và menu tài khoản.

Chiều cao dòng cố định (48px thoáng, 36px gọn, 56px cảm ứng). Cột số căn phải, JetBrains Mono. Tiêu đề cột 12px weight 500 màu `--text-3`, không viết hoa, dính khi cuộn. Bảng hẹp (cột phụ ≤ 360px) dùng padding ngang 10px thay vì 12px để tiêu đề không xuống dòng.

Kiểu bảng cho màn danh sách: bảng và thanh tìm/lọc nằm **chung một thẻ** (`rounded-lg`, viền 1px, nền trắng, `relative flex-none`);
`FilterBar layout="toolbar"` là đầu thẻ — ô tìm giãn bên trái, bộ lọc có nhãn nằm cạnh dồn phải; bộ lọc phụ khai `secondary: true` xuống hàng thứ hai
(ngày, xe, tài xế của danh sách chuyến). `DataTable appearance="paper"` — tiêu đề cột nền `--table-head`, 12px weight **600** `--ink-2`, cao 40px, lề
ngang 14px. Ô hai dòng thì tăng mật độ thay vì cắt chữ: `roomy` 56px cho hai dòng chữ (tên + tuyến, số kiện + số điểm), `spacious` 72px khi kèm
icon/badge (tên + mã có icon xe; trạng thái + mã chuyến / ghi chú tối đa hai dòng). Lớp kiểu dáng ở `components/data-table-styles.ts`.

Danh sách có tìm/lọc/sắp xếp/phân trang (LM-085, D-52) ghép `FilterBar` + `@/lib/list-filter` (tìm bỏ dấu: "bien hoa" khớp "Biên Hoà") + `DataTable` +
`useListUrlState`. Cột chỉ sắp xếp được khi khai `enableSorting: true`; tiêu đề là nút có `aria-sort`. Phân trang 25/50/100 qua prop `pagination`.
Bảng rỗng vì lọc truyền `isFiltering` để nói "không có kết quả khớp", khác "chưa có dữ liệu". Tham số URL tiếng Việt không dấu: `q`, `sap-xep`,
`trang`, `so-dong` + tên bộ lọc của màn. Ô nhập nối vào URL giữ bản nháp tại chỗ (router đổi URL trong `startTransition`) — dùng `FilterBar`, không
nối thẳng `value` vào `useSearchParams`. Setter của `useListUrlState` dựng URL từ bản nháp mới nhất (hai lần lọc liên tiếp không ghi đè nhau); cỡ
trang mặc định khác 25 thì truyền `defaultPageSize`, màn không tự giữ `so-dong`.

Ô chữ dài (tên kiện, điểm giao, xe) xuống tối đa hai dòng (`line-clamp-2`) trong hàng 48 px thay vì cắt bằng dấu ba chấm (LM-095); cột chữ quan trọng
nhận bề rộng theo tỷ lệ (%) thay vì px cố định; bảng có thể hẹp hơn tổng cột cố định thì đặt `min-w` cho bảng trong khung cuộn. Khung
`overflow-x-auto` chứa Select/Switch/Checkbox Radix phải `relative` — ô ẩn định vị tuyệt đối của Radix thoát khung cuộn và làm cả trang cuộn ngang.

## 6. Ngôn ngữ giao diện

### Đơn vị nghiệp vụ

Spec bắt buộc **cm/kg** và cấm trộn đơn vị trong state và payload (D-03):

| Đại lượng | Đơn vị | Làm tròn khi vào domain |
|---|---|---|
| Dài, rộng, cao, toạ độ, clearance | cm | `roundCm` — bội 0,1 cm |
| Khối lượng, tải trọng, tải tối đa | kg | `roundKg` — bội 0,01 kg |
| Thể tích | cm³ (hiển thị thêm m³ cho dễ đọc) | — |

- Chỉ `viewer3d/scene/units.ts` được đổi scale sang đơn vị Three.js (`SCENE_SCALE = 0.01`).
- `roundCm`/`roundKg` áp **tại biên**: khi lưu dữ liệu form, khi nhận placement từ service, khi
  editor commit. Không làm tròn giữa các phép tính trung gian.
- So sánh số thực trong `src/domain` qua `eq/lt/gt` có `EPSILON = 1e-6` của `@/domain/geometry`,
  **không** dùng `<` `>` `===` trực tiếp giữa toạ độ hoặc kích thước. Oxlint không có rule tự
  động cho việc này — reviewer phải chặn. Ví dụ đã gặp: `100.4 + 120.7 = 221.10000000000002`
  làm hai kiện chạm mặt bị báo chồng lấn giả.
- Mọi ví dụ số thực đưa vào test phải được chạy thử bằng máy trước; ba giả định viết tay trong
  issue gốc đã sai (`45.1 + 45.1 + 45.1` thực ra bằng đúng `135.3`).
- Code không được thêm giá trị mm. `src/domain`, engine 3D, editor, màn kho và tài xế dùng cm (màn kho, tài xế đọc revision đã duyệt qua
  `adaptResult`); kiểu điều khiển viewer nằm ở `viewer3d/viewer-types.ts`.

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

### i18n vi/en (D-07, D-08)

- Từ điển TypeScript tự viết trong `src/lib/i18n/`. *(LM-080)* Mỗi nhánh cấp 1 một file ở `vi/<nhánh>.ts` và `en/<nhánh>.ts`;
  `vi.ts`/`en.ts` chỉ ghép — màn mới thêm nhánh bằng file mới, không sửa nhánh của màn khác. `vi` là nguồn chuẩn; `en` khai báo sao cho
  **thiếu hoặc thừa key là lỗi TypeScript** lúc build.
- Ngôn ngữ đọc theo thứ tự `?lang` → `sessionStorage` → `vi`. Không dùng `localStorage`.
  Đổi ngôn ngữ không tải lại trang, không mất dữ liệu đang nhập.
- Chuỗi hiển thị viết qua `t()`, kể cả `aria-label`, `title`, `sr-only`.
  `src/lib/i18n/no-hardcoded-vietnamese.test.ts` chặn chữ có dấu tiếng Việt ngoài từ điển, `*.mock.ts`, seed kho, fixture và test.
  Lỗi bất biến cho lập trình viên (`throw new Error(...)`) được viết tiếng Việt. Ngoại lệ khác ghi vào `ALLOWED` kèm lý do.
  Module thuần (domain, snapping, mô tả vị trí) trả mã; component dịch.
- Không dịch: badge **MOCK RESULT**; tên riêng trong dữ liệu (tên kho, điểm giao, người).
- `src/domain` **không chứa câu chữ hiển thị**: validation và constraint trả **mã lỗi + tham số**
  (`{ code, severity, params }`, D-28); zod schema dùng mã làm message. UI dịch mã và format số
  theo locale. Test so mã, không so câu.
- Tham số sự kiện nhật ký (LM-091) là dữ liệu: số format theo locale, mã (tên trường, loại sự cố, vai trò) dịch qua `audit.log.*`; chữ
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

### Không để từ vựng kỹ thuật rò ra màn vận hành

Màn vận hành viết bằng ngôn ngữ của người dùng, không phải của thuật toán hay của
backend. Ví dụ: hộp thoại tối ưu không ghi "Thế hệ 128" (thuật ngữ giải thuật di truyền, vô nghĩa với điều phối viên và **sai hẳn** nếu đổi thuật toán) mà
chỉ hiện số service báo thật: "Đã xét 80 / 132 kiện" (LM-048).

Tên trường dữ liệu trong code vẫn giữ đúng hợp đồng với backend (`generation`);
giao diện làm lớp dịch. Ngoại lệ: màn **So sánh phương án** được dùng từ vựng thuật
toán (tên phương pháp, random seed, LIFO) vì ở đó người đọc đang so sánh thuật toán (LM-051). Màn này
chỉ hiện thiết lập và metrics có trong revision đã lưu; không đặt nhãn thuật toán nào chưa thật sự chạy.
Người dùng **không chọn mục tiêu hay thuật toán** (FE-5b-05, FE-5b-06, D-77): một lần chạy ra ba phương án
ứng viên A · B · C theo ba mục tiêu (tối đa thể tích, cân bằng tải trục, ít dỡ-xếp lại — tên ở `runs.objectives`, là ngôn ngữ của điều
phối viên, dùng được ở màn vận hành). **Tên thuật toán đã chạy** chỉ hiện ở ba chỗ: dòng chỉ đọc trong "Thiết lập nâng cao" và bảng lần
chạy của Thiết lập tối ưu, và thẻ lần chạy của màn So sánh. Mock chạy dưới tên "EP + DBLF" của hạng Basic cho mọi công ty nên nhãn luôn
kèm chữ **"(mock)"** — `runs.algorithms.EP_DBLF` là "EP + DBLF (mock)"; **hạng thuật toán của gói** (FE-8-05) hiện ở thẻ "Credit" của Thiết lập tối ưu (`optimization.credit.tiers`: "EP + DBLF", "EP + DBLF + GA/SA",
Ultimate thêm dòng "AI Optimizer — chưa có") — đó là hạng gói được dùng, **không phải** thuật toán đã chạy: mock vẫn chạy "EP + DBLF (mock)" cho mọi hạng,
thẻ nói rõ và phương án ghi đúng tên đã chạy; không bao giờ có chữ "AI optimized". Màn So sánh theo lần chạy
(`/chuyen/:tripId/so-sanh?lan-chay=<mã lần chạy>`): thẻ đầu nói lần chạy (người chạy, thuật toán, seed, LIFO, trọng tâm thấp, giới hạn thời
gian) và **mức hạn các điểm giao một lần** — ba phương án cùng một tuyến; dưới đó ba thẻ cạnh nhau, mỗi thẻ: mục tiêu, MOCK RESULT, mã
revision, ảnh thu nhỏ SVG, thể tích, tải trọng, tải trục trước / sau so giới hạn, chênh mức tải hai trục (điểm phần trăm), trọng tâm hàng,
số kiện dỡ-xếp lại, kiện chưa xếp, thời gian chạy. **Giá trị tốt nhất đánh dấu trung tính**: in đậm kèm nhãn xám "Tốt nhất" (`Badge`
`shape="tag"` tông mặc định) — không tô xanh lá / đỏ cho tốt / xấu; chỉ số mà các phương án bằng nhau, hoặc có phương án không có số (xe
chưa khai trục), thì không đánh dấu; hoà thì đánh dấu mọi phương án hoà (`bestCandidates` ở `trips/candidate-comparison.ts`; thời gian chạy
và trọng tâm không có "tốt nhất"). Màn **không có nút primary**: mỗi thẻ một nút phụ "Mở trong Planner", duyệt ở Planner; thẻ của phương án
đã duyệt mang nhãn cyan "Đã duyệt" và liên kết tới bản đã duyệt. Không có `lan-chay` thì vẫn là ma trận revision của D-37 (một nút primary
mở bản đang chọn), cột của bản do lần chạy ba phương án tạo ra mang thêm nhãn "Phương án A / B / C". Ma trận này còn dùng dấu tích xanh lá
cho "tốt nhất".

### Nút chưa hoạt động (D-20)

Spec cấm "nút giả" (mục 9.3: Import CSV chỉ hiện khi hoạt động), nên:

- **Không hiển thị** nút hay mục menu chưa có chức năng. Không để nút bấm vào mà im lặng,
  không dùng toast báo "đang chờ", không báo thành công giả.
- Ngoại lệ duy nhất: nơi Spec yêu cầu giữ vị trí cho tính năng sau hiển thị nhãn **"Sẽ có sau" / "Coming later"** dạng chữ, không bấm được
  (hiện không màn nào dùng; tải trục đã có số của mock).
- Toast chỉ nói việc **thật sự đã xảy ra** trên màn: không hứa "sẽ đồng bộ", "điều phối viên sẽ thấy"
  khi không có nơi lưu. Danh sách và form tạo/sửa chuyến ghi thật vào kho, không báo thành công giả.

### Không bịa số (LM-052, D-20)

Cùng lý do với nút giả: số bịa còn nguy hơn nút bịa vì người đọc tin ngay. Mọi con số, thanh
tiến độ và biểu đồ trên màn vận hành phải truy được về dữ liệu kho (`src/lib/mock-db`) hoặc về
kết quả tối ưu; không có nguồn thì **bỏ hẳn phần đó**, không giữ lại bản mẫu cho đẹp.

- Biểu đồ được phép (LM-090, D-48) khi kho có chuỗi thật: bảng điều khiển có 3 biểu đồ (lấp đầy theo ngày,
  chuyến theo trạng thái, khối lượng đã giao theo xe) tính bằng hàm thuần `summarizeDashboard` từ chuyến, revision đã duyệt, tiến độ
  giao và trạng thái xe của kho. Ngày không có số để trống, không nối, không điền 0; kỳ không có dữ liệu hiện câu rỗng thay trục trống;
  tỷ lệ chưa tính được hiện "—" kèm lý do. Mỗi KPI một dòng nói nguồn; số lấy từ kết quả mock mang MOCK RESULT. Vẫn không có "so với
  kỳ trước", so sánh thuật toán, hay "kế hoạch vs thực tế".
- "So với kỳ trước" cũng là số bịa khi chưa có kỳ trước: `KpiTile` chỉ còn nhãn, số và một dòng
  ghi chú nói số đến từ đâu.
- Trang tài liệu `/thanh-phan` được dùng số mẫu để trình bày component, nhưng lấy từ dữ liệu seed
  thật (132 kiện của chuyến mẫu), không phải số nghĩ ra.
- **Tải trục** (FE-5b-03, D-78) là số tính được: mô hình đòn bẩy thuần
  `axleLoadsOf` (`domain/metrics/axle-load.ts`) trên dữ liệu trục **người dùng khai ở trang xe** (`axles[]`: vị trí, tải rỗng, tải tối
  đa) và trọng tâm hàng — mọi số truy được về đó, và luôn mang **MOCK RESULT** vì là ước lượng của mock. Xe không đủ dữ liệu trục
  (chưa khai, chỉ một trục, các trục trùng vị trí) thì **không có số nào**: ô Tải trục nói vì sao chưa tính, metrics của kết quả không
  có `frontAxleLoadKg` / `rearAxleLoadKg`, và không có kiểm `AXLE_OVERLOAD`. Trục minh hoạ mà khung gầm 3D vẽ khi xe không khai trục
  **không** được đưa vào phép tính. Xe mẫu của seed khai hai trục bằng **số ước lượng theo cỡ xe, chưa đối chiếu thông số nhà sản xuất** (mục 9, `twoAxles` ở `seed-vehicles.ts`); số tải trục trên màn vẫn truy được về các trục đó và vẫn mang MOCK RESULT.

## 7. Quy tắc riêng cho 3D

### Three.js

- Toàn bộ code Three.js nằm trong `src/features/viewer3d`. Không import `three` ở nơi khác. Màn khác cần 3D thì import component từ `viewer3d` (ví dụ `PositionViewer` cho màn kho).
- Kiện hàng render bằng **InstancedMesh** với `setColorAt`, không tạo mesh riêng từng kiện. Tối đa 3 InstancedMesh cargo: solid, ghost và vỏ viền. Tier low tắt viền chung nhưng giữ viền cảnh báo khi có blocker. Vỏ viền dùng chung cho ba việc (FE-5b-07): viền tối chung (tắt ở tier low), viền `--warning` của kiện chắn lối dỡ, và viền **trắng dày** (`ZONE_MARK_PADDING`) của kiện nằm ngoài vùng điểm giao — hai loại sau giữ ở mọi tier; không thêm mesh nào cho dấu ngoài vùng. Mapping `instanceId ↔ placementId` nằm trong `scene/instance-layout.ts`, không lấy index của danh sách UI để picking. Editor và animation dỡ mỗi loại dùng tối đa một proxy tạm; bánh xe dùng instancing riêng, không nhân theo cargo count.
- Vật cản `vehicle.obstacles` (LM-033) vẽ trong `scene/ObstacleInstances.tsx`: đúng 2 draw call dù 1 hay 20 vật cản (một InstancedMesh thân màu `--obstacle`/`--obstacle-bearing` theo `loadBearing` + một `LineSegments` gộp cạnh), 0 vật cản không vẽ gì, không đổ bóng. `RESERVED_ZONE` có vạch nhìn xuyên bằng thuộc tính instance + `discard` trong shader, không thêm vật liệu trong suốt. Bấm vật cản ở chế độ Xem mở `ObstacleCallout`; chế độ Chỉnh sửa tắt raycast vật cản. `SceneCanvas` kèm danh sách `sr-only` mô tả vật cản; chú giải vật cản nằm dưới chú giải điểm giao. Đo bằng `?debug&packages=N&obstacles=0|1|20` (`benchmark-obstacles.mock.ts`).
- Nền Canvas luôn tối, kể cả khi phần còn lại của app sáng.
- Target chức năng/performance là 1.000 placements với draw calls dưới 100, số mesh/nhãn không tăng tuyến tính theo cargo. Mục tiêu thiết bị thật: desktop hướng tới 60 FPS, tablet 45–60 FPS, phone khoảng ≥30 FPS bằng quality adaptation. Số đo SwiftShader không phải cam kết FPS trên thiết bị thật. Thêm `?debug` để đo trước khi thêm hiệu ứng.
- Mọi hiệu ứng nâng cao (post-processing, shadow, AO) phải có cờ tắt được trong `usePerformanceFlags`. Ba tier `high / balanced / low` điều khiển DPR, bóng, viền chung, trang trí, bề mặt cargo và animation; viền kiện đang chọn luôn được giữ. Runtime bỏ qua idle, hạ tier sau 3 mẫu chậm (>28 ms), nâng sau 8 mẫu nhanh (<18 ms), cooldown 12 giây. Debug quality override khóa tier để đo lặp lại.
- Animation trong Canvas dùng `@react-spring/three`. Animation ngoài Canvas dùng `motion`.
- Panel điều khiển nổi trên Canvas là React thường đặt đè bằng CSS, không dùng `<Html>` của drei trừ khi cần neo theo vật thể 3D. Lớp phủ phải `pointer-events-none`, chỉ bật lại trên đúng nhóm nút, nếu không nó nuốt thao tác kéo xoay. Nội dung `<Html>` của drei chạy ở **một React root riêng, không có context của app**: gọi `useT` / `useFormat` (hay component dùng chúng, như `StopMark`) bên trong là lỗi "useT phải nằm trong `<I18nProvider>`" lúc chạy — test DOM không thấy vì jsdom không dựng Canvas. Tính chữ và số ở component ngoài rồi truyền vào (`RearDoorCue`, `ZoneStrips`; FE-5b-07). Vật liệu trong suốt `DoubleSide` của three vẽ **hai lượt** (hai draw call): mặt phẳng phủ sàn đặt `forceSinglePass`.
- Canvas phải có `touch-action: none` (đã đặt toàn cục trong `index.css`). Thiếu nó thì trên máy tính bảng kéo ngón tay sẽ cuộn trang thay vì xoay mô hình — lỗi chỉ lộ khi chạm tay, dùng chuột không thấy.
- Ba lưu ý về camera: `fitToBox` của camera-controls **xoay camera** về nhìn thẳng mặt gần nhất nên làm mất góc chéo — dùng phép chiếu các góc bao theo preset và tỉ lệ khung; bounding sphere theo chiều dài làm góc cửa sau trên phone quá nhỏ. Resize panel giữ góc người dùng đang xoay. Vách thùng dùng mặt đơn pháp tuyến hướng vào trong để vách gần camera tự biến mất. `PCFSoftShadowMap` đã bị gỡ khỏi three r186, dùng `shadows="percentage"`.

### Foundation engine

- Planner đọc revision của chuyến (LM-030) qua `viewer-api.ts` → `usePlanSourceQuery` → `adaptResult → ViewerSceneModel` (cm, snapshot bất biến):
  revision đã duyệt mới nhất, hoặc `?revision=<jobId>`. `ScenePlacement` ghép `PackagePlacement` với kiện gốc (`packageId`, tên, điểm giao,
  `fragilityLevel`); `step = loadingOrder`. Kết hợp `ViewerDraft` theo ID để sinh effective placements; chỉ commit `{ position?, orientation?,
  pinned? }`, vị trí draft là cm. Header hiện **MOCK RESULT** khi `isMockResult`. Chế độ màu thứ hai là **theo kiện gốc** (`packageId`) vì contract
  không có đơn hàng; `packaging` của kết quả là một kiểu trung tính.
- **Kho** (`/kho`, LM-086, FE-6-01 → FE-6-05): danh sách chuyến chia **nhóm theo trạng thái và dòng phụ** (`WAREHOUSE_STAGES`): Đang xếp hàng (tiến
  độ) · Chờ soạn (Đã lập kế hoạch, bản duyệt còn hiệu lực) · Xếp xong — chờ xuất phát (còn ghi được số seal tới khi tài xế xuất phát) · Chờ điều
  phối tối ưu lại (bản duyệt lỗi thời, không có nút); nút chính của màn là chuyến đang xếp dở, không thì chuyến chờ soạn sớm nhất.
  `/kho?chuyen=<mã>` là phiên của chuyến theo bản duyệt chốt lúc `startLoading` — bước Soạn hàng rồi bước Xếp, tiến độ ghi vào kho qua các hàm
  đối chiếu (mục 9), mở lại tiếp tục ở kiện chưa ghi đầu tiên; bản duyệt lỗi thời **không** vào phiên (chờ điều phối duyệt lại). Scene cm đưa cho
  `PositionViewer`; kiện hỏng bị bỏ lại kho (`leftOutIds`) vẽ như kiện đã gỡ (`unloadedIds` của `deriveSceneSemantics`), như khung 3D tài xế.
- **Tài xế** (`/tai-xe` "Chuyến của tôi", LM-087, FE-6-01; chỉ chuyến có `driverId` là mình, chỉ vai trò có `driver.operate`): nhóm theo trạng thái
  (`MY_TRIP_GROUPS`): Đang vận chuyển · Xếp xong — chờ xuất phát · Kho đang soạn / xếp (chỉ xem: nút phụ "Xem trước" mở màn điểm giao ở chế độ chỉ
  xem) · Đã giao gần đây (5 chuyến); chuyến còn Đã lập kế hoạch và chuyến đã huỷ không hiện. `/tai-xe/diem-giao?chuyen=` đọc qua `driver-api.ts` →
  `adaptResult`, phương án là bản kho đã xếp (chưa xếp thì bản duyệt mới nhất, chỉ xem); kiện hỏng bị bỏ lại kho không nằm trong danh sách dỡ và
  mô phỏng; xuất phát, đã đến, dỡ, sự cố, hoàn tất điểm ghi vào kho (FE-6-06).
- Kích thước placement **đã áp orientation**. Xoay luôn áp mã đích lên kích thước danh nghĩa `baseDimensionsById` (lấy từ `CargoPackage`), không đảo ngược kích thước đã xoay (`orientedSize` trong `scene-input.ts`). Xoay giữ nguyên góc vị trí của kiện.
- Cả ba vai trò dùng chung `SceneCanvas` với `frameloop="demand"`. CameraControls tự invalidate khi chuyển động; mọi thay đổi buffer imperative phải gọi invalidate. Spring chỉ ghi ma trận/proxy kiện đang chạy, không đưa state từng frame qua React.
- `frustumCulled={false}` không loại bỏ nhu cầu bounds của **raycast**. Cargo dùng sphere bao toàn bộ effective geometry và quãng animation, cập nhật khi geometry đổi. Không tính lại `computeBoundingSphere()` trong animation/step/slice path; cập nhật màu không ghi lại ma trận.
- Dữ liệu đo riêng trong `features/viewer3d/benchmark.mock.ts` (`createBenchmarkInput`: request + result đúng contract Spec, cm; tài xế dùng `createBenchmarkInput`): `?debug&packages=132|300|500|1000`, có thể thêm `&quality=high|balanced|low`. Thêm `&stops=1|4|8` (FE-5b-07) thì fixture có chừng đó điểm giao **và có vùng theo điểm giao** (`stopZones`, `stopZoneId`, `rehandlingCount`) để đo dải vùng; không có `stops` thì fixture như cũ — 4 điểm, không vùng — nên các phép đo có từ trước vẫn đo đúng thứ chúng đo. Không đổi mock nghiệp vụ và không kích hoạt benchmark khi thiếu `debug`. Đây là fixture renderer có khe hở, không phải phương án đã xác nhận ổn định chất xếp.
- Debug chỉ quan sát: FPS khi scene chuyển động, draw calls, tam giác, số kiện, DPR và tier. Khi nghỉ hiển thị trạng thái nghỉ; không tự invalidate để đo FPS. "Nghỉ" (LM-101) là **demand loop đã dừng** — frame cuối không xin frame tiếp — rồi lặng 250 ms (`scene/perf-idle.ts`), không phải "lâu rồi chưa vẽ": máy yếu vẽ 2–3 FPS thì frame nào cũng cách nhau hơn 250 ms, lấy khoảng lặng làm chuẩn sẽ báo nghỉ giữa lúc scene đang chạy, giấu mất FPS và làm `quality-policy` (bỏ qua mẫu nghỉ) không bao giờ hạ tier trên đúng máy cần hạ. Chưa nâng mục tiêu FPS trên thiết bị thật chỉ dựa vào số đo Chromium phần mềm.
- Low tier dùng DPR 0,5 và vật liệu cargo Lambert sau phép đo kéo camera 1.000 kiện trên SwiftShader; giữ nguyên picking và nhãn HTML. Balanced/high giữ Standard. Phần 3D mềm hơn là trade-off có chủ ý để ưu tiên tương tác. Không suy diễn kết quả này thành cam kết FPS trên mọi thiết bị hoặc mọi tier.

### Manual editor

- Planner có chế độ Xem/Chỉnh sửa. Chỉ kiện đang chọn dùng một proxy mesh; instance tương ứng được ẩn theo ID. Lưới sàn và chỉ dẫn trục có số draw call cố định.
- Kéo dùng pointer capture, ref và cập nhật Three imperative; chỉ commit một lệnh khi thả hợp lệ. Trong gesture tạm ngưng camera và raycast instances, khôi phục khi thả/hủy/unmount. Không đưa pointer position qua React mỗi frame.
- Snapping dùng cm trong `viewer3d/editor`: lưới 5 cm, ngưỡng hút 2 cm, hút cả mặt vật cản chịu tải (không hút vật cản không chịu tải), so qua `eq/lt/gt`, vị trí commit qua `roundCm`. Nút nudge đi đúng 1/5/10 cm (mặc định 1); snapping dùng khi kéo hoặc bấm Căn vị trí. Xoay chỉ vòng qua `effectiveOrientations` của kiện (6 mã Spec `LWH … HWL`, tôn trọng `keepUpright`), không xoay quaternion tự do.
- Tính hợp lệ (LM-035) khi kéo/thả/xoay/nudge/căn/khôi phục do constraint engine của domain quyết định (`editor/editor-engine.ts`, dựng một lần mỗi snapshot, `sync` theo placement hiệu lực trước mỗi lần kiểm nên undo/redo/reset không lệch): issue `error` dính tới kiện (chủ thể hoặc `relatedIds`) chặn commit, `warning` vẫn commit; câu qua `formatIssue`. Issue toàn phương án (trọng tâm, và tải trục `AXLE_OVERLOAD` — FE-5b-03) không chặn thao tác; `AXLE_OVERLOAD` chặn ở bước Duyệt.
- Lịch sử giữ patch trước/sau theo ID, tối đa 200 lệnh, không snapshot placements mỗi lần di chuột. Ghim khóa move/rotate cho đến khi bỏ ghim; ghim **lưu cùng phương án** (FE-BL-02) qua Duyệt (`PackagePlacement.pinned`, mục 9) — ghim hay bỏ ghim kiện là chỉnh sửa cần "Duyệt bản chỉnh" dù không dời kiện nào, nhưng không phải "chỉnh tay" (`manuallyEdited`, nhãn "Đã chỉnh tay" chỉ theo dời / xoay). Reset mọi chỉnh sửa cần dialog; reset riêng bị chặn nếu vị trí gốc đang bị kiện khác chiếm.
- Không tạo placement từ UnplacedPackage, không lưu draft qua phiên/trang và không coi kiểm tra frontend là kết quả tối ưu authoritative.
- **Tay kéo theo trục** (LM-108): ba mũi tên X/Y/Z trên kiện đang chọn (`EditorAxisHandles`, số mesh cố định, vùng nắm
  không vẽ, luôn vẽ đè); nắm mũi tên thì kiện chỉ chạy theo trục đó và chỉ hút mặt trên trục đó; kéo thân kiện vẫn theo mặt phẳng kéo. Kéo
  một trục về trong 6 cm quanh vị trí trong phương án thì hút đúng vị trí gốc (`homeSnapCm`, thắng các mặt khác).
- **Trọng lực khi chỉnh tay** (LM-108; `editor/gravity.ts`): dời một
  kiện hợp lệ thì các kiện đang tựa lên nó mà mất chỗ đỡ rơi thẳng xuống mặt đỡ cao nhất bên dưới (kiện khác, nóc vật cản, sàn), rơi dây
  chuyền lên trên; chỉ đổi `z`, không trượt ngang; kiện đã ghim đứng yên. Kiện dời + các kiện rơi là **một** lệnh lịch sử
  (`GRAVITY_MOVE`, hoàn tác một lần). Hoạt ảnh rơi trong `useCargoMatrices` (spring riêng, ghi ma trận ngoài React), bỏ qua kiện đang kéo và
  lần đổi phương án; reduced motion đặt thẳng. Dung sai chạm mặt 0,5 cm.

### Operations và scene dùng chung

- `operations/scene-semantics.ts` tách loaded/current/next/future/removed khỏi renderer. Planner, `PositionViewer` (kho) và `DriverCargoViewer` cùng dùng `SceneCanvas`; panel và workflow nằm ở wrapper. Không thêm engine cho từng vai trò. Scene của tài xế còn nhận kiện nhận dọc đường đã có chỗ (`withPickupPlacements`, `viewer3d/scene-pickups.ts`): cùng InstancedMesh với kiện thường, không mesh hay draw call mới (FE-BL-01).
- Loading (LM-036) lấy `placement.step` (= `loadingOrder`); unloading lấy `unloadingOrder` của kết quả qua `unloadSequence` (`operations/unloading.ts`), nhãn "Thứ tự dỡ" không kèm "gợi ý"; revision `ordersRecomputed` hiện thêm câu "tính lại ở FE". Màn tài xế (LM-061) dùng `unloadingOrder` của revision đã duyệt cho cả danh sách kiện của điểm giao lẫn mô phỏng, không có chữ "gợi ý". Thứ tự suy ra (stop tăng, cao trước, gần cửa trước, nhãn "gợi ý") chỉ là dự phòng khi kết quả thiếu `unloadingOrder`. Stop-order consistency không chứng minh unload accessibility.
- Blocker là `lifoIssues` của domain qua `createLifoIndex`: chỉ kiện giao **muộn hơn** nằm hẳn sau mặt sau; kiện đã dỡ/đang ẩn gỡ khỏi lưới (`grid.remove`), tua lùi thì thêm lại; kiện chắn sắp theo x trước khi callout. `LIFO_BLOCKED` (che kín 100% mặt sau là vi phạm) dừng mô phỏng và giữ target; `LIFO_PARTIAL` (che một phần, cảnh báo) chỉ đánh dấu (D-26). Duyệt đếm hai mã này, không khẳng định dỡ được thực tế. Không tính người, xe nâng, clearance hay xoay lúc dỡ. Riêng hình ảnh dỡ (`UnloadMotion`) dùng `corridor` — mọi kiện còn lại trên hành lang thẳng, bất kể điểm giao — để không trượt xuyên kiện. Fixture benchmark có đúng một cặp kiện đổi điểm giao tạo ca `LIFO_BLOCKED` cho browser suite; seed đã duyệt không có ca LIFO.
- CoM là **tâm khối lượng hàng** đã xếp/còn lại, không phải toàn xe. **Tải trục** (FE-5b-03, D-78): `AxleLoadPanel` (DOM trong tab Vận hành, không thêm draw call) hiện tải nhóm trục trước / sau của **toàn bộ kiện đang xếp, kể cả bản đang chỉnh tay**, so với giới hạn, kèm MOCK RESULT; vượt giới hạn có chữ "Vượt … kg", không chỉ màu; xe không đủ dữ liệu trục thì chỉ có một câu lý do. Mô hình (`axleLoadsOf`): nhóm trước là trục có `positionXCm` nhỏ nhất, nhóm sau là các trục còn lại đặt tại trung bình vị trí; hàng nặng W có trọng tâm x dồn W × (x − x_trước) / (x_sau − x_trước) lên nhóm sau, phần còn lại lên nhóm trước, cộng tải rỗng. Giới hạn lấy `frontAxleLimitKg` / `rearAxleLimitKg` của xe (kho điền từ loại xe, mục 9), vắng thì tổng `axles[].maxLoadKg` của nhóm — tải tối đa 0 kg là chưa khai. Vượt giới hạn là issue `AXLE_OVERLOAD` mức `error` của constraint engine: chặn Duyệt qua `approvalBlockers` (lý do ở tooltip + `aria-describedby` như mọi lỗi), không chặn thao tác kéo thả. `positionXCm` cùng hệ toạ độ với thùng: `truckLayout` đặt `toScene(positionXCm)` thẳng lên trục x của placement (vách trước = 0, âm là dưới cabin), không độ dời. Cabin, bánh và khung gầm vẫn là mô hình minh hoạ: trục vẽ mặc định khi xe không khai `axles` không tham gia phép tính. Xe mẫu của seed khai hai trục (số ước lượng, mục 9): trục trước ở −100 cm — đúng chỗ `truckLayout` vẽ cầu dẫn hướng (`CAB_X`) — và trục sau giữa hốc bánh của thùng, nên khung gầm 3D vẽ đúng các trục đang được tính; phương án đã duyệt của seed không vượt trục nào (`seed.test.ts` kiểm mọi revision seed).
- Chi tiết xe gộp geometry theo vật liệu; mọi bánh (bánh đôi cầu sau) dùng một InstancedMesh, một draw. Khung gầm chi tiết (`scene/truck-chassis.ts`) gộp vào cùng hình học màu theo đỉnh của `vehicle-details` — không thêm draw call. Camera xoay được xuống dưới gầm (`maxPolarAngle` gần π) và có góc nhìn "Gầm xe" (`gam-xe`, tâm nhìn hạ xuống khung sườn); đèn yếu từ dưới giữ khung gầm không đen. Màn kho không có góc gầm xe. Cargo dùng atlas trung tính chung cho carton/pallet/crate qua thuộc tính instance, không phải nhãn hướng đặt. Low tắt chi tiết phụ; không tắt cues nghiệp vụ. Khi gặp `LIFO_BLOCKED`, playback dỡ tạm dừng và giữ target. Kiện còn vật trên hành lang thẳng (người dùng bỏ qua bước, hoặc bị che một phần) mờ tại chỗ; không dịch chuyển xuyên kiện khác. Reduced motion không dịch chuyển lớn; hoàn tất phải trở lại idle.
- Timeline dùng ô cao bằng nhau, 8–64 bins theo chiều rộng, slider giữ toàn bộ bước.
- **Dải vùng điểm giao** (FE-5b-07, D-79). Planner vẽ các vùng của phương án (`result.stopZones` → `ViewerSceneModel.zones`, theo thứ tự giao, vùng đầu sát cửa) thành dải trên sàn thùng theo màu điểm giao: `operations/ZoneStrips.tsx`, hình học thuần ở `operations/stop-map.ts` (`zoneStrips`: mỗi vùng một hình chữ nhật từ `startXCm` tới `endXCm`, lùi 2 cm khỏi hai vách, cao 0,4 cm trên sàn; khoảng đệm để trống; nằm hoàn toàn trong mép sàn, depth test bình thường, không đặt dải trên thân, gầm hay bên ngoài xe). Mọi vùng nằm trong **một** mesh tô màu theo đỉnh: **đúng một draw call dù phương án có 1 hay 8 điểm giao** (`e2e/viewer-zones.spec.ts` đo bằng `?debug&packages=1000&stops=1|4|8`: số draw call không đổi theo số điểm giao; tắt dải vùng bớt đúng một). Mỗi vùng có một nhãn DOM neo ở mép sàn: số điểm kèm màu, tên điểm, tỷ lệ thể tích hàng của điểm đó (%) — màu luôn đi kèm số và tên. Nhãn không đè nhau và không đè nhãn "Cửa sau": mỗi khung hình được vẽ, `ZoneStrips` chiếu điểm neo ra màn rồi đẩy nhãn bị chạm xuống dưới nhãn đã đặt, ghi thẳng vào DOM và chỉ ghi khi đổi; số nhãn bằng số điểm giao, không theo số kiện. Dải vùng **bật sẵn** khi mở Planner (cue nghiệp vụ: tier `low` vẫn vẽ), tắt / bật ở hộp Hiển thị ("Ẩn / Hiện dải vùng điểm giao", `operations.showZones`); phương án không chia vùng thì không có nút đó. Kho và tài xế không truyền `zones` cho `SceneCanvas` nên không có dải.
- **Vùng của kiện và kiện nằm ngoài vùng** (FE-5b-07). `ScenePlacement` mang `zoneId` (vùng chứa tâm kiện theo X) và `outOfZone` (vùng đó không phải vùng của điểm giao mình), tính bằng `locateInZones` của domain ở `adaptResult` và tính lại cho kiện đang dời / xoay ở `resolveEffectiveScene` — nên dấu ngoài vùng và số lần dỡ-xếp lại đi theo bản đang chỉnh tay; vùng thì giữ nguyên của lần tối ưu. Kiện nằm ngoài vùng có ba dấu: viền trắng dày trong 3D (vỏ viền của cargo — xem "Three.js"; tắt cùng dải vùng, và nhường viền cho kiện chắn khi đang xem kiện chắn lối dỡ), nhãn "Ngoài vùng" ở dòng của kiện trong tab Danh sách (kèm ô lọc "Chỉ kiện nằm ngoài vùng" khi phương án có kiện như vậy), và ở thẻ kiện đang chọn: ô "Vùng điểm giao" ghi vùng kiện đang nằm, nhãn "Ngoài vùng" và câu "Nằm ngoài vùng của điểm N — tính một lần dỡ-xếp lại". Trắng chứ không hổ phách: hổ phách lẫn vào cam của điểm 1 và vàng của điểm 4.
- **Hộp Chi tiết** (FE-5b-07) (tab Vận hành của hộp thông tin) hiện ba chỉ số của phương án đang xem, đều là DOM, không thêm draw call: `AxleLoadPanel` (tải trục trước / sau so giới hạn), `RehandlingPanel` (số kiện `outOfZone` của bản đang xem kể cả đang chỉnh tay, MOCK RESULT; phương án không chia vùng thì chỉ một câu lý do, không có số) và `DeadlinePanel` (từng điểm giao: giờ đến dự kiến và mức hạn theo `Trip.routePlan` của chuyến — `adaptResult` đưa vào `SceneStop.eta` / `deadlineStatus`; điểm không có hạn ghi "Không có hạn"; chuyến chưa tối ưu tuyến thì chỉ một câu) — hai panel sau ở `overlays/PlanIndicators.tsx`. Tab Chỉ số thêm dòng "Số lần dỡ-xếp lại" lấy từ `metrics.rehandlingCount` của kết quả. Thanh trên của Planner không thêm gì (vẫn đo ở 1.366 px).
- Bản đã duyệt chưa có dời/xoay/ghim (LM-094): không có nút Duyệt, hiện "Đã duyệt lúc HH:mm dd/MM"; có thì "Duyệt bản chỉnh".
  Lý do chặn Duyệt ở tooltip + `aria-describedby` của nút, không in ở thanh. Pha chuyến khác `planning` hoặc thiếu `plans.approve`: không
  Chỉnh sửa, không Duyệt, một dòng lý do (`viewer.lock`). Hộp thông tin chỉ mở từ nút "Chi tiết / Hiển thị" ở góc khung 3D và thẻ kiện.
  Chỉ **điều phối viên** có `plans.approve` (FE-0-07, D-80): chỉnh tay và Duyệt trong Planner
  (`plannerAccess({ canApprove })`). Đã dời / xoay kiện thì nút chính là "Duyệt bản chỉnh": `approveRevision` của kho áp patch của draft và tạo
  revision **đã duyệt** mới — không có bước lưu bản chưa duyệt. Thiếu quyền (quản lý công ty) là khoá `readOnly`, kể cả ở bản chưa duyệt. Kho ghi
  người bấm Duyệt vào revision (`approvedBy`, seed là điều phối viên) nên nhãn là "Duyệt bởi <tên> lúc …". Liên kết "Tới Thiết lập tối ưu" của
  banner lỗi thời theo `optimization.run` và pha `planning`. E2E của Planner (chỉnh sửa, Duyệt) đăng nhập `dispatcher` — mặc định của `login`.
  Dòng phụ `awaitingApproval` của **chuyến** ("Chờ duyệt", mục 9) là thứ khác với khoá của Planner.
- **Luật duyệt** (FE-5b-08, D-80). Chặn Duyệt: phương án lỗi thời, dòng kiện bắt buộc chưa xếp đủ
  (`MUST_LOAD_UNPLACED`), vượt tải trục (`AXLE_OVERLOAD`), lỗi ràng buộc khác. Tooltip + `aria-describedby` của nút nói **đúng loại lý
  do** — "Chưa duyệt được: 1 dòng kiện bắt buộc chưa xếp đủ và tải trục vượt giới hạn." — ghép từ `blockerSummary` của domain bằng
  `format.list` (`useViewerApproval`); hộp thoại liệt kê từng lý do. **Mức hạn** lấy từ tuyến đã tối ưu của chuyến (`SceneStop.eta`,
  `deadline`, `deadlineStatus` → `deadlineReview`): điểm **sát hạn** chỉ hiện trong hộp duyệt kèm giờ đến dự kiến và hạn, không hỏi thêm;
  có điểm **trễ hạn dự kiến** thì bấm Duyệt mở **bước xác nhận** ngay trong hộp thoại (`LateStopsConfirm`: "Duyệt dù có điểm trễ hạn?",
  liệt kê điểm, giờ đến dự kiến, hạn, kèm MOCK RESULT vì giờ đến là của mock tối ưu tuyến) — "Vẫn duyệt" mới gửi Duyệt kèm `force`,
  "Quay lại" về bước xem xét; mỗi lần mở hộp thoại bắt đầu lại từ bước xem xét. Chuyến chưa tối ưu tuyến thì hộp duyệt không nói gì về
  hạn. Kho kiểm lại tất cả (mục 9): giao diện bị bỏ qua thì Duyệt vẫn bị từ chối; kho từ chối thì toast kèm câu của kho.
- **Đổi xe ở Planner** (FE-5b-08, D-80). Nút phụ "Đổi xe" nằm ở **góc dưới phải khung 3D** cạnh "Chi tiết / Hiển
  thị" (`SceneHud`, từ 768 px; dưới 1.280 px chỉ icon), **không** nằm trên thanh trên: ở 1.536–1.760 px hàng điều khiển không còn chỗ
  cho thêm một nút. Chỉ hiện ở chế độ Xem, khi chuyến Đã lập kế hoạch và người xem
  có `trips.edit`. Mở cùng hộp thoại `trips/ChangeVehicleDialog` với Chi tiết chuyến (mục 9); đổi xong phương án đang xem thành lỗi
  thời ngay và thanh lỗi thời ghi "đã sửa Xe (giờ · ngày · người)". Đổi xe không bao giờ là nút chính.
- **Kiện ghim ở Planner** (FE-BL-02). Phương án có kiện ghim thì hàng dưới phải khung 3D có `PinnedRerun` — nhãn "N kiện đã ghim" (biểu tượng
  ghim + chữ) và nút phụ "Chạy lại giữ ghim", bên trái "Đổi xe" / "Chi tiết" (từ 768 px, dưới 1.280 px chỉ biểu tượng; chọn chỗ này vì thanh trên không còn chỗ và
  cột nổi bên phải che mọi thứ đặt chồng lên trên nó). Cần quyền `optimization.run` và chuyến Đã lập kế hoạch.
  Ghim mới chưa Duyệt thì nút mờ kèm câu "Duyệt bản chỉnh để lưu ghim trước khi chạy lại" ngay cạnh: lần chạy lại đọc ghim từ phương án đã lưu. Bấm nút mở
  `/chuyen/:id/toi-uu?giu-ghim=<mã revision>`. Kiện ghim nhận biết bằng biểu tượng ghim **và** chữ "Đã ghim": chip ở dòng của danh sách kiện đã xếp, dòng thứ
  ba của nhãn neo kiện đang chọn, mục "Kiện đã ghim" của danh sách. **Thiết lập tối ưu** có thẻ "Giữ kiện đã ghim" (`SetupPinsCard`, trên ba mục đánh số) khi có gì để giữ —
  kiện ghim của phương án `?giu-ghim=` hoặc `Trip.replan.keep` sau kiện hỏng (phương án thắng): công tắc bật sẵn kèm câu nói nó làm gì (vẫn ba phương án, một credit);
  bộ ghim không đứng vững thì liệt kê từng lý do bằng `formatIssue` và nút Tối ưu mờ tới khi tắt công tắc; kiện đã xếp không giữ được (`replan.blocked`) thì chỉ có
  câu nói những kiện nào và lần chạy là bình thường. `runOptimization` từ chối bộ ghim hỏng (`PINNED_SET_INVALID`) trước khi giữ credit. Lần chạy giữ ghim ghi "Giữ N kiện đã
  ghim" ở bảng lần chạy và thẻ lần chạy của màn So sánh (`OptimizationRun.pinnedCount`). Endpoint BE: ghim `POST /api/load-plans/{id}/pin`, `DELETE …/pin/{placementId}`, chạy lại `POST …/rerun`.
- Planner mặc định ưu tiên scene với HUD gọn; thông tin kiện, tải trục, màu/slice và lớp phân tích nằm trong inspector mở theo nhu cầu. Double-click focus giữ góc nhìn; Esc hoặc “Xem toàn xe” thoát focus. Theo bước là tùy chọn, tạm dừng khi người dùng tự điều khiển camera. Chọn blocker không đổi target dỡ; có đường quay lại target.
- Viền/nhãn selected/current/next/hover là tập nhỏ cố định; `SceneCallout` giữ nhãn trong khung và đường chỉ dẫn neo đúng vị trí 3D. Editor có ba hướng đo, mặt phẳng kéo, tối đa ba mặt snap và bốn vùng overlap bằng hai InstancedMesh phụ cố định. Geometry/nhãn của preview cập nhật imperative, không đưa pointer frames qua React. Phone giữ trạng thái/snap/invalid, lược nhãn đo phụ để dành chỗ cho kiện.
- Xem trước 3D ở form xe (LM-042): `fleet/VehiclePreview.tsx` lo `useWatch` + debounce 250 ms + `previewVehicle` (chỉ phần hình học hợp lệ, không thì giữ hình cũ), rồi lazy-load `viewer3d/VehiclePreviewViewer` (`SceneCanvas` không kiện, tier `low`, không cabin). Camera chỉ canh lại qua `frameVehicle` khi kích thước lòng thùng đổi. Làm nổi vật cản từ ngoài canvas đi qua `highlightedObstacleId`/`onObstacleSelect` của `SceneCanvas`: `setColorAt` màu `--highlight`, không thêm draw call, không callout. Không có `WebGLRenderingContext` (jsdom) thì chỉ vẽ phác thảo SVG, không tải chunk 3D.
- Three của kho và driver được lazy-load từ `viewer3d`. Driver chỉ tải khi mở “Xem vị trí hàng”; mô phỏng không đánh dấu giao hàng và không có editor. Phone dùng panel dưới/drawer, nút thao tác 56px, không phụ thuộc hover/gizmo nhỏ.

### Ảnh xem trước tĩnh dùng SVG, không dùng Three.js

Ảnh nhỏ, không xoay được thì vẽ bằng SVG đẳng cự qua `lib/isometric.ts` — nhẹ hơn
nhiều và không kéo Three.js vào chunk. Đang dùng ở: xem trước trong modal tối ưu,
ảnh thu nhỏ màn so sánh phương án, hình minh hoạ hướng đặt kiện ở kho, skeleton lúc
đang tải Three.js, hình minh hoạ màn đăng nhập và sơ đồ tuyến ở chi tiết chuyến (`trips/RouteDiagram.tsx`, LM-097).

Chỉ dùng Three.js khi người dùng **cần xoay hoặc bấm vào vật thể**.

Bản đồ địa lý (FE-4b-07): `components/map/RouteMap` vẽ kho, điểm giao (màu điểm giao kèm
số), đường tuyến và vị trí xe bằng MapLibre GL. Cùng lối với khung 3D: không có WebGL (jsdom) thì chính `RouteMap` vẽ sơ đồ SVG từ cùng
dữ liệu và không tải chunk bản đồ; hình luôn `aria-hidden`, nội dung tương đương là danh sách điểm `sr-only`. Mốc là phần tử DOM của React,
không dùng sprite hay font của style nền. Chi tiết chuyến (FE-4b-09) giữ hàng điểm giao của
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
- Không dùng `localStorage`. Chế độ kho mẫu giữ phiên đăng nhập trong `sessionStorage`; chế độ Keycloak không giữ phiên ở app (xem dưới).

### Nối backend

App nối backend **từng phần**, mặc định vẫn chạy hoàn toàn trên kho mẫu — dev, CI, E2E và test không cần backend.

- **Cấu hình** ở `lib/backend-config.ts`, đọc từ `.env.local` (mẫu: `.env.example`): `VITE_AUTH_SOURCE` (`mock` mặc định | `keycloak`),
  `VITE_API_URL`, `VITE_KEYCLOAK_URL`, `VITE_KEYCLOAK_REALM`, `VITE_KEYCLOAK_CLIENT_ID`. Giá trị lạ là lỗi lúc mở app. Không viết
  địa chỉ backend hay Keycloak thẳng trong code.
- **Chỉ `lib/api-client.ts` gọi `fetch` tới backend** (`api()`): gắn token của phiên, giới hạn thời gian, mở phong bì
  `{ success, code, message, data, errors }` và đổi thất bại thành `ApiError` có mã. Màn không hiện thông điệp thô của máy chủ.
- **Đăng nhập Keycloak** (`features/auth/keycloak-session.ts`, `keycloak-js` tải lười): app chuyển sang trang đăng nhập của Keycloak
  (PKCE), không tự thu mật khẩu. Mở app thì hỏi Keycloak còn phiên không qua iframe ẩn (`public/silent-check-sso.html`) —
  `useAuth().status` là `restoring` cho tới khi có câu trả lời và `RequireAuth` chưa quyết gì trong lúc đó. Hồ sơ đọc ở
  `GET /api/users/me`; mã vai trò backend đổi sang vai trò FE ở `backend-user.ts` (nhận cả `ADMIN` / `COMPANY_ADMIN`,
  `MANAGER` / `COMPANY_MANAGER`). Token của realm sống 60 giây: mọi lượt gọi lấy token qua phiên để nó tự làm mới.
- **Khi đăng nhập bằng backend mà dữ liệu còn là kho mẫu:** kho mẫu được đặt phiên của tài khoản mẫu cùng vai trò, nên chuyến, xe,
  kiện trên màn là của Long Bình; tên, email, vai trò là của backend. Màn đăng nhập nói rõ điều này. Feature nào nối backend thì dữ
  liệu của nó đi theo token.
- Nối một feature: viết thân hàm trong `-api.ts` của nó bằng `api()` và đổi DTO của backend sang kiểu của app ngay tại đó; kiểu DTO
  không đi ra khỏi `-api.ts`. Đọc controller và DTO thật ở repo backend trước, không đoán. Mỗi hàm nối có test với `fetch` giả.

### Lớp dữ liệu

Đường đi chuẩn khi làm màn mới:

1. Viết `features/<tên>/<tên>-api.ts` — nơi duy nhất biết về mạng. Chưa có backend thì trả mock sau một khoảng trễ giả.
2. Bọc bằng hook Query trong cùng feature (`useTripsQuery`).
3. Component chỉ gọi hook, không bao giờ gọi `-api.ts` trực tiếp.

Không màn nào giữ dữ liệu nghiệp vụ ở `useState`: mọi màn đọc/ghi kho mock qua Query (ví dụ trạng thái xe đọc `useVehicleStatesQuery`,
`['vehicles', 'states']`, `staleTime: 0` vì pha chuyến đổi ở màn khác; ghi bảo dưỡng vô hiệu hoá `['vehicles']`).

Tên hàm trong `-api.ts` theo hành động của endpoint ở issue backend (FE-0-09). Mỗi hàm export có một dòng comment ghi endpoint ngay trên nó
(`// POST /api/trips/{id}/optimize-route`), đầu file có bảng hàm → endpoint. Endpoint backend chưa có ghi "chưa có ở BE", kèm mã câu hỏi mở
(`(Q-07)`) khi PRD v2 có; hàm có sẵn lệch tên ghi "tên sẽ đổi khi nối BE: …" ở đầu file. Comment chỉ gồm phương thức + đường dẫn và các nhãn
ngắn đó — repo công khai, không chép luật nghiệp vụ hay nội dung tài liệu nội bộ. Nối backend chỉ thay thân hàm.

**Khoá Query:** mỗi feature một file hook `use*Query.ts` cạnh `-api.ts` của nó (ví dụ `['package-types']`, `['package-pool', …]`,
`['requirements', …]`, `['vehicle-types', …]` — không đặt dưới `['vehicles', id]` để khỏi va mã xe). Dữ liệu gắn một chuyến (sẵn sàng tối
ưu, yêu cầu giao đã vào chuyến `['trips', tripId, 'requirements']`, báo cáo, lần chạy, so sánh ba phương án của một lần chạy
`['trips', tripId, 'run-comparison', runId]`) nằm dưới `['trips', tripId, …]` để mọi ghi của chuyến làm mới chúng; phần thêm cho chuyến ở file
riêng (`trips/trip-extras-api.ts` + `useTripExtrasQuery.ts`) để không đụng `trips-api.ts`. Khoá **không cần mang người dùng hay công ty**:
`AuthProvider` xoá cả cache Query lúc đăng xuất và lúc đăng nhập (`AuthProvider.dom.test.tsx`); chỉ thêm người xem vào khoá khi kết quả tính
theo người xem ngay ở client (`['notifications', id, vai trò]`). Hai ngoại lệ ngoài khoá chuyến, vì mutation chờ mọi truy vấn khớp khoá bị
vô hiệu làm mới xong: **người đã duyệt ở Planner** `['plan-approval', revisionId]` (`viewer-api.ts` → `usePlanApprovalQuery`; dưới khoá chuyến thì
bấm Duyệt chờ nó, Planner dựng lại trên revision mới và mất toast lẫn điều hướng; revision bất biến nên không cần làm mới) và **nhãn QR** của
kho / tài xế `['warehouse-labels', id]`, `['driver', 'labels', id]` (mỗi lần ghi bước xếp, dỡ phải chờ tải lại nhãn).

**Lọc theo công ty nằm ở tầng kho** (FE-0-02, D-64), như backend lọc mọi truy vấn theo `company_id`: component, hook và `-api.ts` **không tự lọc
theo công ty** và không cần biết công ty của người xem. Kho xét phiên của chính nó (`lib/mock-db/tenancy.ts`; mọi `db-*.ts` đọc/ghi qua
`ctx.scope`), ba phạm vi:

- **Phiên của một công ty** (`User.companyId`): hàm liệt kê chỉ trả bản ghi của công ty đó; đọc theo mã bản ghi của công ty khác là
  `NOT_FOUND` như bản ghi không tồn tại (tra mã QR: `QR_UNKNOWN`); ghi vào bản ghi của công ty khác, hoặc tham chiếu tới nó — gán xe, tài
  xế, loại kiện, kiện, chuyến của công ty khác — là `FORBIDDEN_COMPANY`.
- **Phiên nền tảng** (ba vai trò không thuộc công ty nào): mọi hàm dữ liệu vận hành từ chối `COMPANY_REQUIRED`. Người dùng, nhật ký và danh
  sách công ty không phải dữ liệu vận hành: nền tảng đọc hết, người của công ty chỉ đọc của công ty mình (ai tạo, sửa, khoá được ai: mục 1).
  Màn cần tên chuyến, xe để đọc nhật ký hay thông báo gọi `listAuditNames` — theo phạm vi nhật ký, không đòi quyền vận hành — không gọi
  `listTrips` / `listVehicles`.
- **Không có phiên** (test logic kho bằng `createMockDb()`, dựng seed, hai trang tài liệu `/kieu-dang`, `/thanh-phan` ngoài `RequireAuth`):
  **không lọc**; bản ghi tạo ra thuộc công ty mặc định `LOG-001`. Luật "bản ghi chỉ tham chiếu bản ghi cùng công ty" vẫn giữ. Test cần đúng
  dữ liệu của một công ty thì đặt phiên: `db.restoreSession(mã người dùng)` (không ghi nhật ký) hoặc `signedInAs`.

Bản ghi mang công ty: `Trip.companyId`, `PackageType.companyId`, `VehicleType.companyId`, `DeliveryRequirement.companyId`, `Package.companyId`,
`AuditEvent.companyId` (công ty của phiên đã ghi; `null` khi là tài khoản nền tảng; lần đăng nhập sai ghi công ty của tài khoản bị thử). Xe
lưu công ty cạnh `VehicleConfig` trong kho (`vehicleCompany`, D-04); revision và lần chạy tối ưu thuộc công ty của chuyến, không lưu riêng.
Thêm hàm công khai vào kho thì khai nó ở bảng `PROBES` của `tenancy.test.ts` — thiếu là test đỏ.

**Kho kiện, yêu cầu giao, loại hàng**

**Kho kiện theo mô hình backend** (FE-3b-01). Kiện là `Package` (`PK-NNNN`, Phương Nam `PK-PN-NNNN`): `companyId`, `packageCode` (mã của bên
gửi; nơi tạo không đưa thì bằng mã của kho), `qrToken`, kích thước và khối lượng **của chính kiện**, `handlingClass`, `destination`,
`packageTypeId?`, `status`, `flags`, `source` (`IMPORT | MANUAL | TRIP | PICKUP`), `requirementId?` (yêu cầu giao đang giữ kiện), `tripId?`,
`stopId?`, người và thời điểm tạo. Trạng thái **ghi thật**, không suy lúc đọc — chỉ `movePackage` (`db-packages.ts`) đổi `status`, theo bảng
`PACKAGE_TRANSITIONS`: `IMPORTED → ASSIGNED → STAGED → LOADED → IN_TRANSIT → DELIVERED | RETURNED`; `ASSIGNED`, `STAGED`, `LOADED` được về
`IMPORTED` (rời chuyến); sai bảng là `INVALID_PACKAGE_STATUS_TRANSITION`. Kiện của chuyến đổi trạng thái ở **mốc chốt** của chuyến
(`db-package-progress.ts`): đưa yêu cầu giao vào chuyến → `ASSIGNED` kèm chuyến và điểm giao; kho **soạn** một kiện → `STAGED` ngay lúc đối chiếu
bằng nhãn (soạn bằng xác nhận tay: khi điều phối viên duyệt); kiện bị bỏ lúc soạn (thiếu) hoặc lúc xếp (hỏng) về `IMPORTED` kèm cờ `NOT_FOUND` /
`DAMAGED` ngay lúc đó; xếp xong → `LOADED` (mốc chốt, vì kết quả xếp còn bị gỡ khi xác nhận tay bị từ chối); xuất phát → `IN_TRANSIT`; hoàn tất
điểm giao → kiện đã dỡ `DELIVERED`, kiện ở lại xe (khách từ chối, sự cố khác) `RETURNED`; huỷ chuyến trước khi xe chạy hoặc gỡ yêu cầu giao khỏi
chuyến → `IMPORTED`; huỷ chuyến Đang vận chuyển → kiện chưa giao `RETURNED`. Cờ `NOT_FOUND` / `DAMAGED` chỉ gắn trên kiện `IMPORTED`; kiện mang
cờ không vào yêu cầu giao hay chuyến được (`PACKAGE_FLAGGED`, `isSelectablePackage`); `clearPackageFlag` chỉ điều phối viên gọi được
(`ROLE_NOT_ALLOWED`) và ghi nhật ký; nhân viên kho gỡ cờ `NOT_FOUND` bằng `reportPackageFound` khi tìm thấy lại kiện (FE-3b-06). Mã QR cấp một
lần lúc tạo, `updatePackage` không đổi nó. Mã QR là chuỗi ngẫu nhiên `LM-XXXX-XXXX-XXXX` (Crockford base32) không chứa dữ liệu kiện, cấp cho
mọi kiện kho kiện — kể cả kiện thêm trong chuyến; dưới Vitest sinh từ bộ số có hạt giống (tất định), app dùng `Math.random`.

**Yêu cầu giao** (`DeliveryRequirement`, FE-4b-01, D-72, D-91 → D-93; `requirement-model.ts`): mã `REQ-NNN` (Phương Nam `REQ-PN-NNN`),
`companyId`, `destinationName`, `address`, `lat?` / `lng?` (có cả hai hoặc không có), `deadline` (ISO), `priority` (`LOW | NORMAL | HIGH | URGENT`),
`packageIds`, `note?`, `status`, `tripId?`, người và thời điểm lập. Dòng kiện của yêu cầu nằm ở `DbState.tripPackageLinks` với `requirementId`;
điểm giao của yêu cầu là điểm của các dòng đó. Kho **ghi** ba trạng thái: `PENDING` → `ASSIGNED` (đưa vào chuyến) → `IN_TRIP` (xe xuất phát);
gỡ khỏi chuyến hoặc huỷ chuyến trước khi xe chạy đưa yêu cầu về `PENDING` (D-91). "Đã giao" (`DELIVERED`) và "Giao thiếu" (`PARTIAL`) **suy lúc
đọc** bằng `requirementStatus(requirement, kiện)`: có kiện mang cờ hoặc hoàn trả là giao thiếu (D-92); đang giao mà mọi kiện đã giao là đã
giao. Luật của kho (`db-requirements.ts`, `db-requirement-trips.ts`): kiện phải `IMPORTED`, không cờ, chưa thuộc yêu cầu khác; hạn phải ở
tương lai theo đồng hồ của kho, chỉ kiểm khi tạo hoặc khi đổi hạn (`REQUIREMENT_DEADLINE_PAST`); còn `PENDING` thì sửa mọi trường, đã vào
chuyến chỉ sửa hạn và ưu tiên (`REQUIREMENT_NOT_PENDING`), đã giao xong thì không sửa (`REQUIREMENT_STATUS_INVALID`); xoá chỉ khi `PENDING`.
Ưu tiên → `priority` / `mustLoad` của dòng kiện khi vào chuyến chỉ nằm ở **một bảng** `REQUIREMENT_CARGO_PRIORITY` (D-93, đã xác nhận: Khẩn 4
và bắt buộc xếp, Cao 3, Bình thường 2, Thấp 1); đổi ưu tiên của yêu cầu đã vào chuyến còn lập kế hoạch thì dòng kiện đổi theo và phương án
lỗi thời. Nhật ký: nhóm `requirement` (`created`, `updated`, `deleted`, `assigned`, `unassigned`), đối tượng `requirement`.

**Màn Yêu cầu giao** (`features/requirements`, FE-4b-02): `requirements-api.ts` → `useRequirementsQuery.ts`; ghi yêu cầu làm mới `['requirements']`, `['package-pool']`, và — khi sửa, đưa vào hay gỡ khỏi chuyến — `['trips']`, `['dashboard']`, `['warehouse']`. Bảng
(`RequirementsPage`, hàm thuần `requirement-list.ts`): mặc định sắp theo hạn gần nhất trước; lọc `trang-thai`, `uu-tien`, khoảng hạn
`han-tu` / `han-den` (ngày theo giờ Việt Nam) là slug trên URL; bấm mã yêu cầu mở `RequirementDetailDialog`. Form (`RequirementFormDialog`,
luật thuần ở `requirement-form.ts`, schema zod chỉ gắn câu lỗi vào ô): hạn nhập bằng ô ngày + ô giờ theo giờ của máy; ô chọn kiện có ô lọc
theo điểm đến ghi trong file; hai **cảnh báo không chặn lưu** (`packageWarnings`) — kiện khác loại hàng, điểm đến trong file khác điểm đến của
yêu cầu; yêu cầu đã vào chuyến thì chỉ ô hạn và ưu tiên còn sửa. Ô theo dõi giá trị đang gõ (`useWatch`) đặt trong component con để thân form
và ô chọn kiện hàng trăm dòng không vẽ lại theo từng phím. Toạ độ là **ô riêng của form** (`CoordinatePicker`): để trống cả hai ô là bỏ toạ độ;
đổi địa chỉ không tự bỏ toạ độ. Điều phối viên chỉ xem và "Đưa vào chuyến" (`RequirementAssignDialog`, FE-4b-04: chỉ chọn chuyến Nháp / Đã lập
kế hoạch — **không chọn điểm giao**, hộp thoại nói trước yêu cầu gộp vào điểm nào hay chuyến thêm điểm mới, `stopOfRequirement`); Chi tiết chuyến
có thẻ "Yêu cầu giao của chuyến" (`TripRequirementsCard`: theo thứ tự điểm giao, kèm hạn và ưu tiên).

**Ô chọn toạ độ** `CoordinatePicker` (`@/components/map`, FE-4b-03, D-72) dùng chung cho yêu cầu giao, điểm giao thêm tay, kho xuất phát: giá trị
là **chữ** của hai ô vĩ độ / kinh độ (`CoordinateText`), đổi thành số bằng `parseCoordinates` (thuần, trả mã lỗi theo ô; nhận dấu chấm lẫn dấu
phẩy); form giữ một trường `{ lat, lng }` qua `Controller` và chặn lưu bằng cùng hàm đó, câu lỗi của từng ô do ô chọn toạ độ tự hiện (sau khi
con trỏ rời nhóm ô, hoặc `showErrors` khi form đã bấm lưu). Ba lối nhập: danh sách **địa danh mẫu** (`SEED_PLACES` ở `seed-places.ts`, **toạ độ
gần đúng ở mức khu vực**; tìm bỏ dấu `searchPlaces`, combobox + listbox), gõ tay, và bấm lên bản đồ (`CoordinatePickerMap`, chunk lười) **chỉ
khi có `VITE_GOONG_MAPTILES_KEY` và WebGL**. Tìm địa chỉ đi qua `places-api.ts` (`searchAddress`, "chưa có ở BE", Q-20): trình duyệt không gọi Goong.

**Lập chuyến** (FE-4b-04, D-73, D-76): `Trip` có `departureAt` (ISO) và `depot` (`CompanyDepot`, mặc định kho của công ty); `scheduledDate`
luôn là ngày của `departureAt` theo giờ Việt Nam — đổi giờ xuất phát thì ngày chạy theo, chỉ đổi ngày thì giữ giờ trong ngày; hai trường không
làm phương án lỗi thời; kho đang xếp còn đổi giờ, không đổi kho đi (`TRIP_INVALID` khi giờ không đọc được hoặc kho thiếu tên / toạ độ). Form
chuyến nhập ngày + giờ theo giờ Việt Nam (`departureAtOf`) và **không nhập điểm giao khi tạo**; form sửa chỉ đổi chữ của điểm đang có (điểm
tự sinh khoá tên và địa chỉ). **Điểm giao tự sinh** (`trip-stops.ts`, thuần): đưa yêu cầu vào chuyến (`assignDeliveryRequirement(requirementId,
tripId)`) gộp vào điểm có cùng khoá `stopKey` — địa chỉ chuẩn hoá (chữ thường, bỏ dấu câu, gộp khoảng trắng, **giữ dấu tiếng Việt**) + toạ độ
tới 5 chữ số lẻ; chưa có toạ độ là một giá trị riêng — không có thì sinh điểm `generated` cuối tuyến (mã `STOP-NN` kế tiếp). `DeliveryStop` có
`lat?` / `lng?`, `generated?`, `deadline?`, `priority?`: hạn = hạn sớm nhất, ưu tiên = cao nhất của các yêu cầu có dòng kiện ở điểm, kho ghi
lại (`withStopDemands`) mỗi khi yêu cầu vào / rời chuyến, đổi hạn hay ưu tiên, hoặc dòng kiện / thứ tự điểm đổi. Gỡ yêu cầu hoặc bỏ kiện:
điểm `generated` không còn dòng kiện nào tự mất, kiện ở các điểm sau đánh số lại; điểm thêm tay (Chi tiết chuyến → "Thêm điểm giao",
`StopFormDialog`, `trip-stops-api.ts`) ở lại và không có hạn. Chuyến chưa có điểm giao thì chưa gõ / nhập kiện tay được. Thêm, bớt điểm sau
khi đã tối ưu tuyến đưa chuyến về Nháp (mục "Dữ liệu dùng chung và tối ưu").

**Kiện Đã nhập đưa thẳng vào chuyến** (FE-4b-05, D-68): `addTripPackages(tripId, packageIds, target)` (điểm đang có hoặc điểm tay mới),
`removeTripPackage`, `listTripPackages` (kèm đường vào chuyến `REQUIREMENT | POOL | TRIP`) ở `db-trip-pool.ts`; kiện phải `IMPORTED`, không cờ,
không thuộc yêu cầu nào; sang `ASSIGNED`, không có hạn; bỏ khỏi chuyến về `IMPORTED`. Liên kết dòng mang `fromPool`: sửa dòng chỉ đổi `stopId`
của kiện, không ghi đè mã, kích thước, điểm đến. Lớp API `trips/trip-pool-api.ts` → `useTripPoolQuery.ts` (khoá `['trips', tripId,
'pool-packages']`); Chi tiết chuyến có thẻ "Kiện đưa thẳng từ kho kiện" và hộp thoại `PoolPackagePicker` (ô chọn điểm chỉ liệt kê điểm tay).
Nhật ký: `trip.packagesAdded`, `trip.packageRemoved`.

**Kiện thêm ngay trong chuyến tự vào kho kiện** (FE-3b-07, D-68): sau mỗi lần ghi dòng kiện hay điểm giao của chuyến (`createTrip`, `updateTrip`,
gỡ yêu cầu giao khỏi chuyến), `syncTripPool` (`db-trip-packages.ts`) giữ cho mỗi instance của dòng (`quantity`) một bản ghi `Package` nguồn
`TRIP`, `ASSIGNED`, kèm chuyến và điểm giao, mã QR thật cấp ngay; `packageCode` là mã instance (`PKG-001-07`), điểm đến là địa chỉ điểm giao,
loại hàng lấy `handlingClass` của dòng (vắng là `STANDARD`). Tăng số lượng tạo thêm kiện; giảm số lượng hoặc xoá dòng trả kiện về `IMPORTED`;
sửa kích thước, loại hàng hay điểm giao của dòng thì kiện đổi theo, mã QR giữ nguyên. Không ghi sự kiện nhật ký riêng — `trip.created` /
`trip.updated` đã nói. Liên kết instance ↔ kiện nằm ở `DbState.tripPackageLinks` (ngoài `Trip`, kiện thứ i là instance thứ i của dòng); dòng
của yêu cầu giao dùng kiện của yêu cầu (liên kết mang `requirementId`), dòng của yêu cầu bị sửa số lượng thì được cấp kiện riêng. Nhãn của chuyến
(`tripLabels`), quét khi xếp / dỡ, in nhãn và tra cứu đều dùng mã QR của kiện kho kiện; tiến độ chuyến ghi trạng thái cho cả kiện nguồn `TRIP`
(`lineInstances`). Mẫu nhập kiện trong chuyến có cột cuối tuỳ chọn `handlingClass` (mã hoặc nhãn vi / en, lỗi `HANDLING_CLASS_INVALID`), form
kiện có ô "Loại hàng" — chỉ ghi vào kiện khi người dùng chọn, để lưu lại một kiện cũ không làm phương án lỗi thời; bảng kiện của chuyến có nút
"In nhãn QR" (`labels.print`) mở `/kien-hang/nhan?chuyen=<mã>`.

**Phân tách hàng — một chuyến một loại hàng** (FE-4b-06, D-74). Luật thuần ở `domain/constraints/segregation.ts`: `segregation(dòng kiện, xe)`
trả loại đang khoá (loại của dòng kiện đầu tiên; dòng không ghi loại là `STANDARD`; chuyến rỗng là `null` — khoá tự tính lại), nhóm theo loại,
xung đột (mọi dòng khác loại đang khoá) và cảnh báo xe `HAZARDOUS_VEHICLE_REQUIRED` (có hàng nguy hiểm) · `REFRIGERATION_MISSING` (có hàng
lạnh mà xe không có vật cản `COOLING_UNIT` — đề xuất D-74, chờ nhóm xác nhận); `addedConflicts` so trước / sau. Kho kiểm **ở mọi lối kiện vào
chuyến** qua một hàm `settleSegregation` (`db-trip-segregation.ts`), gọi trước khi ghi: đưa yêu cầu giao vào chuyến, đưa kiện kho kiện thẳng
vào chuyến, gõ / nhập / sửa / nhân bản dòng kiện (`updateTrip`), tạo chuyến có sẵn kiện. Có xung đột **mới** mà chuyến chưa có lý do và nơi gọi
không đưa lý do: `CARGO_SEGREGATION_CONFLICT { tripId, lockedClass, packages }` (mã của bên gửi với kiện kho kiện, mã dòng với kiện gõ tay),
không ghi gì. Nơi gọi đưa `overrideReason` (bắt buộc — `REASON_REQUIRED`; tối đa 500 ký tự — `OVERRIDE_REASON_TOO_LONG`): kho lưu
`Trip.overrideReason` và ghi `trip.segregationOverridden` (lý do, loại đang khoá, số kiện khác loại); chuyến đã có lý do thì kiện khác loại
thêm sau đi tiếp; chuyến hết kiện khác loại thì kho gỡ lý do. `getTripSegregation` đọc, `overrideTripSegregation` ghi / sửa lý do cho xung đột
đang có (chỉ khi còn lập kế hoạch). Kiểm tra sẵn sàng tối ưu có mục `CARGO_SEGREGATED`: xung đột chưa có lý do là chưa đạt, đã có lý do là
cảnh báo.  `assignRequirementToTrip`,
`addTripPackages`, `savePackage`, `importPackages` nhận thêm `overrideReason`. UI: thẻ "Phân nhóm hàng" (`SegregationCard`, cột phải Chi tiết
chuyến, mọi pha) và hộp vượt luật `SegregationOverrideDialog` dùng chung qua `useSegregationGuard`: lần ghi bị từ chối vì xung đột mở hộp thoại,
lưu lý do là gọi lại đúng lần ghi đó kèm lý do — mở từ một hộp thoại có `<form>` thì đặt **ngoài** form đó.

**Loại hàng** `HandlingClass` (`STANDARD | FRAGILE | REFRIGERATED | HAZARDOUS | HIGH_VALUE`, FE-3b-04) khai ở `domain/models/package.ts`;
`CargoPackage` có thêm `handlingClass?` — trường ngoài type Spec, khai tường minh trong `spec-contract.test.ts`. `cargoFromPackage(pkg,
packageType?)` dựng dòng kiện Spec từ kiện kho kiện: có loại kiện thì lấy hướng đặt, xếp chồng, tải trên của loại; không có thì mặc định theo
loại hàng (`FRAGILE` không cho đè lên, loại khác chịu ba lần khối lượng của nó). Nhãn loại hàng, trạng thái và cờ kiện khai một lần ở nhánh
`common` (`handlingClasses`, `packageStatuses`, `packageFlags`); chip loại hàng là `components/HandlingClassChip` — tint theo nghĩa (thường
slate, bốn loại cần chú ý amber), nhận ra bằng icon và chữ.

**Giới hạn theo loại xe và loại kiện** (FE-5b-01, D-78, D-79). Loại xe (`VehicleType`) có `frontAxleLimitKg?`, `rearAxleLimitKg?` (để trống là
chưa khai) và `maxCogOffsetRatio` (mặc định 0,15, trong (0, 0,5]; form `/doi-xe/loai-xe` nhập bằng %, `vehicle-type-form.ts`). `VehicleConfig`
có ba trường cùng tên, **ngoài type Spec** (khai ở `spec-contract.test.ts`): kho lưu xe không kèm giới hạn và **ghép giới hạn của loại xe đang
gắn lúc đọc** (`listVehicles`, `getVehicle` → `withTypeLimits`, `vehicle-limits.ts`), nên request tối ưu và revision chụp đúng giới hạn lúc
chạy; xe chưa gắn loại không có trường nào — tải trục so với `axles[].maxLoadKg`, trọng tâm dùng `DEFAULT_MAX_COG_OFFSET_RATIO`. Sửa giới hạn
của loại, hoặc gắn / gỡ loại làm **giới hạn hiệu lực** của xe đổi (`sameLimits`), làm phương án của chuyến đang lập kế hoạch với xe đó lỗi thời,
như khi sửa xe. Loại kiện (`PackageType`) có `maxStackWeightKg`, `rotationAllowed`, `fragile` — hình chiếu của `maxTopLoadKg` / `stackable`,
`allowedOrientations`, `fragilityLevel`, kho ghi lại mỗi lần lưu (`backendLimitsOf`); chiều backend → Spec là `specFieldsOf`
(`package-type-limits.ts`). Form loại kiện có công tắc "Cho phép xoay kiện": bật khi còn hơn một hướng đặt, tắt đưa hướng đặt về riêng `LWH`.

**Ngưỡng ràng buộc** (FE-5b-04, D-79). Trọng tâm hàng (`checkCenterOfGravity`): lệch ngang `COG_LATERAL` và lệch dọc `COG_LONGITUDINAL` (kèm
phía bị dồn về) khi vượt `maxCogOffsetRatio` × chiều rộng / chiều dài lòng thùng; `COG_HIGH` giữ ngưỡng nửa chiều cao (`COG_HEIGHT_RATIO`);
cả ba là cảnh báo, không chặn Duyệt. Diện tích tựa tối thiểu mặc định **0,7** ở một chỗ (`DEFAULT_MIN_SUPPORT_RATIO` của
`domain/constraints`): dòng kiện dựng từ loại kiện / kiện kho kiện, kiện mới của form và file nhập thiếu cột; kiện seed giữ số đã khai. Lý do
chưa xếp thêm `CONSTRAINT_VIOLATED` kèm `violatedConstraints` (issue đủ mã + tham số, dịch bằng `formatIssue` ở danh sách "Kiện chưa xếp");
mock dùng nó khi đặt kiện vào chỗ tìm được sẽ làm một nhóm trục vượt giới hạn (`AXLE_OVERLOAD`) — xe không khai trục không có kiểm này. Thêm mã
ràng buộc: `CONSTRAINT_CODES`, `issues` vi / en, một mẫu trong `issue-message.test.ts`.

**Màn Kho kiện** (`features/package-pool`, FE-3b-03, FE-3b-02): tạo kiện, nhập file, gỡ cờ làm mới `['package-pool']`, `['package-types']`, `['requirements']`.
Bảng (`PackagesPage` + `PackagesTable`, hàm thuần `packages-list.ts`): mới nhất trước; tab trạng thái `trang-thai` và ba bộ lọc `loai-hang`,
`co`, `gan` (đã / chưa vào yêu cầu giao hay chuyến) là slug trên URL; bấm dòng mở `PackageDetailPanel` (mã QR, cờ, lịch sử), panel mở thì bảng bỏ
bốn cột đã có trong panel. **Lịch sử kiện** là `Package.history` do kho ghi ở đúng chỗ đổi kiện (tạo, `movePackage`, gắn / gỡ cờ) — màn không
suy từ nhật ký; `fetchPackageDetail` ghép tên người làm. "Thêm kiện" là form một kiện (`package-form.ts`, lỗi là mã). **Nhập file**
(`package-pool-import.ts`, hàm thuần trả mã): cột `package_code, length, width, height, weight, handling_class, destination` + tuỳ chọn
`package_type`, tìm theo tiêu đề vi / en, đơn vị cm / kg; lỗi file là mã `dataErrors` (`UNSUPPORTED_FILE_TYPE`, `EMPTY_FILE`, `FILE_TOO_LARGE`
10 MB, `BATCH_TOO_LARGE` 1.000 dòng, `IMPORT_COLUMNS_MISSING`); lỗi dòng kèm số dòng của file (tiêu đề là dòng 1): `PACKAGE_CODE_REQUIRED`,
`INVALID_DIMENSION`, `INVALID_WEIGHT`, `INVALID_HANDLING_CLASS`, `DESTINATION_REQUIRED`, `DUPLICATE_PACKAGE_CODE`, `PACKAGE_TYPE_NOT_FOUND`;
cảnh báo `PACKAGE_CODE_EXISTS` không chặn. Còn một dòng lỗi thì nút Xác nhận vô hiệu và `confirmPackageImport` từ chối
`PACKAGE_IMPORT_INVALID`; xác nhận gọi `createPackages(rows, 'IMPORT')` một lần, nhật ký `package.importConfirmed` (thêm lẻ là
`package.created`). Tìm nhanh: nhóm `pool` theo `packages.view`.

**Nhãn in** (`PackageLabel`, khổ ở `label-sheet.ts`, FE-3b-05, D-71): in bằng trình duyệt, A4 dọc lề 10 mm, **bốn nhãn mỗi trang** (2 × 2, khe
4 mm), mỗi nhãn 93 × 134 mm — khổ PDF của backend chưa chốt. Nhãn có mã QR kèm mã chữ, mã của bên gửi, loại hàng, kích thước (cm), khối lượng
(kg), điểm đến, mã của kho kiện, logo `mono`, tên loại kiện (nếu có) và công ty; kiện `FRAGILE` thêm khung "Hàng dễ vỡ". Không nền màu (in đen
trắng), chữ dài xuống dòng chứ không cắt. Mọi cỡ trong nhãn là `em` của cỡ chữ gốc — bản in gốc 4 mm, bản xem trên màn gốc 16 px — nên hai bản
một bố cục. Trang nhãn đọc kiện từ URL: `?kien=<mã,…>` hoặc `?chuyen=<mã chuyến>`; không chọn gì thì không có nhãn nào. In lại giữ nguyên mã QR.
Nút quay lại về nơi bấm in (`labelsBackTarget`): chuyến, Tra cứu kiện (`&tu=tra-cuu`), không thì Kho kiện; người không mở được đích đó về Tra cứu
kiện.

**Tra cứu kiện** `/tra-cuu-kien` (`PackageLookupPage`, hàm thuần `package-lookup.ts`, FE-3b-06, D-63, D-92): quét bằng `QrScanDialog`
(`scanPackage` → `GET /api/packages/scan/{qrToken}`) hoặc gõ mã QR / mã của bên gửi / mã của kho (`lookupPackages`, khớp đúng cả mã, không
phân biệt hoa thường). Mã đang tra nằm trên URL (`?ma=`, kiện đã chọn `&kien=`). Một kiện: thẻ kiện;  nhiều kiện trùng mã của bên gửi: danh sách để chọn; không khớp, hoặc là kiện của công ty
khác: "Không tìm thấy" (`QR_UNKNOWN`), không lộ dữ liệu. Hành động theo vai trò (`lookupActions`): "In lại nhãn" (`labels.print`); điều phối
viên gỡ cờ, mở kiện ở Kho kiện và mở chuyến; nhân viên kho **quét** thấy kiện mang cờ "Không tìm thấy" thì cờ được gỡ ngay, **gõ mã** thì thẻ
có nút "Đã tìm thấy kiện này" — cả hai gọi `reportPackageFound` (chỉ vai trò kho, chỉ cờ `NOT_FOUND`), kho ghi sự kiện `package.found` và điều
phối viên thấy ở chuông. "Quét mã QR" là nút chính của màn. Màn nằm trong khung ứng dụng; nhân viên kho (`warehouse.operate`) được nút, ô nhập
56 px, chữ từ 16 px và nút "Về màn kho" trên dải trời.

**Đối chiếu kiện, soạn → xếp → giao, huỷ chuyến**

**Đối chiếu kiện ba mức** (FE-6-03, FE-6-04, D-83) — một hộp `components/PackageVerify` dùng chung cho kho và tài xế (soạn hàng, xếp, dỡ, nhận
dọc đường): (1) quét QR (`QrCamera` của `QrScanDialog`); (2) gõ mã — mã QR in dưới hình, hoặc **mã của bên gửi khi nó duy nhất trong chuyến**
(trùng: `PACKAGE_CODE_AMBIGUOUS`; luật thuần `resolveVerifyCode`); (3) xác nhận tay — chọn kiện + lý do (`MANUAL_CONFIRM_REASONS`: nhãn rách /
mất, QR không đọc được, khác kèm ghi chú bắt buộc), kho in lại được nhãn của kiện (`loadingLabelPath`, mã QR giữ nguyên, nút quay lại về đúng
phiên xếp). Hộp không biết kiện nào đúng: nơi gọi gửi mã / kiện cho kho và trả kết quả về (`result` là vùng `status` / `alert`); nút 56 px,
chữ 16 px. `QrScanDialog` chỉ quét + gõ mã, cho Tra cứu kiện. Kho ghi **mỗi lần đối chiếu** vào `Trip.verifications` (`PackageVerification`:
bước `STAGING` / `LOADING` / `UNLOADING` / `PICKUP`, cách `QR` / `CODE` / `MANUAL`, người, thời điểm; mã `VF-NNN` trong chuyến); `steps[].via: 'qr'`
và `qrConfirmedIds` nghĩa là "đã đối chiếu bằng nhãn" (quét hoặc gõ). Hàm của kho: `confirmLoadingByQr` / `confirmUnloadByQr` nhận thêm
`method`; `confirmLoadingManually` / `confirmUnloadManually` ghi kiện như đã xếp / đã dỡ để làm tiếp, kèm xác nhận tay `MANUAL_PENDING`. Không
có lối ghi không đối chiếu. **Kho tự chặn** (giao diện bị bỏ qua cũng không qua): `completeLoading` và `completeStop` từ chối
`MANUAL_CONFIRM_PENDING` khi còn xác nhận tay chờ của bước xếp / của điểm đó — lớp `-api.ts` của kho không tự hoàn tất xếp khi còn chờ, màn
hiện nút mờ kèm lý do. Điều phối viên (`manualConfirm.approve`; kho kiểm vai trò: `ROLE_NOT_ALLOWED`) duyệt — `approveManualConfirmation`, kiện
giữ kết quả — hoặc từ chối kèm lý do bắt buộc — `rejectManualConfirmation`, kết quả xếp / dỡ của kiện bị gỡ nên bước hiện tại của kho quay về
đúng kiện đó và dòng kiện của tài xế về "chưa dỡ" kèm lý do (`rejectedConfirms`). Xác nhận tay còn chờ bị thay khi kiện được đối chiếu lại bằng
nhãn, và bị bỏ khi kiện được ghi lại không qua đối chiếu (bước xếp ghi tay, bỏ đánh dấu đã dỡ). Thẻ "Xác nhận tay chờ duyệt" đứng đầu cột chính
của Chi tiết chuyến (`trips/ManualConfirmCard`); người chỉ xem thấy danh sách không có nút. Nhật ký: nhóm `manualConfirm`
(`requested`, `approved`, `rejected`), đối tượng là chuyến.

**Soạn → xếp → giao, và chuyển ngược** (FE-6-02, FE-6-05, FE-6-06, FE-6-07, D-82, D-84, D-91, D-92). Kho giữ luồng dù giao diện bị bỏ qua:

- **Soạn hàng** (`db-staging.ts`, `StagingStepPage`): `startLoading` đưa chuyến sang Đang xếp hàng ở bước soạn (`loading.stagedIds`); kho
  đối chiếu từng kiện vào khu chờ, không cần thứ tự (`confirmStagingByQr` — quét lại kiện đã soạn trả `alreadyStaged`, không ghi;
  `confirmStagingManually`); mã ngoài chuyến là `PACKAGE_NOT_IN_TRIP`. "Báo thiếu" (`reportStagingShortage`) ghi `loading.shortages`, dòng
  phụ "Thiếu kiện — chờ điều phối"; điều phối viên quyết ở thẻ "Kiện kho báo thiếu" của Chi tiết chuyến (`trips/MissingPackagesCard`,
  `shortage-api.ts`, theo `trips.edit`; kho kiểm vai trò): `resolveStagingShortage` `KEEP_SEARCHING` đóng báo thiếu, `DROP` bỏ kiện khỏi
  chuyến. Soạn đủ mới xếp được (`STAGING_INCOMPLETE`); bước của chuyến là `loadingStep` (còn kiện chưa soạn là soạn).
- **Xếp** theo `loadingOrder`, mỗi kiện phải đối chiếu (sai kiện / sai thứ tự: `WRONG_PACKAGE_SCANNED`). "Kiện hỏng"
  (`reportDamagedPackage`, kiện của bước hiện tại): trong **phương án** không kiện nào tựa lên nó (`restingOnIds` của domain) thì kiện bị
  bỏ lại kho — bước ghi `outcome: 'damaged'`, kho xếp tiếp, tài xế không phải dỡ (`leftOutIds`) —; có kiện tựa lên thì chuyến quay về Đã
  lập kế hoạch. Xong xếp khi mọi kiện đã soạn, đã có kết quả và không còn xác nhận tay chờ (`LOADING_INCOMPLETE`, `MANUAL_CONFIRM_PENDING`).
  Thẻ hướng dẫn nói vùng của kiện ("Vùng <điểm giao> — sát cửa", `zonePlace`).
- **Chuyển ngược `LOADING → PLANNED`** (`db-replan.ts`): kiện bị bỏ rời hẳn chuyến (dòng kiện bớt một, `inputVersion` tăng → phương án
  lỗi thời), về `IMPORTED` kèm cờ, vẫn do yêu cầu giao của nó giữ (yêu cầu đọc ra giao thiếu); chuyến bỏ tiến độ và các lần đối chiếu của
  phiên, mang `Trip.replan` (lý do, có phải dỡ ra không) để kho thấy "Chờ điều phối tối ưu lại". Kiện đã soạn giữ `STAGED`: bắt đầu lại
  thì vẫn tính là đã soạn.
- **Tài xế**: "Xuất phát" (`startDelivery`, chỉ khi xếp xong) → mỗi điểm "Đã đến" (`arriveAtStop` ghi `StopProgress.arrivedAt`) rồi mới
  dỡ, báo sự cố theo kiện và hoàn tất điểm (`STOP_NOT_ARRIVED`); dỡ chỉ qua hộp đối chiếu; "Khách từ chối" bỏ dấu đã dỡ của kiện — kiện
  ở lại xe, thành `RETURNED` khi hoàn tất điểm. Một nút chính theo bước: Xuất phát → Đã đến điểm n → Hoàn tất điểm giao.
- **Huỷ chuyến** (`cancelTrip`): từ Nháp, Đã lập kế hoạch, Đang xếp hàng — kiện về `IMPORTED`, yêu cầu giao về `PENDING`; huỷ lúc đang xếp
  thì sự kiện mang `loaded` (số kiện đã lên xe) và kho được báo dỡ ra. Chuyến **Đang vận chuyển** huỷ được **chỉ khi có sự cố cấp chuyến
  chưa xử lý** (`OPEN` hoặc `ESCALATED`; `canCancelTrip` — kho và hộp thoại dùng cùng hàm): kiện chưa giao (còn `IN_TRANSIT`, kể cả kiện đã
  dỡ ở điểm chưa hoàn tất) thành `RETURNED` và **ở lại chuyến**, yêu cầu giao giữ `IN_TRIP` và đọc là "Giao thiếu" (D-92), vị trí xe ghi bù
  tới lúc huỷ rồi dừng, sự kiện `trip.cancelled` mang `returned` (số kiện hoàn trả) — quản lý công ty thấy ở chuông; sự cố chưa xử lý ở lại
  như đã ghi. Trạng thái khác: `INVALID_TRIP_STATUS_TRANSITION`. Menu thao tác của Chi tiết chuyến có mục "Huỷ chuyến" cho chuyến Đang vận
  chuyển; hộp thoại đọc sự cố của chuyến và hoặc nói bao nhiêu kiện thành Hoàn trả, hoặc để nút huỷ mờ kèm lý do.
- **Báo cáo chuyến** (FE-6-14; `tripReport(trip, plan, { exceptions, reroutes })`, thuần): mỗi điểm giao có giờ đến dự kiến của tuyến
  (`routePlan`), giờ đến thật (`arrivedAt`), hạn giao kèm mức hạn — đã đến thì "Đến kịp hạn" / "Đến trễ hạn" theo giờ đến thật, chưa đến thì
  mức hạn của tuyến — và số kiện hoàn trả; thêm số kiện đã soạn, bảng cách đối chiếu theo bước (lần đối chiếu mới nhất của từng kiện), xác
  nhận tay kèm người gửi và người duyệt, sự cố cấp chuyến, tuyến đã đổi (`listTripReroutes`, MOCK RESULT), lý do chở chung khác loại hàng.
  Chuyến bị huỷ lúc đang vận chuyển: kiện của điểm chưa hoàn tất tính là hoàn trả, "đã giao" chỉ tính điểm đã hoàn tất. Menu thao tác hiện
  mục "Báo cáo chuyến" cho **mọi người xem được chuyến** (quản lý công ty mở từ đây) khi chuyến đã giao hoặc bị huỷ lúc đang vận chuyển; sửa,
  đổi xe, huỷ vẫn theo `trips.edit`. Bản in: chữ dài xuống dòng (`print:line-clamp-none`), không cắt.
- Test và E2E đưa chuyến qua các bước bằng `src/test/trip-flow.ts` (`stageAll`, `loadAll`, `loadTrip`, `unloadStop`) — E2E gọi qua
  `e2e/operations-helpers.ts`. Seed: mọi chuyến đã ở kho đều soạn đủ và mọi kiện đều đối chiếu bằng quét; điểm đã tới có `arrivedAt`.

### Dữ liệu dùng chung và tối ưu

- Dữ liệu đi qua nhiều màn (xe, chuyến, kiện, revision kết quả) nằm trong **mock repository in-memory** (`src/lib/mock-db/`, D-06) →
  `features/<tên>/<tên>-api.ts` → hook TanStack Query. Ghi bằng `useMutation` rồi invalidate. Không thêm store client (Zustand, Redux, Context
  giữ dữ liệu nghiệp vụ).
- **Đồng bộ kho giữa các tab cùng trình duyệt** (FE-BL-06; `tab-sync.ts`, chỉ cho kho của app `getMockDb()` — mỗi `createMockDb()` của test là
  một kho riêng; Vitest không bao giờ mở kênh thật). Đứng ngoài kho: `db-*.ts` không biết có nó; `withTabSync` báo sau mỗi lượt đọc/ghi, lớp này
  so từng bản ghi với bản đã gửi (kho ghi cả tại chỗ và ghi lúc đọc nên không có chỗ biết "vừa đổi gì") rồi gửi phần đổi (`delta`) qua kênh
  `loadmaster-mock-db-v1`; `packages`, `revisions`, `events` chỉ thêm hoặc thay cả bản ghi nên so theo danh tính object. **Phiên
  (`state.session`) không bao giờ được gửi**: mỗi tab một người dùng. Mọi trường mới của `DbState` phải là `Map` (hoặc `events`/`session`) —
  một test canh việc đó. Tab mở sau gửi `hello`; tab đang mở đầu tiên trả lời bằng nguyên trạng thái (`snapshot`) kèm đồng hồ của nó; 250 ms
  không ai trả lời thì tab dùng seed như khi chỉ có một tab. Hai tab ghi cùng lúc: mỗi bản ghi có dấu Lamport `(bộ đếm, mã tab)`, dấu mới hơn
  thắng ở mọi tab — các tab hội tụ, bản thua mất. **Các tab dùng chung đồng hồ của tab đầu**: tab sau nhận giờ và tốc độ từ snapshot (`?toc-do`
  của nó bị bỏ qua), đổi tốc độ giữa chừng đi kèm `delta`. Nhận dữ liệu từ tab khác thì `Providers` làm mới mọi truy vấn (`onRemoteDbChange`
  → `invalidateQueries`, gộp 100 ms), không đụng state của form. Giới hạn: mở tab thứ hai **sau khi** tab đầu đã tải xong; tải lại một tab đang
  đăng nhập bằng tài khoản tạo lúc chạy thì phiên khôi phục trước khi nhận snapshot (tài khoản seed thì không sao); không có `BroadcastChannel`
  thì không đồng bộ, không lỗi.
- Tối ưu đi qua interface `OptimizationService` (`src/services/optimization`). Có mock chạy trên luồng gọi (`MockOptimizationService`), trong
  Web Worker (`WorkerOptimizationService`) và bản giả lập sự cố (`UnavailableOptimizationService`); API thật sau này thay tại `-api.ts`, UI không
  đổi. Kết quả mock luôn `isMockResult: true`. Mock thuần là `runMockOptimization` (tất định theo request + `randomSeed`, `runtimeMs` qua `clock`
  tiêm vào); `FAILED` chỉ khi request sai schema hoặc có lỗi toàn cục — contract không có `warnings`, nên UI chạy `validateRequest` trước khi
  gọi. `message` của kiện chưa xếp là `reasonCode`, UI dịch mã. Trạng thái demo lỗi service bật bằng `?mo-phong=loi`, đọc ở `-api.ts`, không
  đưa công tắc kỹ thuật lên UI vận hành; `-api.ts` lấy service qua `createOptimizationService({ simulateFailure })` — Web Worker trong trình
  duyệt, luồng gọi khi không có Worker (jsdom), mọi đường kết thúc đều `terminate`.
- **Vùng theo điểm giao và số lần dỡ-xếp lại** (FE-5b-02, D-79). Hàm thuần `stopZones(vehicle, stops)` (`@/domain/zones`): chiều dài vùng i =
  (L − (n − 1) × 10 cm) × tỷ lệ thể tích hàng của điểm i, giữa hai vùng liền nhau có đệm 10 cm; `stops` theo thứ tự giao — điểm đầu sát cửa
  (X lớn), điểm cuối sâu nhất (X = 0). Mốc tính cộng dồn từ vách trong, làm tròn 0,1 cm, mốc cuối đặt đúng L: tổng vùng + đệm luôn bằng L.
  `stopId` của vùng là **số điểm giao** (`CargoPackage.deliveryStop`) vì request của Spec không mang mã điểm nào khác; `id` là `ZONE-<số điểm>`.
  **Vùng của một kiện là vùng chứa tâm kiện theo X** (`locateInZones`; tâm rơi vào đệm thuộc vùng gần hơn, đúng giữa thì vùng sâu hơn); kiện có
  vùng khác vùng của điểm giao mình là **một lần dỡ-xếp lại** (định nghĩa của backend; LIFO vẫn đếm riêng). Kết quả tối ưu có ba trường ngoài
  type Spec, khai ở `spec-contract.test.ts`: `result.stopZones`, `placement.stopZoneId`, `metrics.rehandlingCount` — vắng ở kết quả `FAILED`
  và kết quả dựng tay không chia vùng. Mock chia vùng theo thể tích các kiện **còn xếp được**. Khi `enforceLifo`, mock xếp theo vùng, điểm
  cuối trước (`packShelves`): kiện không vừa vùng của mình xếp nhờ vào đuôi còn trống của vùng sâu hơn liền kề, hoặc tràn sang đầu vùng kế phía
  cửa — hai chỗ duy nhất không đặt kiện sau lưng hàng giao muộn hơn, nên **kết quả `enforceLifo` không bao giờ có `LIFO_BLOCKED`** (test thuộc
  tính kiểm). Điểm cần nhiều sàn hơn vùng chia theo thể tích thì mock xếp lại với các dải lùi về phía vách trong, rồi một dải liền; lấy lượt
  xếp được nhiều kiện nhất, hoà thì lượt bám vùng hơn — **mock không bao giờ xếp ít kiện hơn khi chưa có vùng**. Không bật `enforceLifo` thì xếp
  theo thứ tự chọn, vùng chỉ dùng để đo. Duyệt (`approvedResult`) ghi lại `stopZoneId` và đếm lại `rehandlingCount` theo các vùng của lần tối ưu,
  không chia lại vùng.
- Kết quả là **revision bất biến** theo `jobId`. Duyệt tạo revision approved mới; sửa xe/kiện sau khi tối ưu làm revision lỗi thời và chặn Duyệt.
  Kho và tài xế chỉ đọc revision đã duyệt.
- **Ba phương án ứng viên mỗi lần chạy** (FE-5b-05, D-77). `OptimizationService.optimizeCandidates(request)` (ngoài Spec; `optimize(request)` của
  Spec giữ nguyên, một kết quả) chạy **một job** ra ba kết quả theo `PLAN_OBJECTIVES` của domain — `MAX_VOLUME` (A), `AXLE_BALANCE` (B),
  `MIN_REHANDLING` (C); nhãn suy từ mục tiêu (`PLAN_LABELS`), không lưu riêng. Mock thuần `runMockCandidates` (tất định theo request + seed;
  `jobId` của từng kết quả là mã job kèm nhãn, `MOCK-…-A`) dựng vài **cách xếp** trên cùng request (`candidate-layouts.ts`): *dồn sát*, *lùi về
  phía cửa* (`balancedCenterXCm`), *theo vùng điểm giao* (`packShelves`); mỗi mục tiêu lấy cách tốt nhất **theo chỉ số của chính nó** — A nhiều
  thể tích nhất; B, trong các cách xếp được nhiều kiện nhất, lệch mức dùng giữa hai nhóm trục ít nhất (`axleImbalance`); C, trong các cách xếp
  được nhiều kiện nhất, ít kiện nằm ngoài vùng điểm giao nhất. **Không mục tiêu nào đổi kiện lấy chỉ số**, và **mock không sửa số cho khác
  đi**: hai mục tiêu chọn trùng một cách xếp thì hai phương án giống hệt nhau và màn so sánh hiện đúng như vậy. Cả ba không có `LIFO_BLOCKED`
  khi `enforceLifo`. `runtimeMs` của từng phương án là thời gian kiểm request + lượt xếp của mục tiêu đó + phần domain tính cho nó. Ba phương
  án chạy trong **một worker** (`start-candidates`): tiến trình báo theo từng mục tiêu (`CandidateProgress`), huỷ hay hết giờ là bỏ cả ba, kho
  không lưu gì; cổng bench 1.000 instance ≤ 1 s áp cho cả job.
- **Kiện ghim và chạy lại giữ ghim** (FE-BL-02). `PackagePlacement.pinned?: true` (ngoài type Spec, khai ở `spec-contract.test.ts`) là ghim
  **lưu cùng phương án**: sống qua Duyệt và mở lại. `OptimizationRequest.pinnedPlacements?` (ngoài type Spec) mang các placement phải giữ nguyên
  vị trí và hướng; **vắng — không phải mảng rỗng — khi không giữ kiện nào** (`mockJobId` coi rỗng như vắng, nên request cũ giữ nguyên mã job và
  kết quả). Bộ ghim phải đứng vững một mình (`pinnedIssues` ở `@/domain/constraints`): kiện không thuộc chuyến (`PINNED_INSTANCE_UNKNOWN`), trùng
  mã, ra ngoài thùng (`EXCEEDS_BOUNDARY`), chồng lấn (`OVERLAP`), đè vật cản, lơ lửng (`SUPPORT_BELOW_MIN`, cảnh báo ở phương án nhưng là lỗi ở
  đây vì chỗ đỡ không được xếp lại), vượt tải trục hay tải trọng (`PAYLOAD_EXCEEDED`) — trả issue mã + tham số, không sửa ngầm; `preflight`
  thấy lỗi thì kết quả `FAILED`. Mock coi kiện ghim là **hộp cố định** (`FixedCargo` của `shelf-walls.ts`): vật cản cho việc tìm chỗ, nhưng
  khối lượng, trọng tâm, tải trục, vùng điểm giao, LIFO và số dỡ-xếp lại tính như mọi kiện; placement của chúng đứng đầu kết quả với `pinned:
  true`; kiện không vừa quanh chúng ở lại với lý do như thường. **Kho**: ghim lưu qua Duyệt — `approveRevision(id, patches, { force, pinned })`,
  `pinned` là mã các kiện ghim của bản duyệt, **thay hẳn** tập ghim của revision nguồn (vắng thì giữ; mã lạ là `PATCH_UNKNOWN_INSTANCE`); ghim
  không phải chỉnh tay (`manuallyEdited`) và không đổi vị trí kiện nào. `saveOptimizationRun` tự kiểm bộ ghim của request (`PINNED_SET_INVALID`,
  trước khi giữ credit, không lưu gì) và ghi `OptimizationRun.pinnedCount`; lần chạy giữ ghim vẫn là một lần chạy ba phương án, một credit, một
  sự kiện `optimization.saved`. **Kiện hỏng lúc xếp** làm chuyến về Đã lập kế hoạch (`db-replan.ts`) thì `Trip.replan.keep` giữ chỗ của các kiện
  kho đã xếp lên xe (`keptLoaded`, mã theo dòng kiện hiện tại: dòng của kiện hỏng bớt một nên mã đánh số lại, kiện cùng dòng giống hệt nhau nên
  kiện đã xếp thứ i nhận mã thứ i); có kiện đã xếp tựa lên kiện hỏng thì không giữ được — `replan.blocked` là các kiện đó, `keep` vắng. Kho
  chưa dùng `keep` để bỏ bước quét lại của kho: phiên xếp mới vẫn quét từng kiện.
- **Lần chạy và revision của nó** (FE-5b-05). `saveOptimizationRun({ tripId, request, jobId, plans })` lưu mỗi phương án một revision bất biến
  mang `runId` và `run: { objective, algorithm }` (bản duyệt giữ của bản nguồn), theo thứ tự A · B · C — bản mới nhất chưa duyệt của chuyến là
  phương án C — cùng **một** lần chạy `OptimizationRun { algorithm, jobId, plans[] }` và **một** sự kiện `optimization.saved { runId, revisionId }`.
  Chỉ khi chuyến **Đã lập kế hoạch**: còn Nháp là `ROUTE_NOT_PLANNED`, đã sang pha vận hành là `TRIP_LOCKED`; `trip-readiness` có `ROUTE_PLANNED`,
  và Thiết lập tối ưu có nhóm kiểm tra "Tuyến" (lý do nằm trên nút Tối ưu, kèm lối về Chi tiết chuyến). `addRevision` giữ lối ghi **một** kết
  quả dựng tay (test, dữ liệu mẫu) — một lần chạy một phương án, không kiểm chuyến đã lập kế hoạch. Thuật toán kho ghi là `EP_DBLF`
  (`OPTIMIZATION_ALGORITHMS`), lần chạy hỏng chỉ mang thuật toán và mã lý do. Lớp API `runOptimization` (`optimization-api.ts`) trả `{ run,
  revisions }`; chạy xong màn mở `/chuyen/:id/so-sanh?lan-chay=<runId>`. Hộp thoại đang chạy có một dòng tiến trình cho mỗi phương án; "Kết quả
  một phần" chỉ báo khi **không phương án nào** xếp hết, kèm số kiện chưa xếp của phương án xếp được nhiều nhất. Bảng lần chạy
  (`RunHistoryCard`): mỗi lần chạy ba dòng phương án (mở Planner), liên kết "So sánh", và cột Duyệt nói phương án nào đã duyệt; lần chạy "chờ
  duyệt" là lần chạy chứa revision mới nhất chưa duyệt, không lỗi thời. Thẻ Tiến trình của Chi tiết chuyến tìm người chạy tối ưu theo `runId`
  của sự kiện.
- **Kho tự kiểm luật duyệt** — không tin giao diện (FE-5b-08, D-80). `approveRevision(revisionId, patches, { force })` áp draft (`approvedResult`)
  rồi chạy constraint engine trên **chính bản sẽ duyệt** (`approvalIssues` ở `revisions.ts` → `approvalBlockers` của domain): còn lỗi ràng buộc,
  `AXLE_OVERLOAD` hoặc `MUST_LOAD_UNPLACED` là `APPROVAL_BLOCKED { revisionId, count, codes }`; lỗi thời là `REVISION_STALE`. Qua được các lý do
  chặn, tuyến của chuyến (`Trip.routePlan`) có điểm `MISSED` mà không có `force` là `LATE_STOPS_UNCONFIRMED { tripId, stopIds, stopNumbers }`.
  **`force` chỉ là lời xác nhận cho điểm trễ hạn**: không gỡ được lý do chặn nào; có `force` thì sự kiện `revision.approved` ghi thêm `lateStops`.
  Điểm `AT_RISK` không đòi gì. Không lưu gì khi từ chối. Lớp API: `approveLoadPlan(revisionId, patches, { force })` ở `viewer3d/viewer-api.ts`.
- **Đổi xe của chuyến Đã lập kế hoạch** (FE-5b-08, D-80). Hàm thuần `vehicleFit(xe, dòng kiện)` (`domain/constraints/vehicle-fit.ts`) trả mã + tham
  số, chỉ kiểm **điều kiện cần** trên tổng hàng (không xếp thử): `CARGO_TOO_LARGE` (dòng kiện không có hướng đặt nào vừa lọt cửa kèm clearance
  vừa nằm trong lòng thùng), `CARGO_VOLUME_EXCEEDED`, `CARGO_WEIGHT_EXCEEDED`, `AXLE_CAPACITY_EXCEEDED` (tổng hàng nặng hơn phần hai nhóm trục
  còn nhận được: giới hạn − tải rỗng; xe chưa khai trục hoặc một nhóm chưa có giới hạn thì không kiểm) là **lỗi**; loại hàng là **cảnh báo** của
  luật phân tách hàng (`REFRIGERATION_MISSING`, `HAZARDOUS_VEHICLE_REQUIRED` — hiện ở dòng xe, không khoá xe). Kho: `changeTripVehicle(tripId,
  vehicleId)` (`db-trip-vehicle.ts`) từ chối theo thứ tự — chuyến đã sang pha vận hành `TRIP_LOCKED`, còn Nháp `TRIP_NOT_PLANNED`, xe của công ty
  khác `FORBIDDEN_COMPANY`, trùng xe đang dùng `VEHICLE_UNCHANGED`, đang bảo dưỡng `VEHICLE_IN_MAINTENANCE`, đang chạy chuyến khác `VEHICLE_BUSY
  { vehicleId, tripId }`, có lỗi `vehicleFit` (trên xe đã ghép giới hạn của loại xe) `VEHICLE_UNFIT { vehicleId, reasons }`. Đổi xong
  `inputVersion` tăng — **mọi phương án của chuyến lỗi thời**, bản đã duyệt cũng phải tối ưu lại rồi duyệt; điểm giao không đổi nên `routePlan`
  và trạng thái Đã lập kế hoạch giữ nguyên. Nhật ký `trip.vehicleChanged { fields: 'vehicleId', before, after }` — mang `fields` như
  `trip.updated` để thanh lỗi thời (`staleReason`) đọc được lần đổi xe. Lớp API `trips/trip-vehicle-api.ts` (`changeTripVehicle`,
  `fetchVehicleChoices` — mọi xe kèm trạng thái và `vehicleFit`) → `useTripVehicleQuery.ts`, khoá `['trips', tripId, 'vehicle-choices']`
  (`staleTime: 0`); đổi xe làm mới `['trips', tripId]`, `['trips', 'list']`, `['dashboard']`, `['warehouse']`. UI: `ChangeVehicleDialog` theo
  `trips.edit` — mở từ mục "Phương tiện" và menu "Thao tác" của Chi tiết chuyến, và từ góc khung 3D của Planner (mục 7); mọi xe của công ty hiện
  kèm chip trạng thái, xe chọn được đứng trước, xe không chọn được **mờ kèm lý do ngay tại dòng** (xe đang dùng, đang phục vụ chuyến nào, bảo
  dưỡng, từng lỗi `vehicleFit` — nối vào ô chọn bằng `aria-describedby`); hộp thoại nói trước việc phương án sẽ lỗi thời. Chuyến **Nháp** vẫn
  đổi xe ở form sửa chuyến ("Đổi xe" của mục Phương tiện là liên kết tới form) — `updateTrip({ vehicleId })` chưa kiểm `vehicleFit`.
- Chi tiết chuyến chỉ cho sửa khi `can('trips.edit') && phase === 'planning'` (LM-088); form sửa chuyến mở ở `planning`, `loading`, `loaded` (hai
  pha sau khoá xe và điểm giao). Lý do khoá hiện bằng `TripLockBanner` (chi tiết chuyến, Thiết lập tối ưu). Hộp thoại mở từ mục `DropdownMenu`
  dùng `modal={false}` cho menu để focus về đúng hộp thoại.
- **Pha và trạng thái chuyến** (LM-081 → LM-083, FE-0-05, FE-4b-09, D-81). Kho lưu **pha** chuyến `planning → loading → loaded → delivering →
  completed` (+ `cancelled`); `TripStatus` là 6 trạng thái của backend: `DRAFT`, `PLANNED`, `LOADING` (pha `loading`/`loaded`), `IN_TRANSIT`
  (`delivering`), `DELIVERED` (`completed`), `CANCELLED`. Pha `planning`: chuyến **đã tối ưu tuyến** (`Trip.routePlan`) là `PLANNED`, chưa là
  `DRAFT` — `tripStatus(trip)` không đọc revision. `optimizeTripRoute` (`db-trip-route.ts`, mock `@/domain/routing`, không tốn credit) cần ít
  nhất một điểm (`ROUTE_STOPS_REQUIRED`) và mọi điểm có toạ độ (`MISSING_STOP_COORDINATES { stopIds, stopNumbers }` — chỉ đúng điểm thiếu), xếp
  lại `Trip.stops` theo thứ tự đi và đánh số lại `deliveryStop` của dòng kiện (thứ tự đổi thì `inputVersion` tăng — phương án 3D lỗi thời), ghi
  `routePlan` (giờ đến dự kiến và mức hạn từng điểm theo đúng thứ tự `Trip.stops`, điểm trễ, km, phút, người và giờ bấm, `isMockResult`) và nhật
  ký `trip.routeOptimized`. Sau đó mọi lần ghi chuyến đi qua `withFreshRoute` (`trip-route.ts`, thuần): **thêm hoặc bớt điểm** (kể cả điểm tự sinh
  khi đưa yêu cầu vào chuyến, điểm tay của kiện kho kiện) hoặc một điểm mất toạ độ thì kho bỏ `routePlan` — chuyến **về Nháp**; đổi thứ tự điểm
  (kéo thả), giờ xuất phát, kho đi, hạn của điểm thì giờ đến và mức hạn tính lại, trạng thái không đổi. `getTripEta` đọc tuyến (`null` khi chưa
  tối ưu). Tối ưu xếp hàng đòi chuyến Đã lập kế hoạch (`saveOptimizationRun` → `ROUTE_NOT_PLANNED`); bắt đầu xếp ở kho thì kho chưa đòi. Lớp API
  `trips/route-api.ts` (`optimizeTripRoute`, `getTripEta`) → `useRouteQuery.ts` (khoá `['trips', tripId, 'eta']`); Chi tiết chuyến: `RoutePlanBar`
  đầu card sơ đồ tuyến (nút phụ "Tối ưu tuyến" theo `routes.optimize`, MOCK RESULT, km · thời gian, số điểm trễ; câu nói giờ đến là ước lượng theo
  đường nối thẳng), mỗi điểm có "Dự kiến đến" và mức hạn (Kịp hạn xanh lá · Sát hạn hổ phách · Trễ hạn dự kiến đỏ, luôn kèm chữ), điểm chưa có
  toạ độ mang nhãn "Chưa có toạ độ", bản đồ `RouteMap` dưới hàng điểm. Dòng phụ `tripSubStatus`, hiện bằng `TripSubStatusTag`: dưới `PLANNED` (và
  dưới `DRAFT` của chuyến đã có phương án mà chưa / không còn tuyến) là `awaitingApproval` · `approved` · `stale` (theo revision hiển thị: bản
  duyệt mới nhất, không có thì bản mới nhất), dưới `LOADING` là `loading` đã ghi / tổng · `loaded`; `tripRouteSubStatus` thêm `lateStops` khi
  tuyến có điểm trễ hạn dự kiến. Lọc/nhóm theo trạng thái; logic kho, tài xế và số "cần bạn xử lý" theo pha hoặc dòng phụ. Tab danh sách chuyến: Tất cả + sáu trạng thái (tab Đã lập kế hoạch có thêm số hổ phách: chờ duyệt + lỗi thời; chữ và số "cần bạn xử lý" — ở dòng số dưới tiêu đề và trên tab — chỉ hiện với người có `plans.approve`, quản lý công ty chỉ thấy các số thường); `trang-thai`
  trên URL là slug không dấu (`nhap`, `da-lap-ke-hoach`, `dang-xep-hang`, `dang-van-chuyen`, `da-giao`, `da-huy`), giá trị cũ đọc sang slug mới
  (`normalizeStatusFilter`). Từ `loading` trở đi xe/điểm giao/kiện, tối ưu và Duyệt bị từ chối `TRIP_LOCKED`. Tiến độ kho (`loading.steps`) và
  giao (`delivery.stops`, `issues`) chỉ ghi qua hàm vận hành của kho (`startLoading`…`completeStop`). Bảo dưỡng xe lưu ngoài `VehicleConfig`
  (`listVehicleStates`, D-04).
- Người dùng và mật khẩu nằm trong kho; kho giữ **phiên** như cookie server (`authenticate`, `restoreSession`) và mọi hàm ghi thêm một sự kiện nhật
  ký `{ action, actorId, companyId, target, params }` — không lưu câu chữ, UI dịch nhánh `audit`. Lỗi của kho (`MockDbError`) hiện cho người
  dùng qua `dataErrorMessage(error, t)` (nhánh `dataErrors`, key trùng mã).
- **Seed** neo theo ngày (D-44): `getMockDb()` neo hôm nay giờ Việt Nam, dưới Vitest và `createMockDb()` mặc định neo `SEED_ANCHOR_DATE`
  (14/09/2026) để test tất định. Chuyến chính `TRIP-2026-0914` luôn đứng đầu `listTrips` và giữ `REV-001`/`REV-002`; test so số của seed (tổng
  kiện, số xe…) phải cập nhật khi đổi `seed-trips.ts`. Dữ liệu của Phương Nam (`seed-phuong-nam.ts`) nối **sau** dữ liệu của Long Bình và mang mã
  `…-PN-…`: thứ tự, mã và mã kế tiếp (`TRIP-015`, `VEHICLE-009`, `REV-028`, `RUN-016`, `PK-0089`) của Long Bình không đổi; test đọc kho không
  phiên thấy cả hai công ty. Kiện của chuyến seed dựng bằng cách chạy lại các mốc của chuyến qua chính hàm của kho (`seed-trip-pool.ts`), mã
  `PK-T…` / `PK-PN-T…` (`nextId` không tính), đứng **trước** kiện có từ trước nên bảng kho kiện vẫn mở đầu bằng `PK-0088`. Mỗi chuyến seed đã
  tối ưu có **một lần chạy ba phương án** (`seed-plan.ts` chạy `runMockCandidates`): phương án ít dỡ-xếp lại (C) — bản điều phối viên seed duyệt —
  giữ **mã số** (`REV-001`), hai phương án kia mang mã kèm nhãn (`REV-001-A`, `REV-001-B`; Phương Nam `REV-PN-001-A`…), dạng mà `nextId` không
  tính; thứ tự ghi A, B, C rồi bản duyệt (`listRevisions` của chuyến chính: `REV-001-A`, `REV-001-B`, `REV-001`, `REV-002`). Mọi chuyến đã có
  phương án (và chuyến huỷ có đủ toạ độ) có `routePlan` theo đúng thứ tự điểm của seed, không ghi sự kiện; hai chuyến nháp và chuyến huỷ
  `TRIP-004` (điểm Tân An chưa có toạ độ) thì không. **Trục của xe mẫu là số ước lượng theo cỡ xe, chưa đối chiếu thông số nhà sản xuất**
  (`twoAxles` ở `seed-vehicles.ts`; "Truck 6m" của Spec không khai): trục trước ở −100 cm, trục sau giữa hốc bánh; xe chở đủ tải dàn đều
  thùng không vượt trục nào; loại xe seed lấy giới hạn trục từ đó (`axleLimitsFromAxles`); thay số thật ở trang xe là đủ, không sửa code. Mở
  app sớm hơn việc "hôm nay" muộn nhất của seed thì mọi mốc giờ seed lùi cùng một khoảng (`seed-shift.ts`): lịch sử không có sự kiện ở tương
  lai, sự kiện mới luôn nằm trên sự kiện seed; ngày chạy không đổi. Khách của danh bạ seed (`seed-directory.ts`) có toạ độ mẫu gần đúng ở mức
  khu vực — trừ Điện máy Xanh Tân An, để chuyến nháp `TRIP-014` giữ một điểm chưa có toạ độ.
- **Đồng hồ của kho là đồng hồ mô phỏng** (FE-6-08, D-85; `clock.ts`: `createSimClock`): mọi mốc giờ kho ghi (`ctx.nowIso`) và vị trí xe đọc
  cùng một đồng hồ. Nó bắt đầu **đúng giờ máy** lúc tạo kho — seed neo và `seed-shift.ts` không đổi — rồi chạy nhanh `speed` lần; `getMockDb()`
  đọc `?toc-do=<n>` (`clockSpeedFrom`, tối đa 3.600) **một lần lúc tải trang**. Ở tốc độ 1 (không có tham số, mọi test, cả Vitest) đồng hồ trả
  thẳng giờ của `now` được tiêm: test giả `Date` hay tiêm `now` thấy đúng giờ mình đặt; test tua nhanh truyền `createMockDb({ now, speed })`.
  `setSpeed` đổi tốc độ mà giờ không nhảy. Khi tua nhanh, giờ của kho đi trước giờ máy: chỗ nào ở giao diện so mốc của kho với `new Date()`
  ("hôm nay" của bảng điều khiển, chuông) sẽ lệch — chỉ là chế độ demo.
- **Vị trí xe và ETA trực tiếp** (FE-6-08, FE-6-09; `db-tracking.ts`, hàm thuần `trip-tracking.ts`, kiểu ở `tracking-model.ts`;
  `postDriverLocation`, `getLatestLocation`, `getLocationHistory`, `getTripMonitoring`, `listTripMonitoring`). Kho **không chạy hẹn giờ nào**: mỗi
  lần được đọc, nó ghi bù các điểm vị trí mô phỏng từ điểm đã ghi tới giờ của kho — một điểm mỗi 30 giây mô phỏng kể từ lúc tài xế xuất phát, mỗi
  điểm tính **như lúc đó** nên kết quả không phụ thuộc lúc nào có người đọc; lịch sử giữ 2.000 điểm gần nhất mỗi chuyến (`DbState.tracking`, seed
  để trống — chuyến seed đang chạy đứng theo tiến độ giao của nó ở giờ hiện tại). Xe mô phỏng (`@/domain/routing` `simulateVehicle`): mỗi chặng nối
  thẳng mất đúng thời gian của công thức D-76 (xe chạy 50 km/h trên quãng đường × 1,3), sự cố làm xe đứng thêm đúng số phút chậm (tham số
  `delays`), "Đã đến" (`StopProgress.arrivedAt`) đặt xe tại điểm, và xe **chờ ở điểm chưa hoàn tất** tới khi tài xế hoàn tất điểm (tuyến đưa vào
  mô phỏng cắt tại điểm đó; 15 phút dừng mỗi điểm chỉ còn trong lịch thuần và trong ETA). Sau mỗi điểm vị trí, `liveEta` tính lại giờ đến các
  điểm chưa xong **từ vị trí** — không cộng phút chậm lần hai; mức hạn của một điểm **xấu đi** (kịp → sát → trễ) thì kho ghi một sự kiện hệ
  thống `delivery.etaRisk` (`ctx.logSystem`: người làm `null`, công ty của chuyến), một lần cho mỗi lần chuyển; mức khởi đầu là mức của
  `routePlan`, tốt lên thì không báo. Điểm GPS thật (`postDriverLocation`, nguồn `GPS`) tính ETA cùng cách và giữ xe mô phỏng không ghi trong 90
  giây kể từ điểm GPS cuối. **"Dùng GPS thật"** (FE-6-13, D-95) là công tắc trên màn điểm giao của tài xế khi chuyến Đang vận chuyển
  (`driver/DriverGpsToggle` + `useDeviceLocation`): `navigator.geolocation.watchPosition`, điểm đầu gửi ngay rồi vị trí mới nhất mỗi 30 giây qua
  `postDriverLocation`; `setDriverGps(tripId, bật)` của kho cho đồng hồ mô phỏng chạy theo giờ thật khi bật (giờ không nhảy) và, khi tắt, cho xe
  mô phỏng ghi tiếp ngay từ nhịp kế rồi trả đồng hồ về tốc độ `?toc-do`. Tài xế tắt, trình duyệt từ chối quyền, mất tín hiệu, kho từ chối điểm,
  hoặc rời màn chuyến: thôi theo dõi, về mô phỏng, màn nói lý do; thiết bị không có định vị thì công tắc mờ kèm lý do. Màn nói rõ khi chưa có
  máy chủ vị trí chỉ hiện trong trình duyệt này. Test giả `navigator.geolocation` (`DriverGpsToggle.dom.test.tsx`); E2E dùng
  `context.setGeolocation`. Vị trí nào hiện ra cũng kèm nhãn nguồn ("Mô phỏng" / "GPS"), giờ đến tính từ vị trí mang **MOCK RESULT**. Màn đọc
  lại theo `refreshMs` kho trả (thời gian thật tới điểm kế tiếp, ít nhất 1 giây; `null` khi chuyến không còn chạy) bằng `refetchInterval` của
  Query (`useTripMonitoringQuery` `['trips', tripId, 'monitoring']`, `useFleetMonitoringQuery` `['trips', 'monitoring']`) — không `setInterval`
  riêng, gỡ màn là hết nhịp, không chuyến nào đang chạy thì không có nhịp. Ở Chi tiết chuyến chỉ `TripRouteCard` vẽ lại theo nhịp đó. E2E có
  giá trị đang chạy chờ tới trạng thái dừng (xe tới điểm), không chờ theo giờ (`e2e/live-tracking.spec.ts`).
- **Giờ nghỉ bắt buộc trong ETA** (FE-BL-04). `ROUTING_CONSTANTS` có `MAX_CONTINUOUS_DRIVING_MINUTES` (240) và `REST_MINUTES` (15) — **đề xuất FE chờ
  nghiệp vụ xác nhận** (PRD v2 mục 17.2); giới hạn lái theo ngày, theo tuần **chưa mô hình hoá**. Một chỗ tính duy nhất: `legWithRests(thời gian
  chạy, bộ đếm lái liên tục)` chia chặng thành các đoạn lái xen nghỉ (đủ giờ lái ngay tại đích thì không nghỉ); dừng ở một điểm từ `REST_MINUTES`
  trở lên đặt lại bộ đếm (`drivenAfterStop`). `routeEta` (và `routePlan`) cộng giờ nghỉ vào ETA và `totalMinutes`, thêm `restCount` /
  `restMinutes` **chỉ khi có nghỉ** (`TripRoutePlan` cũng vậy) — `RoutePlanBar` nói "đã gồm n lần nghỉ bắt buộc (x)" cạnh dòng km · thời gian. Xe
  mô phỏng đứng nghỉ đúng giờ ETA đã cộng (không phải sự cố, không cộng vào `delays`, không cảnh báo) và trả `drivenMs` + `restEndsAt`; `liveEta`
  nhận hai giá trị đó nên ETA từ vị trí khớp ETA kế hoạch (GPS thật không có: coi như vừa nghỉ). Thứ tự điểm của `sequenceStops` vẫn tính theo
  thời gian chạy thuần (heuristic). Có BE thì ETA lấy từ Goong theo giao thông và thay công thức mock.
- **Đổi thứ tự điểm giao khi xe đang chạy** (FE-BL-03, D-87). `reorderRunningStops(tripId, orderedStopIds)` (`db-trip-reorder.ts`) là **ngoại lệ thứ
  hai của `TRIP_LOCKED`** cho chuyến đã rời kho (thứ nhất: nhận hàng dọc đường), hẹp: một hàm, chỉ điều phối viên (`ROLE_NOT_ALLOWED`), chuyến
  phải Đang vận chuyển (`TRIP_PHASE_INVALID`), mọi điểm có toạ độ (`MISSING_STOP_COORDINATES`); `updateTrip`, `changeTripVehicle`… vẫn từ chối.
  Luật thứ tự thuần ở `checkProposedOrder`: phải là hoán vị **khác** thứ tự hiện tại (`STOP_ORDER_INVALID`); các điểm đầu danh sách đã hoàn tất,
  và điểm xe đã tới (`StopProgress.arrivedAt`) đứng nguyên (`STOP_NOT_MOVABLE`); điểm nhận dọc đường của yêu cầu `APPROVED` đứng trước điểm
  giao của nó (`PICKUP_AFTER_DELIVERY`). **Khả năng dỡ**: kho chạy `checkStopReorder` (`lifoIssues` của domain, thứ hạng giao thay số điểm) trên
  kiện còn phải dỡ — kiện phương án đã xếp chưa dỡ, không bị bỏ lại kho, không thuộc điểm đã hoàn tất, cộng kiện nhận dọc đường đã có chỗ
  (`PickupRequest.layout`) chưa giao — ở thứ tự cũ và mới; kiện bị che **kín** theo thứ tự mới mà trước đó chưa bị là `STOP_ORDER_BLOCKS_CARGO
  { packages, stopIds }` (song song, kiện thứ i thuộc điểm thứ i) và không đổi gì; che một phần chỉ trả ở `partial` (toast cảnh báo). Đạt thì
  áp dụng bằng đúng bộ máy đánh số lại của nhận hàng dọc đường (`renumberTripStops`, `DeliveryStop.planNumber`): `inputVersion` giữ nguyên nên
  phương án đã duyệt không lỗi thời, `routePlan` giữ và tính lại giờ đến, mức hạn. Xe mô phỏng đi tiếp **từ điểm vị trí gần nhất** tới điểm kế
  tiếp mới (`DeliveryProgress.redirect` → `SimulatedStop.startFrom`; điểm vị trí đã ghi theo thứ tự cũ được ghi bù trước khi đổi; đang nghỉ bắt
  buộc thì đi tiếp sau khi nghỉ xong). Nhật ký `trip.stopsReordered { count, lateStops, driverId }` — chuông của tài xế **của chuyến đó**; màn
  tài xế đọc thứ tự mới từ `Trip.stops`. Màn: nút phụ "Đổi thứ tự điểm" ở đầu thẻ chuyến trên `/giam-sat` theo quyền `routes.optimize` (không
  thêm quyền mới; mờ kèm lý do khi dưới hai điểm chưa giao và chưa tới) mở `ReorderStopsDialog`: nút lên / xuống cho điểm tự do, điểm khoá hiện
  "Đã giao xong" / "Xe đã tới"; bị từ chối vì kiện thì hộp liệt kê từng kiện kèm điểm của nó bằng chữ. Chưa có ở BE (`monitoring-api.ts`).
- **Màn Giám sát `/giam-sat`** (FE-6-10; `monitoring.view`): `fetchMonitoringBoard` (`['trips', 'monitoring-board']`) đọc phần ít đổi — chuyến Đang
  vận chuyển, xe, tài xế, điểm giao, tên người dùng; vị trí, ETA và sự cố đi theo nhịp của `useFleetMonitoringQuery`. **Chỉ thành phần con đọc
  theo nhịp** (`MonitoringBoard`, `EscalationTab`, số trên tab, `BoardSync`): dải tiêu đề không vẽ lại theo từng điểm vị trí; dòng danh sách là
  `memo`, và `RouteMap` giữ mốc theo khoá — xe chạy chỉ dời mốc của nó (`setLngLat`), không dựng lại mốc kho và điểm giao. Bản đồ vẽ xe của
  **mọi** chuyến đang chạy (`RouteMap` `others`, mốc kèm nhãn "mã chuyến · nguồn vị trí"), còn tuyến, kho và điểm giao là của chuyến đang chọn;
  danh sách cạnh nó là bản thay thế bản đồ cho trình đọc màn hình. Tab, chuyến đang chọn và hai công tắc lọc nằm trên URL
  (`tab=su-co-can-xu-ly`, `chuyen`, `nguy-co-tre`, `co-su-co`). `subscribeTrip` (`monitoring-api.ts` → `monitoring-events.ts`) là kênh sự kiện
  **trong bộ nhớ** thay WebSocket của backend: sự kiện (`LocationUpdate`, `EtaUpdate`, `EtaRiskAlert`, `ExceptionUpdate`, `TripCompleted`) phát khi
  một lần đọc giám sát trả về điều gì mới; lịch sử vị trí của chuyến đang chọn làm mới theo kênh đó (`useTripChannel`), không có hẹn giờ riêng.
  `TripMonitoring` mang thêm `exceptions` và `reroute`.
- **Sự cố cấp chuyến** (FE-6-11, FE-6-12, D-87; `exception-model.ts`, `db-exceptions.ts`, `DbState.exceptions`; khác sự cố giao của từng kiện):
  `TripException` (`EXC-NNN`) — loại (`TRAFFIC`, `ACCIDENT`, `ROAD_CONSTRUCTION`, `VEHICLE_BREAKDOWN`, `OTHER`; nhãn ở `common.tripExceptionTypes`),
  mô tả, số phút dự kiến chậm (0 → 480), trạng thái `OPEN` → `ESCALATED` → `RESOLVED`. Kho **xét vai trò của phiên** cho các lệnh ghi (không có
  phiên thì không xét; sai là `ROLE_NOT_ALLOWED`, xét sau công ty): `reportTripException` — điều phối viên hoặc tài xế của chính chuyến, chuyến phải
  Đang vận chuyển; `escalateTripException`, `resolveTripException`, `requestReroute`, `confirmReroute` — điều phối viên; `renegotiateDeadline` —
  quản lý công ty. Mỗi sự cố thêm một khoảng giữ xe mô phỏng (`TripIncidents.holds` → tham số `delays` của `simulatedSnapshot`): xe đứng thêm
  **đúng số phút chậm**, ETA tự dời theo vị trí — không cộng lần hai. Sự cố `OPEN` quá 30 phút theo đồng hồ của kho thì kho tự chuyển quản lý ở lần
  đọc kế tiếp (`advanceTracking`, sự kiện hệ thống `exception.escalated`, ghi đúng mốc 30 phút). **Tuyến thay thế** (`@/domain/routing`
  `rerouteOptions`, mock — hằng số ở `REROUTE_CONSTANTS`, chờ nghiệp vụ xác nhận): 2–3 đường tới **điểm kế tiếp** từ vị trí xe (đường tránh +15 %,
  vành đai +30 %, cao tốc +50 % ở 70 km/h khi chặng còn từ 15 km), mang MOCK RESULT; chọn một thì khoảng giữ đang chạy bị cắt và xe đứng thêm phần
  đường vòng chậm hơn đường nối thẳng (`delaysAfterReroute`), nhật ký `trip.rerouted`. **Chọn tuyến khác không đổi thứ tự điểm giao** (thứ tự chỉ
  đổi qua `reorderRunningStops`) và đường vẽ vẫn nối thẳng. **Gia hạn**: trên sự cố `ESCALATED`, quản lý ghi đã liên hệ khách (bắt buộc) và nhập
  hạn mới cho một yêu cầu giao của chuyến — phải sau giờ của kho (`REQUIREMENT_DEADLINE_PAST`); hạn của điểm giao và mức hạn tính lại ngay
  (`refreshLiveEta`), sự cố giữ `ESCALATED` tới khi điều phối viên đánh dấu đã xử lý. Mã lỗi: `EXCEPTION_INVALID`, `EXCEPTION_STATUS_INVALID`,
  `REROUTE_UNAVAILABLE`; nhật ký nhóm `exception` (`reported`, `escalated`, `resolved`, `deadlineRenegotiated`). Lệnh ghi của màn làm mới
  `['trips']`, `['notifications']`, `['requirements']`, `['dashboard']`. E2E `e2e/monitoring.spec.ts` đi cả luồng trên một tab với `?toc-do=60`.
- **Yêu cầu nhận dọc đường** (FE-7-01, D-88; `pickup-model.ts`, `db-pickups.ts`, `DbState.pickups`): `PickupRequest` (`PKR-NNN`, Phương Nam
  `PKR-PN-NNN`) mang `companyId` của chuyến, `tripId`, điểm nhận và điểm giao (`PickupPoint`: tên, địa chỉ, toạ độ), `deadline?`, `packages`
  (`PickupPackage`: mã của bên gửi, cm, kg, loại hàng), `status`, `validationResults` (kết quả `evaluatePickup`, rỗng khi chưa kiểm),
  `overrideReason?`, người và lúc tạo, `approvedBy` / `approvedAt` từ lúc `APPROVED`. Trạng thái **ghi thật**, chỉ `updatePickupStatus` đổi, theo
  bảng `PICKUP_TRANSITIONS`: `PENDING → VALIDATED | REJECTED | APPROVED` (duyệt kèm lý do vượt luật), `VALIDATED → APPROVED | REJECTED`, `APPROVED →
  LOADED → DELIVERED`, `REJECTED` là trạng thái cuối; sai bảng là `INVALID_PICKUP_STATUS_TRANSITION`. Hàm của kho đều nhận mã chuyến và lọc công
  ty qua chuyến như endpoint `/api/trips/{id}/pickup-requests` của backend: `listPickupRequests`, `getPickupRequest`, `createPickupRequest`,
  `updatePickupStatus(tripId, pickupId, status, details?)`, `validatePickupRequest`, `approvePickupRequest`, `rejectPickupRequest`.
  `DeliveryStop.kind` (`DELIVERY | PICKUP`) vắng nghĩa là `DELIVERY` (`stopKindOf`).
- **Mười luật nhận hàng dọc đường** (FE-7-02, D-88; `@/domain/pickup`, thuần): `evaluatePickup(context)` trả đúng 10 kết quả `{ rule, passed, code,
  params }` theo thứ tự luật 1 → 10, luôn đánh giá đủ cả mười (luật trước không đạt không bỏ qua luật sau); mã `PICKUP_*` ở `PICKUP_RULE_CODES`,
  UI dịch từng mã. `context` là mọi thứ luật cần — yêu cầu (`request`: điểm nhận, điểm giao, hạn, kiện), `vehicle`, vị trí xe `position` và giờ kho
  `at`, `stops` (mọi điểm của chuyến theo thứ tự tuyến: `completed`, `onboardCount`, `arrivedAt`, `number` khớp `StopZone.stopId`), `zones` của
  phương án đã duyệt, `onboard` (kiện còn trên xe: hộp đã xếp + khối lượng), `tripCargo` (dòng kiện của chuyến), `overrideReason` và `packing`
  (kết quả xếp thật, bên dưới) — để kho dựng từ chuyến, phương án đã duyệt, vị trí xe và tiến độ giao. **Điểm hiện tại** là điểm đầu tiên chưa hoàn
  tất; **điểm được bảo vệ** là điểm đầu tiên sau nó còn `onboardCount` > 0. Luật 1: khoảng cách từ điểm nhận tới đường gấp khúc vị trí xe → các
  điểm chưa hoàn tất ≤ 10 km (đúng 10 km vẫn đạt) và không nằm sau vị trí xe. Luật 2: tiến độ của điểm giao dọc đường từ điểm hiện tại phải > 0 và
  không quá tiến độ của điểm được bảo vệ (trùng vẫn đạt); không có điểm được bảo vệ thì chỉ cần sau điểm hiện tại; điểm hiện tại là điểm cuối
  của tuyến thì luật 2 đạt với mọi điểm giao. Luật 3 đạt khi tổng kiện còn trên xe + kiện nhận ≤ tải trọng (đúng bằng vẫn đạt). Luật 8 dùng
  `addedConflicts` của `domain/constraints/segregation`: kiện nhận khác loại đang khoá thì không đạt, trừ khi chuyến đã có lý do vượt luật. Luật 9:
  ETA tới điểm giao từ `liveEta` trên tuyến **sau khi chèn**, đạt khi không `MISSED` (đúng hạn vẫn đạt); yêu cầu không có hạn thì
  `PICKUP_NO_DEADLINE`. **Luật 4–7 và 10 đọc kết quả xếp thật** (`context.packing`, FE-BL-01): 4 = mọi kiện nhận có chỗ trong vùng đã trống (kiện
  chỉ ở lại vì phải đè lên kiện không chịu tải thuộc luật 7), 5 = tải trục `checkAxleLoads` của khối hàng sau khi nhận, 6 = trọng tâm
  `checkCenterOfGravity` của khối đó, 7 = không issue xếp chồng của constraint engine trên kiện nhận và không kiện nào ở lại vì
  `STACKING_VIOLATION`, 10 = số kiện còn chở bị kiện nhận che kín mặt sau (`LIFO_BLOCKED`) bằng không; xe không khai trục thì luật 5 đạt với
  `PICKUP_AXLE_UNAVAILABLE`. Luật 6 chỉ tính **kiểu lệch trọng tâm mới xuất hiện sau khi nhận**: giữa chuyến hàng còn lại thường đã dồn về đầu
  thùng, kiểu lệch có từ trước là đạt với `PICKUP_COG_NOT_WORSE`. Hằng số (10 km, 50 m coi là cùng một điểm) ở `PICKUP_CONSTANTS`.
  `insertPickupStops(stops, { pickupStopId, deliveryStopId }, deliveryLocation)` đặt điểm nhận rồi điểm giao **ngay sau điểm hiện tại**, không đổi
  chỗ điểm cũ nào; điểm giao trùng một điểm có sẵn sau điểm hiện tại và không quá điểm được bảo vệ thì dùng lại (`deliveryReused`), không còn điểm
  chưa hoàn tất thì `null`.
- **Tạo yêu cầu nhận và kiểm luật** (FE-7-03, D-88). `createPickupRequest` xét vai trò như hàm sự cố cấp chuyến (kho không có phiên thì không xét):
  điều phối viên, hoặc tài xế **của chính chuyến**; khác là `ROLE_NOT_ALLOWED`, xét sau công ty; chuyến phải Đang vận chuyển (khác là
  `INVALID_TRIP_STATUS_TRANSITION`), không kiện nào là `PACKAGES_REQUIRED`, trường sai là `PICKUP_INVALID` kèm tên trường. Kho dựng ngữ cảnh
  mười luật từ chuyến (`pickup-context.ts`, chỉ đọc): xe kèm giới hạn của loại xe, vị trí xe lúc này (ghi bù `advanceTracking`), điểm của tuyến
  kèm `completed` / `onboardCount` / `arrivedAt` theo tiến độ giao, vùng và kiện còn trên xe của **phương án kho đã xếp** (`Trip.loading.revisionId`),
  dòng kiện và lý do vượt luật phân tách hàng; rồi chạy `evaluatePickup` **trước khi ghi**: đạt cả mười thì yêu cầu `VALIDATED`, không thì
  `PENDING` kèm `validationResults`; chuyến còn điểm chưa có toạ độ là `PICKUP_ROUTE_UNAVAILABLE`, không ghi gì. `validatePickupRequest` kiểm lại
  theo trạng thái chuyến lúc này (chỉ yêu cầu `PENDING` / `VALIDATED`). Nhật ký nhóm `pickup` (`requested`, `approved`, `rejected`, `loaded`,
  `delivered`, `reoptimized`), đối tượng là chuyến, tham số `pickupId`. Điểm của tuyến mang số điểm trong phương án (`planNumberOf`): điểm chèn
  lúc đang chạy không có số đó (`number` là 0, không khớp vùng nào). Màn: `PickupRequestDialog` (nhiều dòng kiện, `react-hook-form` + zod — lỗi là
  mã, luật thuần ở `pickup-form.ts`) lưu xong chuyển sang kết quả mười luật thay vì đóng; mỗi luật là một dòng Đạt / Không đạt bằng chữ
  (`PickupRulesList`, câu dịch ở `pickup-rule-text.ts` — mỗi mã một nhánh nên thêm mã mà quên câu là lỗi kiểu). Khoá Query `['trips', tripId,
  'pickups']`; ghi làm mới `['trips']`, `['notifications']`.
- **Duyệt và từ chối nhận hàng** (FE-7-04, D-88). `approvePickupRequest(tripId, pickupId, { overrideReason? })` — chỉ điều phối viên
  (`ROLE_NOT_ALLOWED`), chuyến phải Đang vận chuyển, yêu cầu `PENDING` / `VALIDATED`. Kho **kiểm lại mười luật** trên chuyến lúc này: còn luật
  không đạt mà không có lý do là `REASON_REQUIRED` (lý do lưu trên yêu cầu và vào nhật ký; đạt cả mười thì lý do bị bỏ). Rồi, trong một lần ghi: (1)
  `createPickupPackages` tạo kiện kho kiện nguồn `PICKUP`, `ASSIGNED`, kèm chuyến, điểm giao và mã QR thật (kiện thứ i ứng `packages[i]`,
  `PickupRequest.packageIds`); (2) `insertPickupIntoTrip` (`db-pickup-stops.ts`) chèn điểm nhận (`kind: 'PICKUP'`) và điểm giao ngay sau điểm hiện
  tại bằng `insertPickupStops` của domain — điểm giao trùng điểm có sẵn thì dùng lại, hạn của điểm là hạn sớm nhất. Đây là **ngoại lệ thứ nhất của
  `TRIP_LOCKED`** khi chuyến đã rời kho và nằm ở đúng một hàm: `updateTrip`, `changeTripVehicle`, tối ưu tuyến… vẫn từ chối. Số điểm là vị trí + 1
  nên các điểm sau lệch số: kho đánh số lại tiến độ giao, sự cố giao, lần đối chiếu, dòng kiện của chuyến, sự cố cấp chuyến, tuyến thay thế,
  cảnh báo trễ hạn, và ghi `DeliveryStop.planNumber` — số của điểm trong phương án đã duyệt (`null` cho điểm chèn lúc chạy; `plan-stops.ts`).
  Phương án là revision bất biến đánh số theo lúc duyệt, nên mọi chỗ đọc "kiện của điểm n" từ phương án đổi số qua `plannedStops(plan,
  trip.stops)` / `stopItemIds` / `adaptResult` (scene của tài xế, Planner, báo cáo chuyến). Chèn điểm **không** tăng `inputVersion` (phương án
  không lỗi thời) và **không** đi qua `withFreshRoute` — thêm điểm ở pha lập kế hoạch bỏ `routePlan` và đưa chuyến về Nháp, còn ở đây `routePlan`
  giữ lại và tính lại giờ đến, mức hạn theo thứ tự mới (`routePlanOf`), ETA trực tiếp tính lại từ vị trí xe. `rejectPickupRequest(tripId,
  pickupId, reason)` cũng chỉ điều phối viên, lý do bắt buộc, không tạo kiện hay điểm nào. Nhật ký `pickup.approved` / `pickup.rejected` mang
  `driverId` của chuyến — tài xế của chuyến nhận chuông. Màn: thẻ `PickupRequestsCard` có cặp nút phụ Từ chối / Duyệt ở yêu cầu còn chờ
  (`pickups.approve`); `PickupApproveDialog` kiểm lại luật khi mở, ô lý do vượt luật hiện khi còn luật không đạt, duyệt xong chuyển sang bước
  liệt kê kiện kèm mã QR và nút "In nhãn gửi bên gửi" (`labelsPath`, cần `labels.print`) — yêu cầu đã duyệt giữ nút này trong thẻ. Duyệt làm mới
  `['trips']`, `['notifications']`, `['package-pool']`, `['driver']`, `['warehouse-labels']`.
- **Tài xế nhận hàng và giao kiện nhận** (FE-7-05, D-88). Kiện nhận không có dòng kiện trong chuyến nên **mã kiện kho kiện** (`PK-NNNN`) đóng vai
  mã instance ở mọi chỗ kho ghi tiến độ: nhãn của chuyến (`labelsOf` thêm `pickupLabels`), lần đối chiếu, `StopProgress.pickedIds` (kiện đã đối
  chiếu ở điểm nhận) và `unloadedIds` (kiện đã dỡ ở điểm giao, như kiện thường). Vai trò của kiện tại một điểm suy từ yêu cầu của nó
  (`db-pickup-progress.ts`): `pick` — điểm là điểm nhận và yêu cầu còn `APPROVED`; `deliver` — điểm là điểm giao và yêu cầu đã `LOADED`; kiện
  không phải việc của điểm là `QR_WRONG_STOP` kèm số điểm đúng. Không thêm hàm kho cho tài xế: `confirmUnloadByQr` / `confirmUnloadManually` /
  `completeStop` chọn lối theo vai trò của kiện (`recordPickupItem`, `db-pickup-scans.ts`). Điểm nhận: đối chiếu bằng nhãn đưa kiện `ASSIGNED →
  LOADED` ngay (bảng chuyển kiện có `ASSIGNED → LOADED`, PRD v2 mục 7.2); xác nhận tay (bước đối chiếu `PICKUP`) chỉ lên xe khi điều phối viên
  duyệt, bị từ chối thì kiện rời `pickedIds`; còn xác nhận tay chờ thì `completeStop` từ chối `MANUAL_CONFIRM_PENDING`. Hoàn tất điểm nhận: kiện
  `IN_TRANSIT`, yêu cầu `LOADED` (`pickup.loaded`); hoàn tất điểm giao: kiện đã dỡ `DELIVERED`, còn lại `RETURNED`, mọi kiện đã giao thì yêu cầu
  `DELIVERED` (`pickup.delivered`). `completeStop` tính cả kiện nhận vào số kiện còn thiếu (`STOP_INCOMPLETE`). Kiện nhận không có trong phương
  án (chỗ xếp của chúng nằm cùng yêu cầu), không có thứ tự dỡ của phương án, không báo sự cố theo kiện (`reportDeliveryIssue` chỉ nhận kiện của
  phương án). `listPickupPackages(tripId)` trả kiện kho kiện của các yêu cầu đã duyệt; `fetchDriverTrip` đọc thêm chúng và yêu cầu
  (`DriverTrip.pickups`, `pickupPackages`). Màn tài xế (`/tai-xe/diem-giao`): `stopDeliveries` có `kind` và `pickupItems` (`driver-pickups.ts`)
  cho từng điểm; **danh sách điểm của chuyến** (`DriverStopList`, thu gọn một dòng 56 px, chỉ vẽ khi chuyến có điểm nhận) ghi mỗi điểm bằng biểu
  tượng **và** chữ — gói hàng "Điểm nhận hàng", ghim "Điểm giao hàng"; điểm nhận có dải thông báo, nút "Đối chiếu kiện nhận" (`PackageVerify`,
  ba mức) và "Hoàn tất điểm nhận"; kiện nhận nằm ở danh sách riêng "Kiện nhận dọc đường" (`PickupItemRow`, không thứ tự dỡ / vùng / lớp), cả ở
  điểm nhận lẫn điểm giao. Khung 3D "Xem vị trí hàng" vẽ kiện nhận **ở chỗ của chúng** (FE-BL-01): `pickupSceneItems` (`driver-pickups.ts`) đọc
  `PickupRequest.layout` của yêu cầu `APPROVED` / `LOADED`, `withPickupPlacements` (`viewer3d/scene-pickups.ts`) ghép chúng vào scene của phương án
  (số điểm giao hiện tại, màu điểm giao, thứ tự dỡ nối sau kiện của phương án ở cùng điểm) và vẽ bằng chính các InstancedMesh của kiện thường —
  không mesh hay draw call mới; dòng kiện của điểm (`stopDeliveries`) vẫn chỉ đọc scene của phương án. Kiện nhận **chưa có chỗ**
  (`layout.unplaced`) chỉ liệt kê bằng DOM cạnh khung (`pickupCargo` của `DriverCargoViewer`) kèm lý do (`viewer.unplacedReasons`) — tài xế xếp
  theo hướng dẫn của điều phối viên. Số điểm của scene tài xế là số **hiện tại** (`adaptResult` đổi số của phương án qua `DeliveryStop.planNumber`),
  nên điểm giao dùng lại vẫn mang đủ hàng của phương án. Chi tiết chuyến và Giám sát gắn nhãn "Nhận hàng" cho điểm nhận (`StopCard`, bảng điểm
  của `MonitoringTripPanel`); thẻ "Xác nhận tay chờ duyệt" đọc cả bước `PICKUP`. Giới hạn đã biết: hộp huỷ chuyến (`undeliveredCount`) và báo
  cáo chuyến (khối lượng đã giao) chưa đếm kiện nhận.
- **Tái tối ưu vùng trống — kiện nhận có chỗ thật** (FE-BL-01, D-88). `freedZones({ vehicle, zones, stops, onboardKg })` (`@/domain/pickup`, thuần)
  trả vùng của các điểm đã hoàn tất (`zones`: hộp suốt chiều rộng và cao lòng thùng, thể tích), `spans` (đoạn liền theo X — hai vùng kề nhau cùng
  trống thì gộp, kể cả khoảng đệm 10 cm), tổng thể tích và tải trọng còn nhận được. `reoptimizeFreedZone`
  (`@/services/optimization/reoptimize-freed-zone.ts`, thuần, tất định) xếp kiện nhận vào đó **không dời kiện nào đang chở**: kiện xếp theo diện
  tích đáy rồi thể tích giảm dần; mỗi kiện thử các điểm ứng viên (sàn trước, rồi X tăng — sâu trước —, rồi Y) với từng hướng đặt qua được cửa
  (`doorOrientations`) và nhận chỗ hợp lệ đầu tiên: trọn trong một đoạn trống và lòng thùng, không chồng kiện / vật cản (lưới không gian của
  domain), còn tải trọng; ở trên cao thì chỉ tựa lên kiện nhận khác cho xếp chồng (tải đè, số tầng, diện tích tựa tối thiểu của dòng kiện) —
  **kiện nhận không bao giờ tựa lên kiện đang chở**. Không xếp được thì mã lý do của hợp đồng (`OVER_PAYLOAD`, `DOOR_TOO_SMALL`,
  `NO_ALLOWED_ORIENTATION`, `NO_SPACE`, `STACKING_VIOLATION`). Cuối cùng cả hàng (đang chở + kiện nhận) qua constraint engine: issue xếp chồng của
  kiện nhận và số kiện còn chở bị che kín mặt sau (`LIFO_BLOCKED`). Điểm giao của mọi kiện trong lần xếp này là **thứ tự tuyến sau khi chèn**
  (`pickup-context.ts`), không phải số điểm của phương án; kiện của điểm hiện tại (và trước đó) rời xe trước khi kiện nhận lên nên không tính là
  bị chắn. Kết quả `FreedZonePacking` (chỗ từng kiện theo chỉ số trong yêu cầu, kiện không xếp được, `before` / `after` khối lượng + trọng tâm +
  tải trục, `stackingIssues`, `blockedCount`) vào `PickupContext.packing` — nguồn của luật 4–7 và 10. **Duyệt** lưu `PickupRequest.layout`
  (`placements`, `unplaced`, `plannedAt`) — phương án đã duyệt (revision bất biến) không đổi — và ghi `pickup.reoptimized` (`placed`, `unplaced`);
  việc này **không tốn credit**: backend chưa trả lời (Q-09), quyết định nằm ở một chỗ có chú thích, `db-pickups.ts`. Kiện không xếp được vẫn
  lên xe theo lý do vượt luật nhưng chưa có chỗ. Yêu cầu nhận sau coi kiện của yêu cầu `APPROVED` / `LOADED` trước là hàng đang chở: có chỗ thì là
  hộp trong `onboard` (tải trọng, trục, trọng tâm, vật cản, chắn lối), chưa có chỗ thì chỉ cộng khối lượng vào luật 3 (`PickupContext.looseKg`).
  Phương thức backend: `GET /api/trips/{id}/freed-zones`, `POST /api/v1/optimize/reoptimize-freed-zone`.
- **Gói cước, credit, thanh toán** (FE-8-01, FE-8-05, D-89, D-90, D-94; `billing-model.ts`, `billing-core.ts`, `db-billing.ts`; `DbState.plans`,
  `subscriptions`, `creditAccounts`, `creditTransactions`, `payments`). Danh mục gói (`SubscriptionPlan`: hạng `BASIC | PRO | ULTIMATE`, giá VND,
  credit tháng — `null` là không giới hạn, hạng thuật toán `EP_DBLF | EP_DBLF_GA | EP_DBLF_GA_AI`) là dữ liệu nền tảng, mọi phiên đọc được; gói
  của công ty, tài khoản credit, sổ cái và thanh toán thuộc công ty, đi qua `ctx.scope` (phiên nền tảng: `COMPANY_REQUIRED`; không phiên: công ty
  mặc định). **Số dư = tổng sổ cái, không bao giờ âm**: chỉ `appendTransaction` đổi số dư. Giao dịch `MONTHLY_GRANT | PURCHASE | USAGE | REFUND`;
  lượt dùng `RESERVED → DEDUCTED | REFUNDED`, hoàn đúng một lần theo mã tham chiếu `JOB-NNN`. Vai trò: quản trị công ty đăng ký, huỷ, nạp credit,
  xử lý thanh toán (`ROLE_NOT_ALLOWED`, xét sau công ty); quản lý nền tảng sửa gói; đọc và giữ / hoàn credit của lần chạy không xét vai trò (quyền
  `optimization.run` chặn ở route). **Vòng đời theo đồng hồ của kho, không hẹn giờ**: mọi hàm chạm tới công ty gọi `settle` trước.
  `subscribeToPlan` / `topUpCredits` chỉ tạo thanh toán `PENDING`; `settlePayment(id, 'SUCCESS' | 'FAILED')` (việc của cổng thanh toán, sau này là
  màn giả lập) xử lý **đúng một lần** — kích hoạt gói + cấp credit tháng, nối kỳ gia hạn + cấp credit, hay cộng credit đã mua. Đăng ký chỉ khi chưa
  có gói hoặc đã `EXPIRED` (`SUBSCRIPTION_ACTIVE`); huỷ → `CANCELLED`, còn hiệu lực tới hết kỳ (`BILLING_CONSTANTS.periodDays` = 30); còn
  `renewalNoticeDays` (3, đề xuất) ngày trước hạn mà gói `ACTIVE` tự gia hạn thì kho tạo một thanh toán `RENEWAL` `PENDING`; tới hạn mà chưa trả
  (hoặc đã huỷ) → `EXPIRED`, thanh toán chờ → `FAILED`, số dư giữ nguyên. Giá và credit tháng mới của gói (`updateSubscriptionPlan`, hết cờ
  `provisional`) chỉ áp từ kỳ kế tiếp: thanh toán gia hạn chụp giá và credit lúc tạo, và thanh toán gia hạn đang chờ đổi theo. Credit tháng cộng dồn
  sang kỳ sau (BE chưa xác nhận, Q-27). **Giá và hạn mức Pro, Ultimate, giá ba gói là giá trị tạm** (`provisional: true`, một chỗ: `SEED_PLANS` ở
  `seed-billing.ts`; PRD v2 mục 17.2 chưa chốt) — màn gói cước ghi "Giá trị tạm — chờ chốt". Seed: Long Bình gói Pro (500 credit), Phương Nam gói
  Basic (100 credit, đã dùng gần hết: còn 2); sổ cái dựng từ các lần chạy của seed sau khi dời giờ và kỳ hiện tại bao giờ của kho (nên số dư của
  seed không đổi theo ngày chạy test). Nhật ký: nhóm `subscription` (`subscribed`, `renewed`, `cancelled`, `expired` — hệ thống ghi) và `credit`
  (`purchased`, `lowBalance` — hệ thống ghi), đối tượng `company` (liên kết tới `/goi-cuoc` cho người có `billing.manage`).
  **Một lần chạy tối ưu 3D = 1 credit** (ba phương án vẫn một): `reserveOptimizationCredit(tripId)` giữ credit lúc bắt đầu (gói hết hạn hoặc chưa có
  gói: `SUBSCRIPTION_EXPIRED`, xét trước số dư; hết credit: `INSUFFICIENT_CREDITS`; gói không giới hạn ghi `0`), `saveOptimizationRun({
  creditReference })` trừ hẳn khi lưu xong (mã không còn được giữ: `CREDIT_NOT_RESERVED`, không lưu gì), `refundOptimizationCredit(reference)` hoàn
  khi lỗi hoặc huỷ. **Kho tự tính credit, không tin nơi gọi** (`runCredit`): phiên đăng nhập lưu kết quả mà không kèm mã giữ (`saveOptimizationRun`,
  `addRevision`) thì kho giữ và trừ ngay tại chỗ — hết credit hay gói hết hạn là từ chối, không lưu gì; chỉ kho không có phiên (dựng seed, test
  logic kho) mới lưu không tính. Lượt đã trừ hẳn **không hoàn được** (`CREDIT_NOT_RESERVED`) — hoàn chỉ dành cho lượt còn đang giữ; giữ và hoàn
  chỉ điều phối viên gọi được (`ROLE_NOT_ALLOWED`). `creditBlock` (luật thuần) là nguồn chung của kho và màn. Tối ưu tuyến, tìm tuyến khác không
  tốn credit. Số dư sau khi giữ credit ≤ `BILLING_CONSTANTS.lowCreditThreshold` (10, đề xuất) thì mỗi lần giữ ghi sự kiện hệ thống `credit.lowBalance`.
  Lớp `-api.ts` (`optimization-api.ts`): `runOptimization` giữ credit trước khi gọi service, trừ khi lưu xong, hoàn khi service lỗi, request bị từ
  chối, huỷ hoặc kho không lưu được — mỗi lần chạy đúng một bộ giao dịch; `fetchOptimizationCredit` (khoá `['billing', 'optimization-credit']`,
  `staleTime: 0`, làm mới sau mỗi lần chạy cùng `['billing']`, `['notifications']`) đọc gói và số dư cho **thẻ "Credit"** của Thiết lập tối ưu
  (`SetupCreditPanel`): "Lần chạy này dùng 1 credit · còn N" (hộp chạy hiện số còn lại sau khi giữ), hạng thuật toán của gói, và khi bị chặn thì
  dòng credit mờ + lý do "Hết credit — liên hệ quản trị công ty" / "Gói cước đã hết hạn — …" ngay trên nút Tối ưu (`aria-describedby`) trước khi
  bấm. Màn chỉ điều phối viên (`optimization.run`) mở được nên chỉ có câu cho điều phối viên; nút "Nạp credit" của quản trị công ty ở `/goi-cuoc`.
- **Danh mục gói cước `/nen-tang/goi`** (FE-8-02; `features/platform`, `subscriptionPlans.manage`, màn chính của quản lý nền tảng): bảng gói (hạng, giá
  `format.currency`, credit tháng hoặc "Không giới hạn", tên thuật toán của hạng, số công ty gắn với gói, công tắc đang bán, menu Sửa / Xoá), gói
  chưa được chốt giá mang nhãn "Giá trị tạm — chờ chốt" (`common.provisionalPlan`) tới khi được sửa. Kho có `createSubscriptionPlan` (hạng chọn bộ
  thuật toán và tính năng: `TIER_ALGORITHM`, `TIER_FEATURES`), `setSubscriptionPlanActive`, `deleteSubscriptionPlan`, `countPlanCompanies`, cùng
  luật vai trò với `updateSubscriptionPlan` (`ROLE_NOT_ALLOWED`): **mỗi hạng một gói đang bán** (`PLAN_TIER_TAKEN` khi tạo gói đang bán hoặc bật bán
  gói thứ hai cùng hạng), gói còn công ty gắn — kể cả công ty đã hết hạn, vì dòng đăng ký của họ vẫn trỏ tới gói — không xoá được (`PLAN_IN_USE`;
  mục Xoá mờ kèm lý do, ngừng bán thay vì xoá). Gói ngừng bán thì công ty đang dùng vẫn giữ và gia hạn. Form (`plan-form.ts`, zod, message là key
  từ điển): giá nguyên đồng ≥ 0, credit tháng nguyên > 0 hoặc "không giới hạn" (kho lưu `null`), hạng chỉ chọn lúc thêm (mở sẵn hạng chưa có gói
  đang bán), và luôn ghi rõ giá, credit mới áp dụng từ kỳ gia hạn kế tiếp của từng công ty. Lớp API `subscription-plans-api.ts` →
  `useSubscriptionPlansQuery.ts`, khoá `['billing', 'plans']`; mọi lần ghi làm mới cả `['billing']`.
- **Gói cước và credit của công ty `/goi-cuoc`** (FE-8-03, FE-8-04; `features/billing`, `billing.manage`, mục "Gói và credit" của quản trị công ty): thẻ
  Gói hiện tại (nhãn "Giá trị tạm — chờ chốt" khi gói mang cờ tạm; nút phụ "Huỷ gói" kèm hộp xác nhận nói gói còn dùng tới hết kỳ), Số dư (`KpiTile`;
  gói không giới hạn ghi "Không giới hạn"), "Chọn gói" **chỉ khi chưa có gói hoặc gói đã hết hạn**, Lịch sử hai tab (`?lich-su=thanh-toan`, vắng là
  credit: `CreditLedgerTable`, `PaymentsTable`; thanh toán còn chờ có nút Trả; phân trang bằng `useListUrlState`). **Một nút chính của màn: "Nạp
  credit"** → `TopUpDialog` (gói 50 hoặc 500, 1.000 đ mỗi credit, `format.currency`). Đăng ký và nạp chỉ tạo thanh toán `PENDING` rồi mở
  `paymentPath(mã thanh toán)`; thanh toán gia hạn (hoặc đăng ký dở) đang chờ có banner kèm nút Trả. Khoá Query `['billing', …]`, `staleTime: 0`; mọi
  lần ghi làm mới `['billing']` và `['notifications']`. **Trang thanh toán giả lập `/thanh-toan/gia-lap?giao-dich=<mã thanh toán>`** (cùng quyền
  `billing.manage`): trung tính — không tên, logo hay màu của cổng thanh toán nào —, nói rõ đây là giả lập, hiện số tiền, nội dung, mã giao dịch và ba
  nút Huỷ · Thất bại · Thành công (chính). Trang **không tự chặn gì thêm** cho "đúng một lần": việc đó do `settlePayment` của kho (trả nguyên kết quả
  cũ khi giao dịch đã xử lý); không vẽ nút khi giao dịch không còn `PENDING`. Xong thì về `/goi-cuoc` kèm toast nói đúng điều kho trả về (theo trạng
  thái cuối, không theo nút đã bấm); mã không có hoặc của công ty khác là màn "Không tìm thấy giao dịch". Có backend: `subscribe` / `topUpCredits` trả
  URL thanh toán và app chuyển thẳng sang đó (hiện `GET /api/payment/mock-checkout`), trang này không dùng nữa.
- **Công ty `/nen-tang/cong-ty`** (FE-8-06, D-65; `features/platform`, `companies.manage`, màn chính và mục đầu của quản trị hệ thống): bảng công ty
  (tên + mã, gói + hạng, trạng thái gói — nhãn của `billing.plan.status`, "Chưa có gói" khi chưa từng đăng ký —, số người dùng, nút sửa), **một nút
  chính "Tạo công ty"**. Kho (`db-companies.ts`) chỉ cho quản trị hệ thống (`ROLE_NOT_ALLOWED`, xét sau công ty như mọi hàm ghi):
  `listCompanyOverview` (công ty + gói hiện tại + `planStatus` **tính theo đồng hồ, không ghi** — `effectiveSubscriptionStatus`: gói quá hạn mà
  công ty chưa chạm tới vẫn hiện Đã hết hạn — + số người dùng), `createCompany` (mã `LOG-NNN`, **chưa có gói**, kèm Quản trị công ty đầu tiên đang
  hoạt động có `depot` là tên kho xuất phát; mật khẩu tạm 10 ký tự trả đúng một lần — ngoại lệ duy nhất của luật "phiên nền tảng chỉ tạo vai trò
  nền tảng" của `createUser`; ghi `company.created` — không thuộc công ty nào — rồi `user.created` — thuộc công ty mới) và `updateCompany` (tên,
  địa chỉ, số điện thoại, kho xuất phát; ghi `company.updated` với `fields`, không đổi gì thì không ghi). Thiếu hoặc sai dữ liệu: `COMPANY_INVALID`
  kèm trường (`admin.email`, `depot.coordinates`…); email trùng (không phân biệt hoa thường): `EMAIL_TAKEN`. Đọc gói, số dư của mọi công ty đi qua
  `ctx.scope.platform*` (`tenancy.ts`): phiên nền tảng và kho không phiên đọc được, phiên của một công ty bị `ROLE_NOT_ALLOWED` —
  `getCurrentSubscription`… vẫn chỉ của công ty của phiên. Form (`company-form.ts`, zod, message là key từ điển) dùng `CoordinatePicker` cho kho;
  ba ô của quản trị đầu tiên chỉ có ở form tạo. Tạo xong mở `TemporaryPasswordDialog` (dùng chung với màn Người dùng); kho từ chối thì câu lỗi hiện
  trong hộp thoại, dữ liệu đang nhập giữ nguyên. Lớp API `companies-api.ts` → `useCompaniesQuery.ts`, khoá `['companies', 'overview']` (dưới
  `['companies']` — khoá tên công ty của Người dùng và Nhật ký, `staleTime: Infinity`), mọi lần ghi làm mới `['companies']`, `['users']`, `['audit']`.
- **Yêu cầu hỗ trợ** (FE-8-07, D-67; `features/support`; backend chưa có entity — Q-18). Kiểu `SupportTicket` (`support-model.ts`, mã `TKT-NNN`): công ty,
  người gửi (tên chụp lúc gửi), loại `TECHNICAL | BILLING`, tiêu đề (≤ 120 ký tự), mô tả (≤ 2.000), trạng thái `OPEN | IN_PROGRESS | CLOSED`, các lần
  trả lời (người, vai trò, nội dung, giờ — tên và vai trò cũng chụp lúc trả lời vì người của công ty không đọc được tài khoản nền tảng). Kho
  (`db-support.ts`, `ctx.scope.supportTickets` theo công ty rồi lọc tiếp theo người gửi): **người của công ty chỉ thấy và trả lời yêu cầu do chính
  mình gửi** — của đồng nghiệp hay của công ty khác đọc là `NOT_FOUND`, ghi vào yêu cầu của công ty khác `FORBIDDEN_COMPANY`; **hỗ trợ khách hàng
  thấy mọi yêu cầu** và là người duy nhất đổi trạng thái (`setSupportTicketStatus`, kể cả mở lại) và đọc khung công ty (`getSupportCompanyPanel`: gói,
  `planStatus` tính theo đồng hồ, số dư, 20 giao dịch credit gần nhất, qua `ctx.scope.platform*`); vai trò nền tảng khác `ROLE_NOT_ALLOWED`; gửi và
  trả lời cần phiên (`NOT_SIGNED_IN`). Hỗ trợ khách hàng trả lời yêu cầu Mở thì yêu cầu sang Đang xử lý; yêu cầu Đóng không nhận trả lời
  (`TICKET_CLOSED`, mở lại bằng đổi trạng thái); sai dữ liệu `TICKET_INVALID`. Nhật ký nhóm `ticket` (`created` mang `ticketKind`, `replied` mang
  người gửi ở `requestedBy`, `statusChanged` mang `ticketStatus`) — **thuộc công ty của yêu cầu** (tham số `companyId` của `ctx.log`) dù người làm
  là tài khoản nền tảng, nên chuông của người gửi nhận được. Seed (`seed-support.ts`): `TKT-001` (Long Bình, Mở, `US-0001`), `TKT-002` (Phương Nam, Đã đóng, `US-PN-03`). **Người dùng công ty**: hộp thoại
  `SupportTicketDialog` mở từ mục "Yêu cầu hỗ trợ" của menu tài khoản (`NavRail`, và `AccountMenu` 56 px của kho, tài xế — cỡ cảm ứng ở nút, ô nhập,
  chữ) — danh sách yêu cầu của mình, gửi yêu cầu mới, đọc và trả lời. **`/ho-tro`** (`support.handle`, màn chính của hỗ trợ khách hàng): bảng mọi
  yêu cầu (hoạt động gần nhất trước; lọc `cong-ty`, `loai`, `trang-thai`, tìm theo tiêu đề / mã / người gửi — trên URL), `?ticket=<mã>` mở cuộc trao
  đổi ở cột phải (trả lời, ô "Trạng thái yêu cầu") kèm `CompanyPanel` chỉ đọc; màn không có nút chính ngoài "Gửi trả lời". Khoá Query `['support',
  'tickets' | 'panel', mã công ty]`, `staleTime: 0`; mọi lần ghi làm mới `['support']`, `['audit']`, `['notifications']`.

### Kiểm thử

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
  overlay debug có thể báo nghỉ sớm. CI: `.github/workflows/ci.yml` (LM-006) chia E2E thành **4 phần chạy
  song song** trên bốn máy (`--shard=n/4`, chia theo file spec, mỗi máy vẫn một worker) — một lượt E2E một máy mất hơn 30 phút, quá giới hạn
  30 phút của job. Ở máy dev chỉ chạy các spec bị thay đổi đụng tới (`pnpm test:e2e e2e/<tên>.spec.ts`); bộ đủ để CI chạy.
- **Máy CI chậm hơn máy dev nhiều** (LM-101) — mọi thứ đo bằng thời gian phải chịu được điều đó:
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
- Playwright **cuộn được cả vùng `overflow-hidden` bằng code** (`scrollIntoView` trước mỗi thao tác), nên màn
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

Mockup hiện hành là `design/v2.3/screens/` (ảnh `.jpg` là đích, `.html` để đo). Làm theo từng đợt ở
`design/v2.3/README.md`. Trước khi sửa một màn: chụp màn hiện tại bằng Playwright **cùng kích thước khung**, so với ảnh đích và
ghi danh sách lệch vào issue (`design/v2.3/CHANGES.md` mục 5). Sau khi sửa: chụp lại và so lần nữa; lệch có chủ ý ghi vào bảng
cuối mục này. Chữ trong mockup không phải chuẩn — chuẩn là `lib/i18n`; số trong mockup lấy từ seed, lệch thì tin `lib/mock-db`.

1. Xác định trước những component **đã tồn tại** trong repo có thể dùng lại. Không tạo component mới trùng chức năng.
2. Lấy màu và khoảng cách từ token, không đo từ ảnh.
3. Nếu mockup vi phạm luật ở mục 5, **làm theo luật ở mục 5** và nói rõ chỗ đã lệch khỏi mockup.
4. Dữ liệu để mock đặt trong file riêng `*.mock.ts` (xem mục 3 để biết đặt ở đâu), không nhúng vào component.
5. Không viết một file dài quá 250 dòng. Tách sớm — thường tách được ngay ở phần header hoặc từng panel.
   Giới hạn này tính cho file **có logic**: component, hook, module. File chỉ
   chứa dữ liệu phẳng — từ điển `src/lib/i18n/{vi,en}/*.ts`, `*.mock.ts`, fixture — được dài hơn, vì cắt chúng
   ra chỉ thêm chỗ để hai bản dịch lệch nhau. Mỗi nhánh của từ điển vẫn phải có chú thích nói nó phục vụ màn nào.

### Những chỗ đã lệch khỏi bản design gốc, có chủ ý

| Bản design | Đã làm | Vì |
|---|---|---|
| Bóng `0 1px 2px` trên card | Chỉ viền 1px | Mục 5 cấm bóng trên card |
| Nhãn mục viết hoa + giãn chữ | Viết thường | Mục 5 cấm viết hoa toàn bộ |
| Nút "XÁC NHẬN ĐÃ XẾP" xanh lá, viết hoa; "Xác nhận đã xếp", "Kiện này không có ở kho" | Không đưa lại: "Đối chiếu kiện" (nút chính, viết thường) và "Kiện hỏng" (phụ) | Mục 5; mỗi kiện phải đối chiếu (FE-6-05) |
| Nút "Chỉ đường" màu primary trên màn tài xế | Đổi sang secondary | Mỗi màn chỉ một nút primary |
| Chữ 11px và 13px rải rác | Ép về 11px (micro) hoặc 12/14px | Giữ thang chữ ở mục 4 |
| Màn kho không có nút thoát | Thêm nút quay lại 56px | Mục 10: màn toàn màn hình phải có lối ra |
| Ô vị trí 3D ở màn kho là ảnh tĩnh | Three.js xoay được | Công nhân cần nhìn quanh kiện để đặt đúng |
| Thanh trên màn kho: một nút "VI" kính (V2.3 đợt 6) | Hai nút `LanguageSwitch` 56 px, điều khiển đặc | Luật mục 1; kính chưa đo ở thiết bị kho |
| Chú thích 13–14 px ở màn kho | Nâng lên 16 px | Mục 10: chữ tối thiểu 16 px trên tablet |
| Màn kho trống / chờ duyệt lại: ô icon, không linh vật | Giữ Lumo, nằm trong card trắng | Mục "Thương hiệu": tư thế chờ việc của kho |
| Bước Soạn hàng và hộp đối chiếu ba mức không có trong mockup kho | Áp ngôn ngữ V2.3 cho màn hiện có, giữ danh sách phẳng kèm "Báo thiếu" từng dòng | Luồng kho đã đổi sau khi mockup được vẽ |
| Màn Xếp xong có tên tài xế và số điện thoại | Bỏ hai dòng đó; có tuyến, xe (khi chuyến còn ở danh sách kho) và ngày chạy | Màn không có nguồn số điện thoại / tài xế (không bịa số) |
| Màn tài xế: nút "VI" kính, tab đáy, nút tròn "Đã dỡ" từng dòng kiện, "Bắt đầu giao" (V2.3 đợt 6) | Hai nút `LanguageSwitch` 56 px đặc; không tab đáy; dòng kiện chỉ hiện trạng thái, dỡ qua hộp đối chiếu; nút chính "Xuất phát" → "Đã đến điểm n" → "Hoàn tất điểm giao" | Luật mục 1; luồng đã đổi sau khi mockup được vẽ (FE-6-03, FE-6-06) |
| Màn điểm giao tài xế: "Báo sự cố" là nút vuông 48 px cạnh nút chính ở chân màn; "Sự cố trên đường", "Nhận hàng dọc đường" không có trong mockup | "Báo sự cố" là nút phụ 56 px trong vùng cuộn, chân màn chỉ có nút chính; hai việc kia gom sau nút phụ "Thêm" mở tờ trượt từ đáy (mỗi hàng 56 px, giữ quyền và hộp thoại cũ) | Mục 10 (vùng chạm 56 px); mỗi màn một nút chính; không bốn nút phụ xếp chồng giữa màn |
| Chip "đang xếp" / "đang chạy" màu tím (mockup kho, tài xế); chữ 13 px, hộp "Báo sự cố" có dấu sao bắt buộc ở nhãn (màn tài xế) | Thang azure; chữ 16 px; nhãn không kèm dấu sao | Không dùng tím; mục 10; tên truy cập của nhãn giữ nguyên |
| Thẻ chuyến liệt kê điểm cho mọi nhóm | Chỉ nhóm Đang vận chuyển và Xếp xong — chờ xuất phát; số kiện của điểm lấy từ phương án (điểm nhận dọc đường ghi loại điểm thay cho số kiện) | Nhóm khác chưa có việc ở từng điểm; không bịa số |
| Tổng kết chuyến: Lumo thay dấu kiểm | Giữ Lumo nhỏ ở đầu thẻ, dấu kiểm ở từng điểm | Mục "Thương hiệu": tư thế xong việc |
| Card đè lên dải trời ở màn Xếp xong, chờ duyệt lại | Card nằm dưới thanh, không đè | Chưa bật `sky-overlap` cho màn toàn màn hình kho |
| Đội xe: tab trạng thái trên dải trời; bảng vật cản một dòng 10 cột; nhãn "Chưa dùng trong tính toán" ở Trục xe | Giữ ô số làm công tắc lọc; bảng vật cản hai dòng; bỏ nhãn | Quyết định của chủ sản phẩm; trục xe đã dùng để tính tải trục |
| Ma trận quyền 13 quyền × 5 vai trò | 33 quyền × 8 vai trò, chia 13 khu vực | Ma trận thật của sản phẩm |
| Nhật ký nhóm theo ngày, có đường thời gian | Giữ bảng có sắp xếp, phân trang | Quyết định của chủ sản phẩm |
| Đăng nhập có ảnh xe tải 3D; màn lỗi dùng ô icon và khối "Chi tiết kỹ thuật" | Hình đẳng cự từ `lib/isometric.ts`; Lumo; không hiện chi tiết kỹ thuật | Không mượn ảnh ngoài; mục "Thương hiệu"; không lộ stack cho người dùng cuối |
| Ảnh đại diện tròn ở thẻ Hồ sơ | Ô vuông bo góc | Luật ảnh đại diện trong nội dung |

## 12. Tối ưu token và context

- Dùng trạng thái code hiện tại làm nguồn chuẩn cho task tiếp theo. Không đọc lại toàn repo hoặc file đã audit nếu chúng không thay đổi.
- Ưu tiên `git diff`, tìm symbol và import/reference; chỉ mở đúng phần liên quan. Tận dụng findings và kết quả kiểm tra đã có.
- Nếu cần research song song, chỉ dùng tối đa 1–2 subagent với scope hẹp, không giao đọc trùng code. Subagent trả findings ngắn, không viết essay hoặc paste code dài.
- Làm song song **nhiều issue** thì mỗi issue một git worktree riêng, chỉ giao issue không sửa chung file và đã đủ phụ thuộc. Agent không sửa `docs/progress.md`; người điều phối gộp nhánh và cập nhật tiến độ sau khi kiểm tra lại lint/build/test trên nhánh gộp.
- Không refactor ngoài scope, không over-engineer; chỉ thêm abstraction/dependency khi có nhu cầu đã chứng minh.
- Khi giải pháp đơn giản đạt acceptance criteria và performance target, dừng khám phá phương án khác.
- Chạy full `pnpm lint`, `pnpm build` và `pnpm test` để xác nhận cuối task (thêm `pnpm test:e2e` khi task đụng UI); không lặp lại sau từng thay đổi nhỏ nếu chưa có lỗi hoặc rủi ro mới cần kiểm tra.
- Mỗi task xong: ghi kết quả vào file issue tương ứng và thêm một mục nhật ký có ngày vào `docs/progress.md`.
- Giữ chất lượng implementation và bằng chứng kiểm thử, đồng thời giảm tối đa context/token không cần thiết.

## 13. Git, nhánh và bộ mặt repo

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
- **`docs/` nằm trong `.gitignore`**: PRD, issue, nhật ký, bàn giao, ảnh chụp, số đo chỉ lưu trên máy, không
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
