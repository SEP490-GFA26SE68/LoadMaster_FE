# Theo dõi tiến độ — LoadMaster FE MVP

Cập nhật lần cuối: **26/09/2026**

Tài liệu liên quan: [PRD](prd.md) · [Gói issue](issues/README.md) · [Build Spec](build-spec.md) · [AGENTS.md](../AGENTS.md) · [handoff.md](handoff.md)

**Cách cập nhật:** mỗi phiên làm việc thêm một mục vào *Nhật ký* (mới nhất ở trên), đổi trạng thái issue ở mục 3 và ghi ngày bắt đầu / xong theo định dạng `dd/mm/yyyy`. Sửa "Cập nhật lần cuối" ở đầu file.

Trạng thái: ⬜ Chưa bắt đầu · 🟦 Đang làm · 🟨 Chờ / bị chặn · ✅ Xong · ⛔ Huỷ

---

## 1. Tổng quan

| Phase | Nội dung | Xong / Tổng | Ước lượng | Trạng thái |
|---|---|---|---|---|
| — | Chuẩn bị: đọc repo, chốt quyết định, PRD, gói issue | 4 / 4 | — | ✅ Xong 14/09/2026 |
| 0 | Git, luật, Vitest, Playwright, CI, bug LM-055 | 6 / 7 | ~4,5 ngày | ✅ Xong 15/09/2026 — CI xanh trên GitHub; còn LM-002 chờ backend |
| 1 | Domain, constraint engine, mock service, dữ liệu mẫu, i18n nền | 19 / 19 | ~18,5 ngày | ✅ Xong 15/09/2026 — 403 test, cổng benchmark đạt |
| 2 | Engine 3D sang cm, 6 hướng, vật cản, editor, bug LM-056 | 10 / 10 | ~10,5 ngày | ✅ Xong 15/09/2026 — 427 unit, 28 E2E, draw call không đổi |
| 3 | Đội xe, kiện, thiết lập tối ưu, Planner, Duyệt, Dashboard | 15 / 15 | ~16,5 ngày | ✅ Xong 16/09/2026 — 492 unit/DOM, 45 E2E |
| 4 | Kho, tài xế, dọn mock mm | 3 / 3 | ~2,5 ngày | ✅ Xong 16/09/2026 — 515 unit/DOM, 50 E2E |
| 5 | i18n phần còn lại, nghiệm thu | 3 / 3 | ~3,5 ngày | ✅ Xong 16/09/2026 — 520 unit/DOM, 55 E2E, cổng chuỗi cứng |
| 6 | Hoàn thiện 5 vai trò (bảo vệ SEP490) | 23 / 23 | ~27,5 ngày | ✅ Xong 20/09/2026 — 773 unit/DOM, 80 E2E, nhánh `feat/ui-complete` |
| **Tổng** | | **79 / 80 issue** | **~83,5 ngày công** | |

**Phase 5 xong (16/09/2026) — MVP nghiệm thu.** 56/57 issue; LM-002 chờ backend. Nợ sau nghiệm thu: [acceptance.md mục 4](acceptance.md#4-nợ-kỹ-thuật-và-phần-chờ-backend), LM-073.

**Đợt 6 xong (20/09/2026) — 5 vai trò có luồng đầu-cuối.** [Rà soát giao diện](ui-audit-2026-09-19.md), [PRD mục 15](prd.md#15-đợt-6--hoàn-thiện-5-vai-trò-1909-2026), issue LM-080 → LM-101 (+ LM-073), nghiệm thu [acceptance.md mục 5](acceptance.md#5-đợt-6--5-vai-trò-lm-080--lm-101-1920092026). Còn: thử màn tài xế trên điện thoại thật (D-57, người dùng tự làm).

**Đang chặn:** không. LM-002 (contract backend) chờ nhóm backend nhưng không chặn phase 1–3.

---

## 2. Nhật ký

### 26/09/2026 — V2.3 "Cyan kính", đợt 2: thành phần (LM-102)

Nhánh `feat/v2-3-thanh-phan` từ `developer` sau khi gộp đợt 1 (PR #2). Đối chiếu năm màn nhóm Hệ thống (`Main`, `ThanhPhan`,
`TrangThaiChung`, `MenuToanCuc`, `TimNhanh`), danh sách lệch K1–K12, T1–T17 ở [LM-102](issues/LM-102-v23-thanh-phan.md).

Phần nền làm tuần tự: dải trời `.sky` cho thanh điều hướng và `PageHero` (ảnh gắn khung nhìn nên hai phần nối liền; card đè dải 44 px
bằng `sky-overlap`), thanh điều hướng kính tối 60 px, menu ngôn ngữ, và các thành phần dùng chung: nút, chip trạng thái theo ngữ pháp chấm,
card, ô nhập, tab, hộp thoại, menu, tooltip, toast, banner, trạng thái rỗng, thước đo, ô số liệu nền đặc. Sau đó hai việc không chung file
chạy song song trong worktree riêng: hai trang `/kieu-dang` + `/thanh-phan`, và chuông + tìm nhanh; người điều phối gộp, kiểm lại trên
nhánh gộp. Bảng tương phản của `/kieu-dang` tính từ token và làm lộ chữ trắng trên mốc điểm giao 3, 6, 7 dưới 4,5:1; đã sửa `lib/stops.ts`.
829 unit/DOM. Ảnh trước / sau / đích: `docs/screenshots/v2.3/dot2-thanh-phan/`.

### 26/09/2026 — V2.3 "Cyan kính", đợt 1: token

Nhận gói bàn giao V2.3 (`design/v2.3/`), áp `AGENTS.v2.3.diff` vào AGENTS.md (6/6 đoạn khớp). Trước khi làm, gộp V2 production
(PR #1, `feat/v2-production-nav`) vào `developer` vì bộ V2.3 viết trên nền đó; CI của PR #1 đỏ ở một test giờ (máy CI chạy UTC,
seed ghi giờ Việt Nam) — sửa bằng cách khoá `TZ=Asia/Ho_Chi_Minh` cho Vitest.

Đợt 1 trên `feat/v2-3-Bluecyan`: khối `:root` của `src/index.css` theo `index.v2.3.css` (giữ tên token cũ, thêm thang cyan / n /
amber / violet / green / red, `--sky`, `--card-shadow`, `--glass-dark*`, `--primary-fill-*`, `--on-primary`, `--font-*`), `@theme` xoá
thang mặc định cùng tên của Tailwind rồi khai lại bằng token, Archivo nạp từ `src/assets/fonts/`, `font-display` vào `cn()`. Nút chính
gradient + chữ tối. Token kính sáng V2 giữ lại (đổi sắc sang cyan) tới khi đợt 2 chuyển component. Tương phản đo lại: mọi cặp chữ/nền đã đổi ≥ 5,0:1,
chữ trên nút chính 7,7:1 (hover 5,8:1). Test nhận "nút primary" bằng lớp `text-on-primary` thay `bg-primary`; E2E vật cản đọc màu
`--highlight` từ trang. Ảnh trước / sau / đích: `docs/screenshots/v2.3/dot1-token/`. 813 unit/DOM, 82 E2E.

### 23/09/2026 — V2 bước 6, nhóm 2: bảng điều khiển, người dùng, nhật ký, hồ sơ

Bốn màn làm song song, mỗi màn một agent trong git worktree riêng (không chung file: mỗi màn một thư mục feature, một nhánh từ
điển, một file E2E), người điều phối gộp và chạy kiểm tra trên nhánh gộp. Điểm V2 cần quyết định mới được hỏi người dùng sau lượt
đầu rồi làm bù. Bài học quy trình: worktree của agent được tạo từ commit cũ, phải bảo agent đặt lại về đầu nhánh trước khi làm.

**Đã làm**
- **Bảng điều khiển:** lưới hai cột V2 (chuyến theo trạng thái + thẻ đội xe; lấp đầy theo ngày + khối lượng đã giao theo xe), bảng
  chuyến gần đây kiểu paper. Thẻ đội xe mới: sẵn sàng / đang phục vụ chuyến / bảo dưỡng, đếm trên cả đội xe theo cùng luật với Đội
  xe. Giữ 5 ô số liệu (người dùng chọn giữ cả ô và số lớn trên thẻ đội xe), chọn kỳ ở đầu nội dung. Lượt đầu agent chuyển hai biểu đồ
  sang thanh HTML — người dùng chọn giữ recharts, đã đưa về; tên xe kèm biển số xuống tối đa ba dòng trên trục, không cắt biển số.
- **Người dùng:** ba ô số liệu (tổng · đang hoạt động · đã khoá), hai ô trạng thái lọc qua `trang-thai`; thanh tìm/lọc và bảng chung
  thẻ; avatar chữ cái vuông bo góc. Bấm dòng mở panel chi tiết (thông tin, chip "Công việc được phép" từ `ROLE_PERMISSIONS`, nút sửa /
  khoá / đặt lại mật khẩu / xoá cùng luật chặn với menu dòng); panel mở thì ẩn cột Điện thoại. Giữ tab Ma trận quyền (nay kiểu paper).
- **Nhật ký:** ba ô số liệu trên cả nhật ký (tổng sự kiện · sự kiện ngày gần nhất — bấm để lọc ngày đó · ghi nhận gần nhất); dòng có
  avatar người làm + vai trò hiện tại (người dùng chọn giữ; kho chưa lưu vai trò lúc xảy ra), icon hành động trên nền tint theo nghĩa
  cố định (hổ phách chỉ cho việc cần chú ý); giữ đủ cột, bộ lọc, tham số URL.
- **Hồ sơ:** hai cột — cột nhận diện (avatar, tên, vai trò, email, kho) và thẻ gồm hai phần form; email chỉ hiện một lần. Không hiện
  "đăng nhập gần nhất": với chính mình đó chỉ là giờ của phiên này.

**Lỗi tìm ra khi gộp**
- `admin-users` E2E đỏ 1/4 lần: menu "Khoá tài khoản" bị gỡ khỏi DOM giữa cú bấm. Nguyên nhân: TanStack Table v9 dựng hàm `cell` thành
  component, cột memo theo `users` nên dữ liệu về lại (sau đăng nhập) dựng lại cột và gắn lại mọi ô. Sửa: hàm ô cấp module, giá trị
  đổi qua context; test hồi quy giữ nguyên phần tử menu khi dữ liệu về lại. Luật mới ở AGENTS mục 5 "Bảng dữ liệu".
- `plan-approval` đỏ một lần khi máy chạy song song các agent, chạy riêng xanh.

**Kết quả:** `pnpm lint`, `pnpm build` sạch; 812 unit/DOM; 82/82 E2E trên nhánh gộp (chạy khi không còn agent song song).

**Còn lại:** nhóm 3 (panel Planner; kho và tài xế theo V2 mobile — cần nghiên cứu nghiệp vụ và hỏi trước; đăng nhập/403/404 chỉ
token). Bảng khác có hàm ô viết trong memo theo dữ liệu (danh sách chuyến, đội xe, chuyến gần đây) chưa có menu trong ô nên chưa lỗi,
nhưng nên đưa về cùng lối khi thêm trạng thái vào ô.

### 23/09/2026 — V2 bước 6, nhóm 1: năm màn điều phối

Làm theo nhóm, một commit mỗi màn, người dùng chốt từng điểm lệch với bản V2 trước khi làm (quyết định ghi lại trong phiên).
Số nào bản V2 bịa (132 kiện lúc tạo chuyến mới, "không đo" thời gian chạy) đều thay bằng số truy được về kho.

**Đã làm**
- **Danh sách chuyến:** ba ô số liệu (tổng · đang thực hiện · cần xem phương án), hai ô nhóm là công tắc lọc qua cùng tham số
  `trang-thai` (thêm slug nhóm `dang-thuc-hien`, `can-xem-phuong-an`). Thanh tìm/lọc chung thẻ với bảng, hàng lọc thứ hai
  (`secondary`) cho ngày, xe, tài xế. Cột Kiện kèm số điểm giao → mật độ mới `roomy` 56px. Không làm panel "Cần xử lý" và bộ chọn mật
  độ của V2 (ô số liệu đã lọc được nhóm đó; bộ chọn mật độ trong V2 không có chức năng).
- **Form tạo/sửa chuyến:** một thẻ, các phần đánh số (`FormSection`, dùng chung với Thiết lập tối ưu); điểm giao có chip màu định
  danh, nút ↑/↓ đổi thứ tự khi tạo mới; cột phải là danh sách tự kiểm và khối tổng hợp kính.
- **Thiết lập tối ưu:** phần 1 Kiểm tra đầu vào, phần 2 Yêu cầu xếp hàng (mỗi công tắc một câu giải thích qua `aria-describedby`),
  Thiết lập nâng cao gập trong `<details>` và tự mở khi có lỗi. Cột phải: "Hai giới hạn khác nhau" (khối lượng / tải, thể tích / lòng
  thùng). Nút Tối ưu giữ ở thanh tiêu đề — một nút primary mỗi màn.
- **Chi tiết chuyến** (hai lượt): tiến trình thành dải ngang 7 mốc; sơ đồ tuyến gập được; tóm tắt hàng thành khối kính; ba cột từ
  1.536px, 1.280–1.535px thẻ phương tiện xuống dưới cột trái (`grid-template-areas`) để bảng kiện giữ ~1.030px. Bấm điểm giao lọc bảng
  kiện. Bảng kiện một thẻ: tìm, lọc điểm giao, chip "Chỉ hàng dễ vỡ" / "Chỉ kiện có lỗi", ô tên gộp tên / mã · kích thước, cột Yêu
  cầu thay cột số hướng đặt. "Dễ vỡ" = mức Cao — seed có đúng 22 kiện như bản V2 ghi. Panel kiện có phần xem kiểu V2 (hình đẳng cự
  theo tỉ lệ kích thước) trên form; người chỉ xem chỉ thấy phần xem.
- **So sánh phương án:** ma trận chỉ số × bản lưu thay các thẻ; đầu cột có radio chọn bản mở trong 3D, MOCK RESULT và trạng thái; ô
  tốt nhất tô nền kèm dấu tích, không đánh dấu khi mọi bản bằng nhau; "Chỉ hiện khác biệt"; chân bảng ghi bản duyệt kế thừa từ bản
  nào. Gỡ `PlanCard`.

**Test**
- Mới: nhóm trạng thái và số điểm giao (TDD), ô số liệu lọc qua URL; nút ↑/↓ điểm giao; chip yêu cầu và định nghĩa dễ vỡ (TDD, số
  từ seed), lọc bảng kiện theo điểm giao / dễ vỡ / tìm, phần xem kiện cho người chỉ xem; ma trận so sánh (số theo cột, radio chọn,
  "Chỉ hiện khác biệt").
- Sửa: `spec-flow` (regex dòng kiện theo ô tên gộp), `plan-compare-404` (radio thay nút chọn thẻ).
- Lượt E2E đầy đủ đầu tiên: 75/81 xanh. Sáu test đỏ: bốn selector theo giao diện cũ (dòng kiện nay tên trước mã; "9.500 kg" có
  thêm ở khối tổng hợp; chữ đầu tiên khớp nằm trong sơ đồ tuyến đang gập; số kiện ở Thiết lập tối ưu tách số và đơn vị), hai lỗi thật
  ở `layout-1366`: thẻ điểm giao ở cột trái 272px chỉ còn 130px cho chữ, tên và địa chỉ vượt hai dòng — thu khoảng cách và chip số,
  nay 152px. Chạy lại mọi file E2E liên quan: xanh.
- Kết quả: `pnpm lint`, `pnpm build` sạch; 788 unit/DOM; 81/81 E2E.

**Còn lại:** nhóm 2 (bảng điều khiển, người dùng, nhật ký, hồ sơ), nhóm 3 (panel Planner; kho và tài xế theo V2 mobile — cần nghiên
cứu nghiệp vụ và hỏi trước; đăng nhập/403/404 chỉ token).

### 23/09/2026 — V2 bước 5: màn Đội xe theo V2

Nghiên cứu bản V2 (`design/v2/desktop-fleet.js`, ảnh `screen-fleet.png`), code hiện tại và các test ràng buộc; người dùng chốt từng
điểm lệch trước khi làm.

**Đã làm**
- Bốn ô số liệu trên đầu (tổng · sẵn sàng · đang phục vụ chuyến · bảo dưỡng), đếm trên cả đội xe. Ba ô trạng thái là công tắc lọc:
  `<button aria-pressed>` trong vỏ `role="group"`, đi qua `list.setFilter('trang-thai', …)` nên URL đổi và ô chọn trạng thái khớp
  theo; bấm lại thì bỏ lọc. `KpiTile` thêm `onPress`/`pressed`.
- Bảng theo V2: Phương tiện · Lòng thùng · Tải tối đa · Vật cản · Trạng thái (bỏ cột Cửa — xem ở cấu hình xe). Icon xe tô theo
  trạng thái, tên + mã hai dòng; trạng thái là badge + mã chuyến / ghi chú bảo dưỡng tối đa hai dòng — hết lỗi ghi chú bị cắt.
- Thanh tìm/lọc và bảng chung một thẻ: `FilterBar layout="toolbar"`, `DataTable appearance="paper"` (tiêu đề cột nền
  `--table-head`, 600), mật độ mới `spacious` 72px. Chỉ Đội xe dùng; bước 6 mới lan. Lớp kiểu dáng tách ra `data-table-styles.ts`.
- Nhãn "Đang chạy" → "Đang phục vụ chuyến" (gồm cả xe đứng ở kho chờ xếp); KPI bảng điều khiển "Xe đang phục vụ chuyến". Tham số
  URL giữ `trang-thai=dang-chay` để link cũ không gãy. Badge xe đang phục vụ đổi tông xanh dương cho khớp icon tint "vận hành".
- Chú thích ô số liệu sửa cho đúng dữ liệu thay vì chép V2 (xe đang phục vụ cũng chọn được khi lập chuyến; chỉ xe bảo dưỡng bị
  chặn — D-53). Chân bảng là câu nguồn dữ liệu: chưa có GPS hay vị trí thời gian thực.
- Chi tiết xe: giữ đủ chức năng (3D, vật cản, trục, bảo dưỡng, khoá khi đang chạy), khoác vật liệu V2 — ô icon, tên xe h1 24px +
  mã mono trong cùng header, thẻ bo 12px.

**Test**
- Mới: ô số liệu đếm đúng và không theo ô tìm; bấm ô lọc + URL + `aria-pressed`, chuyển ô bằng bàn phím, bấm lại bỏ lọc.
- Sửa: `spec-flow` (thứ tự cột), 6 chỗ nhãn "Đang chạy", helper `vehicleIds` (`\d{3}` — cột sau tên nay bắt đầu bằng số).
- `layout-1366`: thêm Đội xe vào kiểm chữ bị cắt ở 1.366/1.600 và vào test lăn chuột.

**Kiểm tra**
- Trình duyệt 1.366 × 768: không chữ bị cắt, ô đang lọc viền primary, tên truy cập dòng "Truck 6m VEHICLE-001 600 × 240 × 250 cm
  5.000 kg 1 vùng Sẵn sàng".
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **778/778** ✅ · `pnpm test:e2e` **81/81** ✅ (16,1 phút). CI của PR #1 (bước 0 → tài liệu) xanh trọn.

### 23/09/2026 — Sửa: màn trong khung ứng dụng không lăn chuột được

Người dùng báo bảng điều khiển "bị cố định", không lướt xuống được.

**Nguyên nhân** (ba lỗi, tái hiện bằng `mouse.wheel` ở 1.366 × 768 trước khi sửa)
- Bước 2 của V2 đổi `AppShell` từ hàng (rail dọc) sang cột (thanh ngang) nhưng đặt màn thẳng vào cột: gốc màn cao theo nội dung
  (bảng điều khiển 1.645 px trong cửa sổ 768 px), `overflow-hidden` của khung cắt phần dưới, vùng cuộn không có gì để cuộn.
- Bảng `sr-only` của biểu đồ là `absolute` không có tổ tiên định vị: kéo tài liệu dài tới 959 px, bánh xe cuộn cả trang và đẩy thanh
  điều hướng khỏi mép trên — đúng ảnh người dùng gửi.
- Có từ trước V2: khung bo góc quanh bảng nhật ký là con `overflow-hidden` của cột flex nên bị co còn 516 px, 50 dòng chỉ thấy khoảng 10.

**Đã làm**
- `AppShell`: màn nằm trong hàng flex `relative min-h-0` — trả lại đúng bối cảnh mọi màn được viết cho, và giữ phần tử `absolute` trong khung.
- Nhật ký: khung bảng `flex-none`. Quét tự động 12 màn ở 1.366 × 768 tìm con của cột flex bị co thấp hơn nội dung: chỉ còn nhật ký.
- E2E mới trong `layout-1366.spec.ts`: lăn chuột thật tới cuối ở bảng điều khiển, chi tiết chuyến, chi tiết xe, nhật ký; trang không cuộn,
  thanh điều hướng ở mép trên. Bỏ hai chỗ sửa thì test đỏ, có thì xanh.
- AGENTS mục 5 (cuộn trong khung ứng dụng) và mục 9 (Playwright cuộn được `overflow-hidden` bằng code — kiểm bằng bánh xe).

**Vì sao E2E không bắt được:** Playwright tự `scrollIntoView` trước mỗi thao tác, và cách đó cuộn được cả vùng `overflow-hidden`.

**Kiểm tra**
- `pnpm lint` · `pnpm build` · `pnpm test` · `pnpm test:e2e` ✅ — lint, build, **776/776** unit, **81/81** E2E (80 cũ + 1 mới, 16,3 phút).

### 23/09/2026 — V2 bước 4b: theo sát bản V2, sửa luật cũ cho khớp

Người dùng chốt: làm theo V2, luật viết cho giao diện phẳng V1 thì sửa theo thực tế. Hỏi từng điểm lệch trước khi sửa.

**Đã làm**
- Kính ô số liệu theo V2: gradient kính, viền sáng trong + bóng nâng nhẹ, bo 16 px (token mới `--r-xl`, chỉ cho bề mặt kính).
- Ô icon tiêu đề 44 px gradient xanh nhạt, viền trắng, bóng nhẹ (`.hero-icon`); icon ô số liệu có vòng sáng mảnh.
- Số KPI 26 px **sans** `tabular-nums` như V2 (brief V2: mono chỉ cho mã/số đo), thay 28 px mono.
- Hai bậc chữ lẻ của V2 thành token: `note` 11,5/17 (ghi chú ô số liệu), `lede` 13,5/22 (mô tả dưới tiêu đề).
- `--ink-3` tối lại `#71829A` → `#5E6E84`: 5,2:1 trên trắng, 4,7:1 trên trường nền (bản V2 trượt 4,5:1). Chú thích dùng lại được `--ink-3`.
- Thanh điều hướng trên màn 2K canh theo cột như V2 (`xl:px-shell`): logo, tiêu đề, nội dung cùng thẳng x=464 ở 2.560 px.
- Không đưa hoạ tiết sau tiêu đề — người dùng không chọn.
- AGENTS mục 4 (token, thang chữ, số KPI) và mục 5 (gradient và bóng cho vật liệu kính) sửa theo.

**Kiểm tra**
- Trình duyệt 1.366: `getComputedStyle` xác nhận bo 16 px, bóng kính, số Be Vietnam Pro 26 px, ghi chú `#5E6E84`, hero icon gradient
  44 px, mô tả 13,5 px, header 72 px, không chữ bị cắt.
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **776/776** ✅ · E2E liên quan **23/23** ✅ (manager-dashboard, layout-1366, spec-flow,
  fleet-status, i18n-en, rbac, profile, quick-search, planner-compact).

### 23/09/2026 — V2 vào production, bước 4: thanh tiêu đề màn và ô số liệu dùng chung

**Đã làm**
- `components/PageHero.tsx`: icon màn trên nền tint, tiêu đề h1 24 px, `meta` mono, một câu mô tả (nhánh từ điển mới `pageHero`),
  hành động ở phải, nút quay lại tuỳ chọn. Áp cho 9 màn: danh sách chuyến, tạo/sửa chuyến, thiết lập tối ưu, so sánh, đội xe,
  bảng điều khiển, người dùng, nhật ký, hồ sơ. Chi tiết chuyến, form xe và Planner giữ header riêng (tiêu đề là dữ liệu / thanh 56 px).
  Tiêu đề thống nhất về h1 24 px — trước đó 7 màn dùng h2 20 px, 2 màn h1.
- `KpiTile` lên `components/` và theo V2: kính `.glass-tile` (nền đặc dự phòng khi thiếu `backdrop-filter` hoặc
  `prefers-reduced-transparency`), icon tint theo nghĩa, số 28 px mono, ghi chú cỡ micro. Bảng điều khiển gán icon/tông cho 5 ô.
- `--shell-max` nay được dùng: utility `px-shell` cho thanh tiêu đề và vùng cuộn của 11 màn — thống nhất năm kiểu padding ngang
  (`p-6`, `p-6 px-8`, `px-8 py-6`, `px-8 pt-6 pb-8`, `p-4 sm:p-6`) về 24 px; cột rộng hơn 1.680 px thì khối nội dung (kể cả lề) dừng ở 1.680 px, căn giữa.
- Token cỡ chữ `micro` 11/14 vào `@theme` và `THEME_FONT_SIZES`. AGENTS mục 3, 4, 5 cập nhật.

**Lệch khỏi bản V2, có chủ ý**
- Không đưa hoạ tiết đường nét sau tiêu đề: màn vận hành không có hình minh hoạ (AGENTS mục 5).
- Nền icon tint phẳng, không gradient/bóng như bản V2; ô số liệu không đổ bóng ra ngoài (card).
- Số 26 px sans → 28 px JetBrains Mono; ghi chú 11,5 → 11 px; bo 15 → 12 px — về thang của AGENTS mục 4.
- Chữ `--ink-3` của V2 đổi sang `--ink-2`: `--ink-3` chỉ đạt 3,9:1 trên trắng (3,5:1 trên trường nền), dưới ngưỡng 4,5:1.

**Kiểm tra**
- Trình duyệt thật 1.366 × 768 (admin, 11 màn): header đúng 72 px; không cuộn ngang; `getComputedStyle` xác nhận kính, h1 24 px,
  ghi chú 11 px, số mono. 2.560 px: nội dung từ x=464 tới 2.096 (1.632 = 1.680 − 2 × 24). 390 px (hồ sơ): header 72 px, mô tả ẩn.
- Phép kiểm "chữ bị cắt" báo ô bảng ở `/chuyen` (tên tuyến dài) và `/doi-xe` (ghi chú bảo dưỡng) — bề rộng ở 1.366 px không đổi so
  với trước bước này (lề 24 px cả hai), nên đây là tồn đọng có sẵn; `layout-1366.spec` không phủ hai màn này. Xem lại ở bước 5.
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **776/776** ✅ · `pnpm test:e2e` **80/80** ✅ (16,1 phút)

### 23/09/2026 — V2 vào production, bước 0–3: luật, token, thanh điều hướng ngang, trường nền

Nhánh `feat/v2-production-nav` (tách từ `developer`). Hướng B đã duyệt; chuyển ngôn ngữ thị giác của `design/v2` vào `src/` theo
từng bước, mỗi bước một commit.

**Đã làm**
- **Bước 0 — luật.** AGENTS mục 5: bỏ lệnh cấm kính, thay bằng luật phân lớp (kính ở chrome điều hướng, khối tổng hợp số liệu, panel
  nổi trên khung 3D; bảng, form, inspector giữ nền đặc; không lồng kính; luôn có nền đặc dự phòng). Nền trang được dùng trường màu
  biên độ dưới 5% độ sáng. Điều hướng rail dọc 96 px → thanh ngang 56 px.
- **Bước 1 — token** (`src/index.css`): thang mực `--ink-strong/1/2/3`, năm cặp `--tint-*`, `--shell-max`, `--field`, `--chrome`,
  nối vào `@theme inline`. Bổ sung thuần, chưa đổi giao diện.
- **Bước 2 — thanh điều hướng ngang** (`app/NavRail.tsx`, `app/useGlassFollow.ts`): chỉ báo kính bám mục đang hover/focus, trả về
  mục đang mở khi rời thanh. Dưới 1.340 px chỉ còn icon, tên vào `aria-label`. Ba lỗi thanh ngang gây ra đã sửa: toast đè nút ở góc
  phải header (offset 80 → 136 px), màn 403 bị cắt 56 px trong `AppShell`, nav không vừa ở 1.024/390 px (nay co và cuộn).
- **Bước 3 — trường nền**: `AppShell` dùng `--field`; 11 thanh tiêu đề 72 px, thanh tab Người dùng và thanh chân So sánh đổi sang
  `bg-chrome`; `EmptyState`, `ErrorScreen` bỏ nền xám.

**Vướng mắc**
- `background-image` có lớp cuối là màu là CSS không hợp lệ: trình duyệt bỏ cả khai báo, không báo lỗi. Prototype dùng shorthand
  `background` nên không gặp. Lớp cuối của `--field` nay là `linear-gradient` đặc. Kiểm nền bằng `getComputedStyle`.

**Kiểm tra**
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **776/776** ✅ · `pnpm test:e2e` **80/80** ✅ (bước 2); bước 3 chạy lại
  `layout-1366`, `rbac`, `profile` ✅.

**Việc tiếp theo**
- Bước 4: tiêu đề màn dùng chung (`PageHero`) và ô số liệu dùng chung (`KpiTile` lên `components/`), áp `--shell-max`.
- Bước 5: màn Đội xe trọn vẹn. Bước 6: đo rồi mới mở rộng sang các màn còn lại.
- Blur ở màn kho/tài xế chưa đo trên thiết bị thật — phải đo trước khi coi là chốt.

### 22/09/2026 — V2 Mobile 03: đăng nhập, cài đặt và bàn giao

- Thêm login/settings/access/about; nối tài khoản, đăng xuất nhắc hàng đợi, hết phiên quay về đăng nhập mẫu. Không lưu mật khẩu; không gọi backend hoặc tự nhận đã có RBAC.
- Nền rõ/chữ lớn/giảm chuyển động hoạt động trong phiên; hướng dẫn camera/ảnh ghi rõ chưa tích hợp. Sửa badge tài khoản bị áp style avatar.
- Gallery 21 ảnh / 12 màn. Ba bộ Playwright prototype pass, gồm chữ lớn 360/430 px và luồng cũ. Lint/build pass (cảnh báo chunk 3D hiện có), 126 files / 776 tests pass.
- Bàn giao: [v2-mobile-handoff.md](v2-mobile-handoff.md). Còn Flutter, xác thực, queue bền, camera, tích hợp engine và thử Android thật.


### 22/09/2026 — V2 Mobile 02: cùng nhận diện web B, nối luồng tài xế

- Navigation/kính/tổng quan lấy vật liệu của web B; thêm nhận chuyến, kiểm mã → xác nhận → kiện kế tiếp, tiến độ phiên và queue xác nhận mẫu.
- Chặn mã sai, mã đã đổi sau khi khớp, xác nhận trùng và tài xế chưa nhận chuyến. Thêm đặt lại luồng và 4 cảnh tải/rỗng/lỗi/hết phiên.
- Sơ đồ từ trên khớp tọa độ kiện; ảnh xe chính vẫn tĩnh. Gallery 15 hình / 8 màn; không thêm Flutter, backend hoặc đổi production.
- Lint/build pass (cảnh báo chunk 3D hiện có), 126 files / 776 tests pass; Playwright prototype + luồng cảm ứng pass. Phạm vi và phần còn thiếu: [Mobile 02](v2-mobile-sketch.md#mobile-02--hoàn-thiện-theo-web-b-22092026).


### 22/09/2026 — V2 Mobile 01: phác thảo điện thoại cho tài xế và kho

- Thêm 7 màn riêng, bảng 9 ảnh tại `design/v2/mobile-board.html`, nối vào sketchbook. Công việc sáng, vùng xe tối, thông tin kiện ở đáy; controls 56 px và tùy chọn nền đặc.
- Dùng ảnh engine và 132 placements từ seed. Trình phát đổi thông tin, ảnh xe cố định; không thêm editor mobile hoặc giả backend.
- Thử điểm giao, hướng dẫn xếp/dỡ, đối chiếu mã, ảnh sự cố, queue phiên và retry mẫu. `verify-mobile.mjs` pass ở 360/390/430 px; chưa thử điện thoại thật.
- Kiểm tra cuối vòng: lint/build pass (cảnh báo chunk 3D hiện có), 126 files / 776 tests pass; Playwright prototype pass cả gallery và giữ kiện khi quay lại từ kiểm mã.
- Phạm vi/bàn giao: [mobile brief](v2-mobile-sketch.md). Chưa triển khai Flutter, camera scan, queue bền hoặc xác nhận nghiệp vụ.


### 22/09/2026 — V2 vòng 08: bổ sung desktop trước mobile

- Đối chiếu router với bộ phác thảo; ghi phạm vi và lỗ hổng tại [v2-screen-coverage.md](v2-screen-coverage.md).
- Thêm 9 màn: kiện/kiểm lỗi nhập, so sánh, đội xe, chi tiết xe, tổng quan, người dùng/quyền, nhật ký, hồ sơ, bảng thành phần. Chỉ `design/v2`, không thay `src/` hoặc backend.
- Snapshot từ seed và hàm tổng hợp hiện tại: 8 xe, 12 người, 115 sự kiện, REV-001/002; không bịa chênh lệch, thời gian tối ưu hoặc số tăng trưởng.
- `verify-desktop.mjs` và `verify-screens.mjs` pass; `pnpm lint` pass; `pnpm build` pass (cảnh báo chunk 3D hiện hữu); `pnpm test` 126 files / 776 tests pass. Gallery 16 màn không tràn 1366; ảnh mới tải được. Kiểm và ảnh bổ sung tại README prototype.
- Mobile giữ 3 mẫu vòng trước. Chưa Flutter, chưa ghi nghiệp vụ production, chưa hoàn tất toàn bộ luồng sâu desktop.


### 22/09/2026 — V2 vòng 07: mở rộng phác thảo các màn

- Thêm 7 màn trong `design/v2/screens.html`: danh sách chuyến, tạo chuyến, thiết lập tối ưu, Planner, tài xế, kho, hàng đợi gửi lại. Giữ hướng B, số liệu màu mực, kính ở chrome/summary, bảng nền rõ.
- Sketchbook có ảnh/link từng màn, tách desktop/phone; Chi tiết chuyến nối về danh sách mẫu.
- Có lọc/tìm, validation form, đổi thứ tự điểm, inspector, đối chiếu mã, sự cố và retry queue mô phỏng trong sessionStorage. Planner dùng ảnh engine hiện tại.
- `node design/v2/verify-screens.mjs`: pass 7 màn desktop 1366/phone 390 và tương tác chính. Không sửa production/dependency, không chạy lại suite production.
- Chưa triển khai Flutter, lưu ảnh, queue bền/backend. V2 còn thiếu quản lý/admin/đội xe/nhập kiện; ghi trong sketchbook và README.


### 22/09/2026 — V2: chọn B, hoàn thiện bàn điều phối và bảng phác thảo

- Người dùng chọn B. Thu gọn phần trên, tăng chữ tiến trình, phân biệt đang làm/bước tiếp theo; ở 1366×768 thấy trọn 4 dòng thay vì 2. Bảng có sort, `aria-sort`, header sticky.
- Inspector có đóng ở đầu, Escape/trả focus, vẫn giữ tóm tắt xe. Màn hẹp dùng sheet native dialog; giữ selection khi chuyển sheet/panel theo viewport.
- Thêm 9 cảnh review gồm chuyến cần duyệt lại, khoá sửa, đang giao, loading/error/empty/missing. Không ghi kho, không phát API hay giả thành công nghiệp vụ.
- Thêm `design/v2/sketchbook.html`: 6 phần phác thảo, ảnh thật của prototype và liên kết cảnh; `design/v2/README.md` bàn giao cách dùng/phần còn thiếu. Mẫu component mới là khởi đầu, chưa tuyên bố hoàn thiện DS/Flutter.
- `node design/v2/verify.mjs` kiểm prototype: A/B, lọc/tìm/mật độ, sort, chín cảnh, inspector/keyboard/focus/viewport, deep link và ảnh board; 1366/1024/768/390 không tràn trang. Chưa đổi code production/dependency; không chạy full suite app.

### 21/09/2026 — V2: brief và bản thử Chi tiết chuyến

- Vòng 05: người dùng giữ chất kính nhưng từ chối KPI nhiều màu và độ chi tiết A/B. [Nghiên cứu visual](v2-visual-research.md) đối chiếu Apple/Linear/Carbon, phân biệt tham chiếu và nhận định. Số KPI chung màu mực, kính tổng hợp dùng chung công thức; bổ sung kích thước trong bảng, khối lượng từng điểm, filter context và inspector có sơ đồ/kích thước/yêu cầu xếp từ snapshot. Kiểm prototype riêng; chưa duyệt hướng cuối, chưa đổi production.

- Vòng 04 sau 8 lựa chọn của người dùng: hai mẫu toàn màn A (tổng quan tuyến, rail dọc) / B (bàn điều phối, nav ngang, tuyến–bảng–panel). `concepts.css` thay stylesheet vòng 03; kính ở vùng tổng hợp/navigation, bảng nền đặc; nét tuyến nền và màu phân loại thông tin. Giữ kính bao toàn button. Có query `layout=a/b`, chuyển cảnh tôn trọng reduced motion. Kiểm prototype riêng hai mẫu, lựa chọn kiện/focus, bộ lọc, mật độ, không tràn 1366/390; chưa đổi production/Flutter.

- Vòng 03 theo phản hồi: giữ navigation kính, gỡ lens quanh icon; thay nội dung bằng bố cục hồ sơ vận tải (tên tuyến, trạng thái gọn, điểm giao tương tác, bảng + phương tiện), bỏ hero/slogan/minh hoạ trang trí. Thêm tỷ lệ tải/thể tích tính từ seed. `manifest.css` được dùng thay expressive; kiểm prototype riêng gồm full-button glass/tỷ lệ, chưa đổi app production.

- Vòng ý tưởng 02 theo phản hồi: tăng rõ chất glass (spring easing người dùng, lớp kính lồi và SVG filter), nền xanh chuyển nhẹ, header/nhóm hàng/thống kê có chiều sâu. Người dùng cho phép vượt luật visual V1 trong prototype; kiểm lại tương tác riêng, chưa có benchmark mobile thật.

- Người dùng chốt nhóm 5 người, review tuần sau, ưu tiên demo rồi pilot; app Flutter kho/tài xế Android phone trước; hàng đợi gửi lại thuộc V2. Ngày bảo vệ và phân công chưa chốt.
- [Brief V2](v2-design-brief.md) ghi nhận quyết định; ba bố cục A/B/C tại `design/v2/trip-detail.html`, cùng snapshot 132 kiện. Có bật/tắt glass navigation/nút phụ, mật độ, lọc/tìm và chi tiết kiện.
- Kiểm riêng prototype bằng `node design/v2/verify.mjs`; ảnh tại `design/v2/`. Chưa thay code vận hành, chưa triển khai Flutter/queue, chưa chọn hướng cuối. Không chạy lại full suite của app cho thay đổi prototype/tài liệu.
- Ghi ngoại lệ V2 giới hạn ở `design/v2` vào AGENTS; các luật production còn nguyên.
### 22/09/2026 — Dọn repo: lịch sử commit, gốc repo, nhánh phát triển

**Đã làm**
- Viết lại toàn bộ lịch sử (124 commit, cả 4 nhánh) để bỏ metadata thừa trong thông điệp commit và đặt lại tên nhánh
  trong merge message. Nội dung không đổi: tree hash của mỗi nhánh trước/sau trùng khít; tác giả, ngày giờ giữ nguyên.
- Dọn gốc repo còn 17 file: Build Spec → `docs/build-spec.md`, `handoff.md` → `docs/handoff.md`, `design/` → `docs/design/`,
  xoá `docs/research-handoff-2026-09-17/` (bản sao của AGENTS/prd/progress + 20 ảnh đã có trong `docs/screenshots`),
  bỏ bản sao luật ở gốc. Sửa toàn bộ liên kết tương đối, kiểm bằng máy: 0 liên kết gãy.
- Viết lại `README.md` — trước đó vẫn là template mặc định của Vite. Nay có mô tả sản phẩm, 5 vai trò, cách chạy, tài
  khoản demo, kiến trúc, lệnh kiểm thử và mục lục tài liệu; bản trên `main` mô tả đúng trạng thái MVP.
- Thêm nhánh `developer` cho việc đang phát triển. CI chạy thêm cho `developer` và `fix/**` (trước chỉ `main`, `feat/**`).
- Nhánh `fix/update-animation` đặt lại trên `main` mới, giữ nguyên tác giả và code; **không gộp** vì còn 6 lỗi TypeScript
  ngay trên nhánh đó (`gravity.ts` 4 chỗ `string | undefined`, `draft-history.ts` thiếu `'GRAVITY_MOVE'` trong
  `CommandType`, `useManualEditor.ts` import không dùng) — hệ quả của việc CI chưa bao nhánh `fix/**`.
- Luật rút ra ghi vào [AGENTS mục 13](../AGENTS.md): danh tính commit, nhánh và CI, bộ mặt repo, không trích mã commit
  trong tài liệu, cách di chuyển file tài liệu, quy trình viết lại lịch sử.

**Kiểm tra**
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **776/776** ✅ trên nhánh đã dọn.
- Sao lưu trước khi viết lại: `loadmaster-fe-backup-20260922.bundle` (24 MB, mọi ref). `.git` 51 MB → 24 MB.

**Việc tiếp theo**
- Cherry-pick 3 commit sửa overlay 3D sang `main` để CI của `main` xanh trở lại.
- Rà lại giọng văn tài liệu ở mục 12, nhật ký và issue; bỏ các mã commit còn trích trong `docs/`.

### 20/09/2026 — Xong đợt 6: nhóm E, F và nghiệm thu (LM-095, LM-096, LM-098 → LM-101)

**Đã làm**
- Chạy lại hai agent bị dừng vì giới hạn phiên: E — LM-096 hồ sơ + đổi mật khẩu (`abd7620`), LM-098 chuông thông báo (`56f51a0`),
  LM-099 Ctrl+K (`b214642`); F — LM-095 bố cục 1.366–1.600 px (`75a7811`), phần còn lại LM-100: tiêu đề tab, E2E so sánh/404,
  ConfirmDialog dùng chung, kho 3D ẩn kiện thiếu (`f48c5e4`, `cf17880`, `d71bfca`). Gộp, giải xung đột `App.tsx` và `vi/en.ts`
  (route `/ho-so` + `titles.profile`), áp đề xuất luật vào AGENTS (`7f6fec4`, `f498c2f`).
- Sửa khi gộp: mở app lúc sáng sớm thì việc "hôm nay" của seed nằm ở tương lai → `seed-shift.ts` lùi mọi mốc giờ seed (`8885b21`).
- LM-101 (`e798428`): E2E `workday.spec.ts` đi một ngày làm việc của 5 vai trò trên một kho. Kịch bản bắt được lỗi thật — toast
  "Đã duyệt" đè nút Duyệt ở header Planner, rê chuột lên thì toast không tắt → `Toaster` đặt dưới header (top 80 px).
- Ảnh bàn giao viết lại: 24 màn × vi/en = 48 ảnh, mỗi màn đăng nhập đúng vai trò, đồng hồ trang 16:00 giờ Việt Nam, trình duyệt
  `--lang` theo ngôn ngữ ảnh. `acceptance.md` mục 5, `handoff.md` viết lại cho đợt 6.

**Kiểm tra**
- `pnpm lint` ✅ · `pnpm build` ✅ · `pnpm test` **776/776** ✅ · `pnpm test:e2e` **80/80** ✅ (15,6 phút) · CI ✅.
- `pnpm test:bench` ✅ — dựng + `evaluateAll` 1.000 kiện p95 33,8 ms (ngân sách 50), `evaluateMove` 1,7 ms, `commitMove` 1,5 ms (ngân sách 8). Lượt đầu chạy ngay sau khi chụp 48 ảnh 3D đo 55,2 ms và đỏ; máy nghỉ chạy lại xanh — engine không đổi từ
  `main` (`git diff main -- src/domain src/services` rỗng), nên đây là nhiễu tải máy, không phải hồi quy.
- Lượt CI đầu (`e798428`) đỏ 4 + 1 flaky dù máy dev xanh 80/80 — CI chậm hơn nên lộ ba lỗi: khoá dòng bảng theo vị trí (menu thao tác
  nhảy sang người khác), overlay debug báo "nghỉ" khi máy dưới 4 FPS (kéo theo `quality-policy` không hạ tier), và hai giả định sai
  trong `i18n-en.spec.ts`. Sửa ở `fc271d3`; hai lỗi đầu có từ trước đợt 6 (CI của `main` cũng đỏ vì lỗi thứ hai).
- Lượt CI thứ tư (`b708c57`) **xanh trọn: 80/80, 19,6 phút, không lần thử lại nào**.
- Lượt CI thứ ba xanh (79 test, 26,3 phút); `admin-users` còn flaky vì cú bấm mở menu thỉnh thoảng không ăn trên runner — E2E bấm lại,
  ghi nợ N-17.
- Lượt CI thứ hai còn ba chỗ test tự cho rằng máy nhanh (bấm khi bộ lọc chưa đáp, cửa sổ lấy mẫu animation tính từ lúc bấm, root
  R3F của canvas cũ) — sửa test ở `342d965`, không đụng mã sản phẩm.
- Lượt E2E đầy đủ đầu tiên 70/72: `admin-users` chờ màn cũ của tài xế (từ LM-087 là `/tai-xe`), `admin-audit` phụ thuộc giờ máy — sửa test.

**Vướng mắc / quyết định mới**
- Ô ngày gốc của trình duyệt hiện định dạng theo ngôn ngữ **trình duyệt**, không theo `?lang` — giữ, ghi ở N-12.
- Thử màn tài xế trên điện thoại thật (D-57) chưa làm — người dùng tự thử.

**Việc tiếp theo**
- Người dùng thử màn tài xế trên điện thoại thật (D-57).
- `main` **giữ nguyên bản MVP** `751fdc8` theo quyết định 20/09 của người dùng; đợt 6 nằm ở `feat/ui-complete` (đã push) cho tới khi
  người dùng duyệt gộp.
- LM-002: contract backend.

### 19–20/09/2026 — Đợt 6: nền dữ liệu, phân quyền và 5 nhóm màn (LM-080 → LM-094, LM-097, LM-073)

**Đã làm**
- Tự làm tuần tự phần nền: LM-080 (tách từ điển), LM-081/082/083 (kho mock: vòng đời chuyến, người dùng + phiên + nhật ký, seed 15 chuyến
  neo theo ngày), LM-084 (phân quyền, 403, quản lý chỉ đọc), LM-073 (E2E kéo kiện vào vật cản — đóng nợ N-1).
- Giao agent theo nhóm, mỗi nhóm một worktree (tối đa 4 chạy cùng lúc): LM-085 bảng dùng chung; A kho + tài xế (LM-086/087); B chuyến
  (LM-088/093/097 + cảnh báo rời form của LM-100); C dashboard + nhật ký + người dùng (LM-090/091/092); D đội xe + Planner (LM-089/094).
  Người điều phối gộp nhánh, giải xung đột (`format.dayMonth` trùng, 4 spec E2E), áp đề xuất luật vào AGENTS.
- Sửa thêm khi gộp: thứ tự giờ seed (xuất phát giao sau khi xếp xong); lỗi hộp thoại người dùng do review độc lập phát hiện (`d52a88b`);
  spec-flow chờ mã xe `VEHICLE-009`.
- Ba agent đợt sau (B, E, F) bị dừng vì chạm giới hạn phiên: B đã commit đủ; E, F chạy lại ngày 20/09.

**Kiểm tra**
- `pnpm lint` ✅ · `tsc -b` ✅ · `pnpm test` 729/729 ✅ (`06a09ed`) · E2E theo nhóm (agent chạy cổng riêng): kho/tài xế 30/30, dashboard/nhật ký/
  người dùng 6/6, đội xe/Planner 31/31 + 27/27, chuyến theo issue. Bộ E2E đầy đủ chạy ở LM-101.

**Vướng mắc / quyết định mới**
- `useListUrlState`: hai thay đổi lọc liên tiếp trước khi router render lại thì lần sau ghi đè lần trước — giao sửa ở LM-100.
- Kho mock chưa kiểm người ghi dỡ hàng có đúng tài xế của chuyến (FE chỉ chặn ở đọc) — backend thật phải kiểm.

**Việc tiếp theo**
- E: LM-096/098/099 · F: LM-095 + phần còn lại LM-100 · rồi LM-101 nghiệm thu.


### 19/09/2026 — Rà soát giao diện, chốt đợt 6

**Đã làm**
- Hỏi đáp chốt phạm vi: bảo vệ SEP490, thước đo 5 vai trò AGENTS mục 1, 2–4 tuần, làm hết P0/P1/P2; giả lập phân quyền, không giả lập lưu bền.
- [Báo cáo rà soát](ui-audit-2026-09-19.md): hiện trạng từng vai trò, 8 lỗi UX trên ảnh 17/09, danh sách thiếu của một web hoàn chỉnh.
- PRD mục 15 (D-40 → D-57); 22 issue LM-080 → LM-101 trong [gói issue](issues/README.md#phase-6--hoàn-thiện-5-vai-trò).
- Git: commit gói bàn giao nghiên cứu (`751fdc8`, bỏ file zip qua `.gitignore`), fast-forward `main` ← `feat/spec-mvp`, mở `feat/ui-complete`, push cả ba nhánh.

**Kiểm tra**
- Chỉ tài liệu, không đổi code.

**Việc tiếp theo**
- Đợt nền tuần tự: LM-080 → LM-085; sau đó đợt màn song song.


### 17/09/2026 — Gói bàn giao cho nhóm nghiên cứu

- Đối chiếu tài liệu rebuild với domain, service, repository/revision và core 3D hiện tại; không sửa code sản phẩm.
- Tạo gói nghiên cứu: prompt, hiện trạng, tài liệu nền và gallery 11 PNG chụp mới.
- Chụp dashboard, cấu hình xe, kiện, thiết lập tối ưu, Planner/view/editor/partial/stale, kho tablet và tài xế/list/3D phone bằng Chromium SwiftShader; không ghi nhận `pageerror` ở các phiên chụp.
- Nêu rõ LM-073, benchmark domain chưa nối CI, khác biệt phân trang/ảo hóa và giới hạn dữ liệu mock. Số đo hiệu năng dùng báo cáo 16/09, không đo lại.
- Kiểm tra tài liệu/ảnh; không chạy full lint/build/test vì chỉ bổ sung gói bàn giao, không đổi app. Không xác nhận lại CI từ xa.

### 16/09/2026 — Xong phase 5: i18n toàn `src/`, nghiệm thu và bàn giao (LM-070 → LM-072)

**Đã làm**
- Cổng i18n (`fa9b798`, TDD): `findHardcodedVietnamese` bỏ chú thích và lỗi lập trình viên, test quét toàn `src/`; lúc bắt đầu còn 510 dòng.
- LM-070 (agent, `38d64e0`): Planner 3D, chuyến, component chung, App — 218 dòng → 0; module thuần trả mã (snap, đo khoảng cách, `describeWhere`), `StopLabel` thay `stopLabel()`; sửa tràn chữ en; E2E `i18n-en` ở 1.440/1.024/390 px.
- LM-071 (agent, `2ff95f3`): kho, người dùng, trang tài liệu, `types/user` — 292 dòng → 0; nút ngôn ngữ 56 px ở kho và tài xế, đổi giữa phiên giữ bước/điểm giao. Gộp xung đột `DataSection`, `CardTableLegendSection`, danh sách `PENDING` với LM-070 bằng tay.
- LM-072: [acceptance.md](acceptance.md) đối chiếu Spec §15 + PRD §12; benchmark cuối; 18 ảnh vi/en (`tests/handoff-screenshots.mjs`); viết lại `handoff.md`; PRD và AGENTS cập nhật; mở LM-073 cho E2E chồng vật cản.

**Kiểm tra**
- pnpm lint: ✅ · pnpm build: ✅ · pnpm test: 520/520 · pnpm test:bench: ✅ (1.000 kiện p95 30,8 ms) · pnpm test:e2e cục bộ: 54/55 và 54/55 ở hai lượt, mỗi lượt đỏ một test khác nhau không tái hiện khi chạy riêng (`warehouse` desktop "addEventListener" 16/16 xanh khi lặp; `ERR_NO_BUFFER_SPACE` là hết socket máy) — chờ CI.

**Vướng mắc / quyết định mới**
- Spec §15 dòng 12 (chồng vật cản) chỉ có test ở seam engine → LM-073.
- `DriverStopPage.dom.test.tsx` đỏ một lần khi chạy cả bộ Vitest, xanh 3/3 khi chạy riêng — theo dõi.

**Việc tiếp theo**
- Báo cáo phase 5 và bàn giao.

### 16/09/2026 — Xong phase 4: kho và tài xế đọc revision đã duyệt, gỡ mock mm (LM-060 → LM-062)

**Đã làm**
- Người dùng chốt: màn điều phối tạm thời chỉ desktop (nút 40 px); luật 56 px áp cho kho, tài xế, Planner — ghi AGENTS mục 5 (`a0e0336`).
- LM-060 (agent, `3bc6795`): `/kho` đọc revision đã duyệt mới nhất (`?chuyen=`, không có thì chuyến đầu tiên có bản duyệt), bước theo `loadingOrder`, khoảng cách cm theo locale, 6 hướng đặt, vật cản gần; trạng thái rỗng, cảnh báo lỗi thời. Gộp có xung đột AGENTS mục 6/7 với LM-061, đã hợp nhất tay.
- LM-061 (agent, `93275bc`): màn tài xế đọc revision đã duyệt, danh sách kiện theo `unloadingOrder`, chuyển điểm giao trong phiên, LIFO domain trong mô phỏng; gỡ `driver.mock.ts`, huy hiệu "chờ đồng bộ", nút gọi không có số.
- LM-062 (`66cd09c`): gỡ `load-plan.mock`, `types/load-plan`, `lib/placement`, `adaptLoadPlan`, `createBenchmarkPlan`, `OperationsToolbar`, `formatDimensions` mm; kiểu viewer sang `viewer3d/viewer-types.ts`.

**Kiểm tra**
- pnpm lint: ✅ · pnpm build: ✅ · pnpm test: 515/515 · pnpm test:e2e: 50/50

**Vướng mắc / quyết định mới**
- Kích thước JS cả phase +6,9 kB (+0,3%) vì màn kho/tài xế mới và từ điển; riêng LM-062 −4,2 kB. Tiêu chí "không tăng" của LM-062 chưa đạt theo nghĩa đen.
- `/kho` bỏ fixture `?debug&packages=N`: hiệu năng 3D ở kho chỉ còn đo trên 132 kiện seed (Planner và tài xế vẫn đo 1.000 kiện).
- Chuỗi cũ của màn kho ("Xác nhận đã xếp", toast bỏ qua) chưa qua từ điển → LM-071.

**Việc tiếp theo**
- Báo cáo phase 4, chờ xác nhận phase 5 (LM-070 → LM-072).

### 16/09/2026 — Xong phase 3: màn luồng Spec (LM-040 → LM-054)

**Đã làm**
- Trips (LM-043 → LM-046, `9e4c54a`): chi tiết chuyến, bảng kiện, panel form kiện, điểm giao ↔ `deliveryStop` đọc/ghi kho mock.
- Dashboard (LM-052, agent, `45abf2f`): số từ kho; gỡ biểu đồ và "so với kỳ trước" không có nguồn (AGENTS mục 6 "Không bịa số").
- Đội xe (LM-040/041, `d7f4d52`): agent bị dừng giữa chừng → commit WIP, người điều phối gộp và sửa.
- Thiết lập tối ưu + chạy job (LM-047/048, `07f0b8f`): request thật, nhóm lỗi đầu vào có link, Worker, huỷ, lỗi service, kết quả một phần.
- Planner + Duyệt (LM-049/050, `b953f61`): header metrics, tab Chỉ số, danh sách Đã xếp có lọc, lọc lý do chưa xếp, chi tiết kiện có tỷ lệ đỡ + ràng buộc; Duyệt qua constraint engine theo draft, banner lỗi thời.
- So sánh revision (LM-051, agent, `90f458c`): thẻ từ revision thật; `?revision=` nay nhận **mã revision** (bản duyệt dùng chung `jobId` với bản nguồn nên mở theo job luôn ra bản duyệt).
- Xem trước 3D xe (LM-042, agent, `3224adf`).
- LM-053 (agent `031f9f5` + `23964cc`, `d15f273`): gỡ nút Cài đặt, "Ghi nhận sai lệch", tab đáy tài xế, `pending-feature.ts`; danh sách chuyến và form tạo/sửa chuyến ghi thật vào kho (trước đó báo thành công giả).
- LM-054 (agent, `84f5ead`): `e2e/spec-flow.spec.ts` 7 test, 6 kịch bản; agent dừng trước khi commit → người điều phối commit, sửa lỗi kiểu, chạy lại. Hai bug tìm được: nút Tối ưu kẹt tắt sau khi sửa dữ liệu; form kiện hiện mã lỗi zod thô.

**Kiểm tra**
- pnpm lint: ✅ · pnpm build: ✅ · pnpm test: 492/492 · pnpm test:e2e: 45/45 (desktop, tablet, phone)

**Vướng mắc / quyết định mới**
- Nút primary các màn dispatcher vẫn 40 px trên tablet → người dùng chốt 16/09/2026: màn điều phối tạm thời chỉ desktop (AGENTS mục 5).
- Màn kho và tài xế vẫn đọc mock mm, chưa đọc revision đã duyệt (phase 4: LM-060 → LM-062).

**Việc tiếp theo**
- Báo cáo phase 3, chờ xác nhận phase 4.

### 15/09/2026 — Xong phase 2: engine 3D sang cm (LM-030 → LM-038, LM-056)

**Đã làm**
- LM-030, LM-031, LM-037 (tự làm) — `f02a540`: Planner đọc revision đã duyệt qua `viewer-api` + Query → `adaptResult` (cm, bất biến, MOCK RESULT); toàn engine/editor/operations sang cm, `SCENE_SCALE = 0.01`; fixture benchmark theo contract Spec; tải trục "Sẽ có sau". Kho/tài xế giữ `LoadPlan` mm qua `adaptLoadPlan` tới LM-060.
- LM-056 (agent) — review, cherry-pick sạch → `b12303b`: `CameraRig` `invalidate()` sau mỗi lệnh camera.
- LM-032, LM-034, LM-035 (tự làm, TDD) — `de12ef7`: `editor-engine` bọc constraint engine của domain (`sync` theo placement hiệu lực, `check` = `evaluateMove`); lỗi chặn, cảnh báo vẫn commit; 6 hướng; snap 5/2 cm + mặt vật cản chịu tải. Test mới bắt được chồng lấn giả thật trong `overlaps` của editor (`100,4 + 120,7`) → so qua `lt`.
- LM-033 (agent, worktree) — review, cherry-pick sạch → `5fbc6ba`: vật cản 2 draw call, hatch vùng dành riêng bằng attribute, bấm xem thông tin, legend + `sr-only`, `?debug&obstacles=0|1|20`.
- LM-036 (agent, worktree) — review, cherry-pick có xung đột (`ViewerPage`, `benchmark.mock`, `SelectedPackagePanel`, từ điển vi/en: gộp cả hai phía; giữ `minSupportRatio 0,8` của LM-035 cùng hoán đổi điểm giao của LM-036) → `66dc2e4`: thứ tự dỡ theo `unloadingOrder`, blocker từ `lifoIssues`, fallback thứ tự suy ra cho `LoadPlan` cũ (tài xế).
- LM-038: spec `viewer-benchmark-cm`, số đo `docs/benchmarks/viewer-cm-2026-09-15.json`, báo cáo `docs/viewer-cm-report.md`.

**Kiểm tra**
- pnpm lint: ✅ · pnpm build: ✅ · pnpm test: 427/427 · pnpm test:e2e: 26/26 + spec benchmark 1/1 · CI phase 1 (`e6a60cd`): ✅
- Draw call 16/25/33 ở 132 → 1.000 kiện, trùng 14/09; vật cản +2; kiểm khi thả 1.000 kiện p95 ≈ 2 ms (trình duyệt).

**Vướng mắc / quyết định mới**
- `ScenePlacement` giữ `position {x,y,z}` + `lengthCm…` thay vì tên trường contract (`xCm`, `placedLengthCm`): editor duyệt theo trục; chỉ nằm trong `viewer3d`.
- Chế độ màu "Theo đơn hàng" → "Theo kiện gốc" (contract không có đơn hàng); bỏ badge bao bì ở panel kiện.
- Blocker hẹp hơn trước: chỉ kiện giao sau nằm hẳn sau mặt sau (D-26); hoạt ảnh dỡ vẫn mờ tại chỗ khi có hộp bất kỳ trên hành lang.
- Còn nợ: ảnh so tỷ lệ `docs/screenshots/scene-first/` (LM-031); seed Planner chưa có vật cản và ca LIFO; đo React Profiler (LM-035).

**Trả nợ sau báo cáo (người dùng hỏi "còn nợ không làm được hả")**
- Ảnh so tỷ lệ: bộ `docs/screenshots/viewer-cm/` (`E2E_SCREENSHOT_DIR`), cùng tỷ lệ và góc với `scene-first/`.
- Seed HD210 thêm hai hốc bánh không chịu tải; mock vẫn xếp 132/132, revision duyệt không issue.
- LM-035: E2E `viewer-editor-renders` đếm React commit bằng hook DevTools giả — 31–34 commit/60 lần di chuyển (nhịp 100 ms); đỏ khi bỏ throttle (68).
- Seed không có ca LIFO là đúng (phương án hợp lệ); ca LIFO ở fixture benchmark.
- Kiểm tra: lint ✅ · build ✅ · test 427/427 · E2E 27 pass + 1 flaky do mình xoá thư mục worktree giữa lúc chạy làm dev server tải lại trang (chạy lại riêng: xanh). Không thao tác file lớn trong repo khi E2E đang chạy.
- Dọn worktree agent.

**Việc tiếp theo**
- Push, chờ CI; chờ người dùng xác nhận trước phase 3.


### 15/09/2026 — Xong phase 1: LM-017 → LM-026, LM-028 (domain, engine + cổng benchmark, mock service, worker, mock repository)

**Đã làm**

- LM-016: chạy benchmark khi máy rảnh (`1b0a8af`) — một lần thả editor **0,47 ms** (p99 0,81); xếp kín 1.000 kiện, 2.000 truy vấn **35,1 ms** (quét cặp 129,9 ms). Chưa đạt ước lượng < 5 ms của issue; ngân sách thật đo ở LM-023, tối ưu đầu tiên nếu cần là thêm trục Z vào khoá ô.
- LM-021 theo TDD (seam `@/domain/metrics`, 9 vòng, 15 test): `computeMetrics` (thể tích không trừ vật cản, phần trăm nhân trước rồi chia, thiếu khối lượng là `throw`), trọng tâm có trọng số (không kiện → vắng trường), `COG_THRESHOLDS` + `checkCenterOfGravity` → `COG_LATERAL` / `COG_HIGH` với `params` qua `roundCm`. Mọi số thực trong test đã kiểm bằng Node.
- LM-017 và LM-018 giao 2 agent chạy song song trong worktree riêng từ `1b0a8af`.
- LM-028 theo TDD (seam `@/lib/i18n`, `@/lib/format`; 6 vòng): `formatIssue` cho đủ 22 mã × vi/en, `switch` vét cạn bằng `never`; 8 câu Spec §13 tái tạo đúng từng chữ; snapshot 31 câu × 2 ngôn ngữ đã đọc duyệt; `Formatter` thêm `widthByHeight`, `list`. Bảng Spec §13 gom về `src/test/spec-13.ts`. `issueField` dời sang LM-041. Thêm luật câu thông báo vào AGENTS.md mục 6.
- LM-018 (agent, TDD 19 test): review code và test, cherry-pick sạch → `31b378e`. `overlapArea2D`/`overlapVolume`, `obstacleIssues`, `createPlacementLayout` (Map + lưới dựng một lần), `supportRatio` (hợp diện tích mặt đỡ, không tính trùng, chặn ở 1), `supportIssues`. Đo tham khảo: `supportIssues` × 1.000 kiện 18,9 ms, gần hết nằm ở `queryBelow` của lưới. Sau gộp: test support dùng chung issue PKG-008 với bảng Spec §13 (`SPEC_13_PKG_008_LOW_SUPPORT`).
- LM-017 (agent, TDD 33 test): review, cherry-pick → `dfe2d5f` (xung đột barrel `constraints/index.ts`). `validateVehicle`, `validatePackages`, `checkDoorClearance`, `checkPayload`, `validateRequest` (sắp error → blockApproval → warning). Khi gộp: đổi tên hàm nội bộ trùng tên `obstacleIssues` → `vehicleObstacleIssues`; `formatIssue` khớp dạng issue thật (nhãn theo đoạn cuối `field` dạng react-hook-form, "0 kg" cho `maxPayloadKg`, chủ ngữ dòng vật cản từ `relatedIds[0]`) — bắt được nhờ test mới chạy validator thật rồi dịch mọi issue (đỏ trước khi sửa). Quy ước chủ thể ghi vào JSDoc `ConstraintIssue`.
- LM-020 giao agent (worktree từ `8dc7418`).
- LM-019 theo TDD (seam `@/domain/constraints`, 12 vòng, 14 test + 2 test dịch câu): `createStackGraph` truyền tải toàn stack theo diện tích tiếp xúc (D-18, ghi rõ là ước tính), vật cản chịu tải nhận phần tải của nó; `stackIssues` (`maxTopLoadKg = 0` là không chịu tải, gồm ca HIGH; `stackable = false` chỉ báo `NOT_STACKABLE`; số tầng theo nhánh dài nhất; vật cản chịu tải bỏ trống giới hạn = không giới hạn, chủ thể ở `relatedIds[0]`); `movePlacement` + `recomputeColumn` tính lại cục bộ — bằng dựng lại toàn bộ sau mỗi lần trong 200 lần dời ngẫu nhiên tất định, test đỏ dưới 2 đột biến. Đo tham khảo 1.000 thùng: dựng đồ thị 17,6 ms, dời một kiện + tính lại p95 0,107 ms. Helper test chung `src/test/placements.ts`.
- LM-022 theo TDD (6 test, chỉ cần đồ thị đỡ LM-019 nên làm song song LM-020): `loadingOrderIssues` (kiện đỡ xếp sau hoặc cùng lượt → cảnh báo), `recomputeOrders` sắp xếp topo có ưu tiên cho cả xếp và dỡ, cờ `recomputedOnFrontend`. Bộ dựng tay bản đầu trùng thứ tự ưu tiên nên không bắt được lỗi bỏ ràng buộc đỡ (lộ ra khi thử đột biến) → thêm cặp ngược ưu tiên. Thuộc tính trên 50 phương án ngẫu nhiên; ca biên chạm mặt. Đo 1.000 kiện: 26,7 ms → 5,1 ms sau khi đổi sang đếm kiện chặn.
- LM-020 (agent, TDD 13 test): review, cherry-pick → `42d97ae` (xung đột barrel). `lifoIssues` trên `PlacementLayout` + `queryRearCorridor`, `coveredArea`/`Rect` lên `@/domain/geometry` (tỷ lệ đỡ LM-018 dùng chung, test LM-018 không đổi). Sửa khi gộp: thiếu điểm giao → `throw` thay vì bỏ qua (bỏ qua giấu vi phạm khỏi bước chặn Duyệt; thống nhất với LM-019/021/022). Agent đo `lifoIssues` × 1.000 ≈ 71–76 ms, gần hết ở `candidates()` của lưới sắp trước khi lọc (lọc trước ≈ 34–38 ms) → xử lý ở LM-023. Thay `potentialBlockers` của viewer dời sang LM-036 (engine 3D còn mm).
- `applyPose`/`PlacementPose`/`PlacementPatch` (`e7c9a2a`) dùng chung cho engine, Duyệt và editor; giao **LM-026 phần 1** (store, revision bất biến, `approveRevision`, seed) cho agent từ commit này — revision seed đã duyệt và `supportRatio`/`constraintWarnings` khi Duyệt chờ LM-023/LM-024.
- **LM-023** theo TDD (11 test + cổng bench): `createConstraintEngine` (`evaluateAll`, `evaluateMove`, `commitMove`, `placements`), `approvalBlockers`. Mã mới `ORIENTATION_NOT_ALLOWED` (23 mã; PRD coi hướng ngoài `effectiveOrientations` là lỗi). Tỷ lệ đỡ dùng cạnh đồ thị đỡ. 500 lần commit ngẫu nhiên = dựng lại (đỏ dưới 3 đột biến; bản đầu có assert rỗng với `Set` và bộ sinh không tạo chồng lấn — đã sửa). Cổng benchmark lần đầu **đỏ thật**: dựng + kiểm 1.000 kiện p95 93,5 ms > 50 ms → lưới lọc trước khi sắp + ô 3 chiều → **32,8 ms**; `evaluateMove` p95 1,9 ms, `commitMove` 1,5 ms (`docs/benchmarks/constraint-engine-2026-09-15.json`). `tsconfig.bench.json` cho file bench cần kiểu Node. Chưa đưa cổng vào CI (runner dao động).
- **LM-024** theo TDD (13 test + property 500 request + bench): `OptimizationService`, `runMockOptimization` thuần tất định, `MockOptimizationService`. Xếp kệ vách/cột/chồng với luật xếp chồng khớp engine (chỉ chồng khi đáy nằm gọn trong kiện đỉnh cột); thứ tự LM-022, `supportRatio`/`constraintWarnings` từ engine LM-023, metrics LM-021. `FAILED` chỉ khi sai schema hoặc lỗi toàn cục (contract không có `warnings`); lỗi riêng kiện → `reasonCode`; `message` = `reasonCode`. Mẫu Spec khớp vị trí/metrics/thứ tự tính tay; property: không placement sai, đủ instance, chạy lại giống hệt (đỏ dưới 2 đột biến); 5 test lý do/FAILED đỏ dưới 3 đột biến. 1.000 instance: xếp đủ, 83,3% thể tích, trung bình 49 ms.
- **LM-025** theo TDD (9 test, worker giả + fake timers): `WorkerOptimizationService` (message có kiểu, tiến trình, huỷ, hết giờ → `TIME_LIMIT_EXCEEDED`, độ trễ tối thiểu 600 ms, luôn `terminate`), `UnavailableOptimizationService` (`SERVICE_UNAVAILABLE`, D-12), `createOptimizationService` (Worker / luồng gọi / lỗi). Đột biến "bỏ terminate khi huỷ" ban đầu lọt → sửa test. Kiểm trên Chromium thật: Worker thật, 1.000 kiện, 601 ms, không long task trên main thread. Phần cuộn/bấm khi đang tối ưu cần UI → LM-048.
- LM-026 phần 1 (agent, TDD 28 test): review, cherry-pick sạch → `2050a7b`. Kho in-memory (xe, chuyến, revision bất biến `REV-NNN`, `isStale` theo nội dung, `approveRevision` tạo bản mới, lỗi có mã), seed 4 xe + chuyến 132 kiện. Người điều phối làm nốt phần hoãn: Duyệt tính lại `supportRatio`/`constraintWarnings` qua `annotatePlacements` (dùng chung với mock service); seed `REV-001` (mock, seed cố định) + `REV-002` đã duyệt.
- **Lỗi thật khi seed:** bản "đã duyệt" đầu tiên có 67 `LIFO_BLOCKED` nên không qua chính `approvalBlockers` — mock đặt chỗ theo `priority` trước điểm giao. Sửa LM-024: `priority` chỉ chọn kiện lên xe (dành tải trọng trước), `enforceLifo` thì đặt chỗ theo điểm giao muộn trước. Seed giờ 132/132 kiện, không issue, duyệt được; test seed khoá lại (đỏ khi bỏ thứ tự LIFO). AGENTS.md cập nhật service và `lib/mock-db`.

**Kiểm tra**

- Sau LM-021: `pnpm lint` ✅ · `pnpm build` ✅ · Vitest **182/182** ✅.
- Sau LM-028: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **244/244** ✅.
- Sau gộp LM-018: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **263/263** ✅.
- Sau gộp LM-017: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **298/298** ✅.
- Sau LM-019: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **314/314** ✅.
- Sau LM-022: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **320/320** ✅.
- Sau gộp LM-020: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **333/333** ✅.
- Sau LM-023: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **347/347** ✅ · `pnpm test:bench` ✅ (cổng ngân sách đạt).
- Sau LM-024: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **360/360** ✅ · bench mock ✅.
- Sau LM-025: `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **369/369** ✅.
- **Cuối phase 1:** `pnpm lint` ✅ · `pnpm build` ✅ · `CI=1` Vitest **403/403** ✅ (51 file) · `pnpm test:bench` **7/7** ✅ (cổng engine và mock đạt).

**Việc tiếp theo**

- Báo cáo phase 1 cho người dùng; chờ xác nhận trước khi sang phase 2 (LM-030 → LM-038, LM-056).
- Còn mở: đưa cổng benchmark vào CI (runner dao động); E2E cuộn/bấm khi đang tối ưu (LM-048); push nhánh để CI chạy lượt phase 1.

### 15/09/2026 — Xong nốt phase 0 (CI thật); phase 1: gộp LM-013, hoàn tất LM-014

**Đã làm**

- Người dùng đồng ý làm tiếp việc dở phase 0. Push `feat/spec-mvp` lên `origin` (lần đầu). CI run `34949580777`: **5/5 job xanh** (E2E 8 phút 16 giây trên Linux).
- Kiểm tra CI báo đúng job: nhánh tạm `feat/ci-verify-red` với một kỳ vọng sai trong `src/lib/utils.test.ts` → run `34950525027` **chỉ Unit đỏ**, Lint/Typecheck/Build xanh, E2E huỷ chủ động; xoá nhánh tạm trên remote và worktree tạm. (Nhánh `ci/...` không kích hoạt CI vì workflow chỉ nghe `main`, `feat/**`.)
- Chốt seam phase 1 theo module: `@/domain/constraints` (LM-017/018/019/020/022/023), `@/domain/metrics` (LM-021), `@/services/optimization` (LM-024/025), `@/lib/mock-db` (LM-026), `@/lib/i18n` (LM-028).
- LM-013 (agent đã làm gần xong trước khi dừng): xem code, commit trong worktree, cherry-pick → `e4cad8c`. `expandPackages`, `nextPackageId`, 16 test.
- LM-014: chép phần agent làm dở (boundary, contract warnings, bảng Spec §13) sang nhánh chính và làm tiếp theo TDD — danh mục đủ 22 mã với kiểu tham số theo từng mã (test kiểu đỏ khi mới 8 mã → xanh); thay kiểu lỗi tạm của LM-013 bằng `ConstraintIssue<'DUPLICATE_INSTANCE_ID'>` (test kiểu đỏ → xanh).
- Dọn toàn bộ worktree agent cũ.

**Kiểm tra**

- `pnpm lint` ✅ · `pnpm build` ✅ · Vitest **167/167** ✅.

**Việc tiếp theo**

- LM-017, LM-018 (agent song song, tối đa 2), LM-021, LM-028 (tự làm); chạy benchmark LM-016 khi máy rảnh.

### 15/09/2026 — Hoàn tất phase 0: LM-005, LM-006; sửa E2E đỏ ngẫu nhiên do Tailwind; mở LM-056

**Đã làm**

- Ba agent LM-005, LM-013, LM-014 bị dừng vì hết giới hạn phiên. Kiểm tra worktree: LM-005 gần xong (23/23 E2E trên nền cũ, thiếu lượt CI); LM-013 gần xong; LM-014 một phần. Giữ nguyên LM-013/014 cho phase 1.
- LM-005: commit phần việc trong worktree (bỏ file chẩn đoán `e2e/zz-login-stress.spec.ts`), cherry-pick vào `feat/spec-mvp` → `6c4287a`. `@playwright/test` 1.61.1, 6 spec / 23 test (desktop 15, tablet 3, phone 5), fixture đăng nhập, `waitCameraSettled`, `tsconfig.e2e.json`, script `test:e2e`, xoá 7 file `.mjs`.
- Lượt `CI=1 pnpm test:e2e` đầu trên nhánh gộp: **22/23**, `viewer-operations-ui` đỏ cả lần thử lại. Chẩn đoán theo skill diagnosing-bugs: không tái hiện khi chạy riêng (1/1, 8/8), chạy chuỗi, xoá cache Vite, đốt CPU 16/16 luồng; tái hiện **2/2** khi sửa `AGENTS.md` giữa lúc chạy; script nghe điều hướng cho thấy trang tải lại toàn phần ~40 ms sau khi sửa, và **không** tải lại khi tắt plugin Tailwind.
- Nguyên nhân: `@import 'tailwindcss'` quét cả gốc repo (`AGENTS.md`, `docs/`, `design/`, `.claude/worktrees/`) và bắt trình duyệt tải lại khi file ngoài app đổi. Sửa: `@import 'tailwindcss' source('.')` (chỉ `src/`); CSS 50.583 → 48.144 byte, 10 class bị bỏ đều không được `src/` dùng. Thêm `.claude/worktrees/` vào `.gitignore`. Sau sửa: cùng vòng phản hồi xanh 2/2; quy tắc ghi vào AGENTS.md mục 4.
- LM-006: `.github/workflows/ci.yml` — `lint`, `typecheck` (`tsc -b`), `unit`, `build` (upload `dist`), `e2e` (cài Chromium kèm deps, upload report khi lỗi). Chưa chạy thật: cần push.
- Mở **LM-056** (phase 2): `CameraRig` không `invalidate` sau lệnh camera không transition khi bật giảm chuyển động → đổi góc nhìn có thể không hiện (agent LM-005 đo được).
- AGENTS.md mục 9: cách chạy E2E, `E2E_PORT`, chờ camera vẽ xong, API bench Vitest 5.

**Kiểm tra trên nhánh gộp (sau sửa Tailwind)**

- `pnpm lint` ✅ · `pnpm build` ✅ · Vitest **142/142** ✅ · `CI=1 pnpm test:e2e` **23/23** ✅ (5,5 phút, không lần thử lại nào).

**Vướng mắc / quyết định mới**

- Không có seam test tự động đúng cho lỗi tải lại trang (cần dev server đang chạy và sửa file trong repo lúc test) — bằng chứng là vòng phản hồi, ghi trong issue LM-005.
- Benchmark LM-016 vẫn chưa chạy (để máy rảnh ở phase 1).

**Việc tiếp theo**

- Người dùng: đồng ý push `feat/spec-mvp` để CI chạy lần đầu (LM-006).
- Phase 1: gộp LM-013 (worktree), hoàn tất LM-014, rồi LM-017, LM-018, LM-019, LM-020, LM-021, LM-022, LM-023, LM-024, LM-025, LM-026, LM-028; chạy benchmark LM-016.

### 15/09/2026 — LM-016 xong (tự làm); gộp LM-012

**Đã làm**

- LM-016 (TDD, seam `@/domain/geometry`): `createSpatialGrid` lưới X–Y 50 cm với `queryAabb`, `queryBelow`, `queryAbove` (tiếp xúc trong `CONTACT_TOLERANCE_CM = 0,2`), `queryRearCorridor`, `excludeId`, `update`, `remove`. 8 vòng red → green, trong đó bắt được lỗi thật: thứ tự kết quả trùng sau `remove` rồi thêm (dùng `order.size`) → bộ đếm chỉ tăng. Test đối chiếu lưới 50 cm với lưới một ô trên 1.000 hộp tất định, trước/sau 200 lần dời; đã chứng minh đỏ khi đăng ký thiếu ô. Commit `f26fb1b`.
- Sửa ngay trong lúc làm: bản đầu `candidates` còn duyệt toàn bộ hộp mỗi truy vấn (O(N), mất tác dụng lưới) → chỉ sắp ứng viên.
- Vitest 5 đổi API benchmark: `bench` lấy từ context của `test` (`bench.compare`, `.run()`), không còn `import { bench } from 'vitest'` → viết `spatial-grid.bench.ts` theo API mới. **Chưa chạy benchmark** để không tranh CPU với E2E của LM-005; số đo bổ sung sau.
- Gộp LM-012 (agent, `5986319` → `32012e5`): `ORIENTATION_CODES`, `orientDimensions`, `UPRIGHT_ORIENTATIONS`/`isUpright`, `effectiveOrientations`, `nextOrientation`, `matchesOrientation`; schema LM-010 dựng từ `ORIENTATION_CODES` và dùng `isUpright`. Giải xung đột barrel `geometry/index.ts` với LM-016.
- Hai test nặng (`viewer-foundation` benchmark 1.000, test đối chiếu lưới) timeout 5 s khi máy tải nặng với 3 agent → đặt timeout 30 s. Chạy lại không tải: xanh.
- AGENTS.md mục 3: `geometry/` thêm "6 hướng đặt, lưới không gian".

**Kiểm tra trên nhánh gộp**

- Vitest: 142/142 ✅ (chạy `--maxWorkers=2`) · `tsc -b`: ✅ · `oxlint`: ✅. `pnpm build` đầy đủ chạy lại khi gộp đợt sau.

**Vướng mắc / quyết định mới**

- LM-012: xoay từ hướng không được phép → về hướng cho phép đầu tiên có kích thước khác. Mã `ORIENTATION_MISMATCH` chờ LM-014/LM-023.
- `queryRearCorridor` bỏ tham số vị trí cửa (không cần vì mọi hộp nằm trong thùng).

### 15/09/2026 — LM-055 xong; giao LM-012, LM-013, LM-014

**Đã làm**

- Chốt seam TDD: LM-012 qua `@/domain/geometry`; LM-013 module mới `@/domain/cargo`; LM-014 module mới `@/domain/constraints`; LM-055 qua `cn()` (unit) + `Button` (RTL).
- Giao 3 agent (worktree từ `99f6f99`, Vitest tối đa 2 worker, không dev server) cho LM-012, LM-013, LM-014. LM-013 dùng đúng tên trường `ConstraintIssue` của LM-014 để gộp không phải đổi tên.
- LM-055 (tự làm, TDD): `lib/utils.ts` khai báo 7 token cỡ chữ `@theme` cho tailwind-merge → nút primary/danger giữ `text-white`, secondary/ghost giữ `text-text`. 1 vòng red → green + 4 test chặn (đã chứng minh đỏ khi bỏ token). Thêm quy tắc vào AGENTS.md mục 4; bỏ chú thích né lỗi trong `LanguageSwitch`.
- Dọn 2 worktree đã gộp (LM-010, LM-027), giữ nhánh.

**Kiểm tra**

- `pnpm test`: 121/121 ✅ · `pnpm lint`: ✅ · `pnpm build`: ✅

**Việc tiếp theo**

- Chờ 4 agent; gộp lần lượt, sau đó LM-016, LM-017, LM-021, LM-028, LM-006.

### 15/09/2026 — Gộp LM-027: hạ tầng i18n; mở LM-055

**Đã làm**

- Agent LM-027 xong (commit `241fa26`, `013b4d4`); xem diff rồi cherry-pick vào `feat/spec-mvp` → `e00b097`, `53a205e`.
- `@/lib/i18n`: `I18nProvider` bọc ngoài cùng, `useT` (key và tham số có kiểu, số nhiều), `useFormat`, `useLocale`; thiếu hoặc thừa key ở `en.ts` là lỗi build (TS2741 / TS2353). Ngôn ngữ: `?lang` → `sessionStorage['loadmaster.ngon-ngu']` → `vi`.
- `@/lib/format`: `createFormatter('vi-VN' | 'en-US')` cho cm, kg, cm³/m³, %, tỷ lệ, ngày, giờ; hàm cũ còn nơi gọi giữ nguyên đầu ra vi-VN.
- `LanguageSwitch` trong nav rail; dịch mẫu nav rail, trang đăng nhập, 404. `AuthError` mang mã thay câu.
- Kiểm chứng lỗi agent phát hiện: `cn()` bỏ `text-white`/`text-text` của nút khi gặp `text-body`/`text-body-lg` → mở **LM-055** (phase 0, 0,5 ngày).

**Kiểm tra trên nhánh gộp**

- `pnpm test`: 116/116 ✅ (92 + 24 mới) · `pnpm lint`: ✅ · `pnpm build`: ✅

**Vướng mắc / quyết định mới**

- Agent chốt: ngày tiếng Anh dạng `Sep 14, 2026`, giờ 24h ở cả hai ngôn ngữ; formatter là object (`format.weight`) thay tên `formatWeight`. Ghi trong issue LM-027.
- Chưa có nút chuyển ngôn ngữ trên trang đăng nhập (chỉ `?lang`), header Planner 3D (LM-070), kho và tài xế (LM-071).

### 15/09/2026 — Gộp LM-010: domain models + zod

**Đã làm**

- Agent LM-010 xong trên nhánh worktree (commit `3900fa2`); xem diff rồi cherry-pick vào `feat/spec-mvp` → `4901e6f`.
- `src/domain/models`: 10 type Spec §6 sinh từ schema, 5 schema zod, `placementToBox`/`obstacleToBox`, 34 mã lỗi `<phạm vi>.<chủ thể>.<quy tắc>`. `src/domain/fixtures/spec-samples.ts` chứa dữ liệu mẫu Spec §12.
- Test type so khớp nguyên văn Spec §6 chạy trong `tsc -b`.
- Chuyển các việc agent hoãn sang issue tương ứng: LM-002 (`null` ở trường tuỳ chọn), LM-012 (dùng chung tập hướng đứng), LM-019 (vật cản chịu tải bỏ trống `maxTopLoadKg`), LM-041 (`.omit` với schema có refinement, lỗi nhiều trường hiện muộn, `name` rỗng).

**Kiểm tra trên nhánh gộp**

- `pnpm test`: 92/92 ✅ (53 + 39 mới, 36 vòng red → green) · `pnpm lint`: ✅ · `pnpm build`: ✅

**Vướng mắc / quyết định mới**

- Agent chốt: trường ngoài hợp đồng bị bỏ khi parse; lỗi trường chặn lỗi nhiều trường (`abort`); vật cản không chịu tải khai `maxTopLoadKg > 0` bị từ chối. Ghi trong issue LM-010, cần nhóm xem lại khi chốt contract (LM-002).
- Máy thiếu RAM khi 3 agent cùng chạy Vite/Vitest; worker Vitest của agent từng crash giữa chừng, agent đã chạy lại với 1 worker để xác nhận.

### 15/09/2026 — Làm song song: LM-003 xong; LM-005, LM-010, LM-027 giao agent

**Đã làm**

- Chốt seam TDD: LM-010 test qua `@/domain/models`, lỗi zod là mã i18n; LM-027 hai seam — `@/lib/format` (unit) và `I18nProvider` qua RTL (dom).
- Giao 3 agent chạy nền, mỗi agent một worktree từ `fa7a68c`: LM-005, LM-010, LM-027. Agent không sửa file này; gộp và cập nhật tiến độ do người điều phối làm.
- LM-003 (tự làm): cập nhật AGENTS.md mục 1, 2, 3, 6, 7, 9, 12 theo PRD — đơn vị cm/kg *(đã điều chỉnh)* kèm trạng thái chuyển đổi, i18n + mã lỗi, ẩn nút chưa hoạt động *(đã điều chỉnh)*, đích tích hợp engine, mock repository + revision, quy trình kiểm thử và làm song song. Luật gom về một nguồn duy nhất: AGENTS.md.

**Kiểm tra**

- LM-003 chỉ sửa tài liệu; không chạy lại test.

**Việc tiếp theo**

- Chờ 3 agent báo cáo → kiểm tra từng nhánh → gộp → chạy lint/build/test trên nhánh gộp → cập nhật tiến độ.

### 14/09/2026 — LM-011 + LM-015: TDD helper số và geometry

**Đã làm** (nhánh `feat/spec-mvp`, theo skill TDD: một test → một cài đặt tối thiểu mỗi vòng)

- Chốt seam: test chỉ import từ `@/domain/geometry`. Chốt quy tắc làm tròn: nửa xa số 0, bù EPSILON, không trả `-0`.
- `src/domain/geometry/`: `numeric.ts` (`EPSILON`, `roundCm`, `roundKg`, `eq`, `lt`, `gt`), `box.ts` (`Box`, `volumeCm3`, `overlaps`), `boundary.ts` (`vehicleBoundaryExcess`, `VehicleInterior`), `index.ts`.
- 14 test trong `geometry.test.ts`, 11 vòng red → green + 3 test chặn hồi quy. Kiểm test chặn hồi quy bằng cách cố ý đổi `<` thành `<=` → test đỏ, rồi khôi phục.
- Chuyển phần chưa có nơi dùng: adapter `PackagePlacement`/`VehicleObstacle → Box` sang LM-010; `overlapArea2D`/`overlapVolume` sang LM-018; bọc mã `EXCEEDS_BOUNDARY` sang LM-014; `lte`/`gte` hoãn; quy ước `roundCm` tại biên + cấm so sánh trực tiếp ghi vào AGENTS ở LM-003.

**Kiểm tra**

- `pnpm test`: 53/53 ✅ (39 cũ + 14 mới) · `pnpm lint`: ✅ · `pnpm build`: ✅

**Vướng mắc / quyết định mới**

- Ba ví dụ dấu phẩy động viết trong issue gốc là sai khi kiểm bằng Node: `45.1 + 45.1 + 45.1 = 135.3`, `0.15 * 10 = 1.5`, và `100.1 + 60.3` trôi **xuống** nên không gây chồng lấn giả. Đã thay bằng ca kiểm chứng thật: `262.45 − 250 = 12.449999…`, `100.4 + 120.7 = 221.10000000000002`, `1.005 * 100 = 100.4999…`. Quy tắc từ nay: mọi ví dụ số trong test phải chạy thử bằng máy trước.
- Công thức thô Spec 7.2 báo chồng lấn giả với toạ độ trôi lên → `overlaps` so qua `lt/gt` EPSILON, vẫn giữ nghĩa chạm mặt không chồng lấn.

**Việc tiếp theo**

- LM-010 → LM-014.

### 14/09/2026 — LM-004: Vitest + React Testing Library

**Đã làm** (nhánh `feat/spec-mvp`)

- LM-004: thêm vitest 5.0.0, @testing-library/react 16.3.3, user-event 14.6.7, jest-dom 7.0.1, @testing-library/dom 10.4.1, jsdom 30.0.1.
- `vitest.config.ts` gộp `vite.config.ts`, hai project `unit` (node) và `dom` (jsdom, `*.dom.test.tsx`); setup `src/test/setup-dom.ts`.
- Script `test`, `test:watch`, `test:bench`.
- Codemod AST chuyển 4 file test cũ: 171 `assert.*` → `expect`, import sang alias `@/`.
- Bỏ đuôi `.ts` trong import của 8 file viewer3d.
- Test RTL mẫu cho `VehicleFormDialog` (form trống báo lỗi; form hợp lệ lưu và đóng).
- `handoff.md` đổi lệnh test sang `pnpm test`.

**Kiểm tra**

- `pnpm test`: 39/39 ✅ (37 cũ + 2 RTL) · `pnpm lint`: ✅ · `pnpm build`: ✅, `dist/` không chứa code test.

**Vướng mắc / quyết định mới**

- Vitest 5 và jest-dom 7 là bản major mới: đã đọc type trong `node_modules` để dùng `test.projects` (thay `environmentMatchGlobs` cũ).
- `vitest bench` thoát mã 1 khi chưa có file bench → thêm `--passWithNoTests`.
- Test RTL mẫu gắn với `VehicleFormDialog` sẽ bị gỡ ở LM-040/041; chuyển test sang form mới lúc đó.

**Việc tiếp theo**

- TDD LM-011 + LM-015.

### 14/09/2026 — LM-001: commit scene-first, tạo nhánh

**Đã làm**

- LM-001: kiểm tra trên working tree trước khi commit, rồi commit đợt scene-first lên `main` — commit `d737f93` (55 file, gồm code viewer3d, test, `AGENTS.md`, `handoff.md`, benchmark JSON, 12 ảnh, báo cáo scene-first).
- Dọn ký tự escape markdown trong `docs/build-spec.md` (không còn `\#`, `\-`, `\~`, `\_`), bỏ khoảng trắng cuối dòng.
- Commit riêng tài liệu kế hoạch: Spec, PRD, gói issue, file tiến độ này.
- Tạo nhánh `feat/spec-mvp` từ `main` cho toàn bộ tích hợp Spec.
- Không commit `.claude/settings.json` (chỉ còn `{"enabledPlugins": {}}` sau khi cài lại plugin ở phạm vi user).

**Kiểm tra** (trước commit `d737f93`)

- `pnpm lint`: ✅ · `pnpm build`: ✅ (còn cảnh báo chunk > 500 kB, `SceneCanvas` 668 kB / 184 kB gzip, như trước) · test TypeScript: 37/37 ✅
- Chưa chạy 7 suite trình duyệt (cần Playwright ngoài repo; sẽ đưa vào repo ở LM-005).

**Quyết định mới**

- Chọn TDD cho phase 1, bắt đầu bằng LM-011 + LM-015 sau khi xong LM-004.

**Việc tiếp theo**

- LM-004 → TDD LM-011 + LM-015.

### 14/09/2026 — Phiên chuẩn bị

**Đã làm**

1. Đọc codebase và toàn bộ tài liệu: `AGENTS.md`, `docs/handoff.md`, 4 báo cáo trong `docs/`. Nắm kiến trúc engine 3D (LoadPlan bất biến → ViewerSceneModel + ViewerDraft → SceneCanvas dùng chung Planner/Kho/Tài xế).
2. Phát hiện ban đầu: `operations/OperationsToolbar.tsx` không còn nơi import; `leftOpen`/`toggleLeft` thừa; một số chỗ lệch luật AGENTS (hardcode hex, nhiều nút primary, nút không làm gì, format số tự nối chuỗi, mock import chéo feature).
3. Cài lại plugin `mattpocock-skills` ở phạm vi **user**: bản cài phạm vi project ghi đường dẫn `E:\` trong khi VS Code chạy ở `e:\`, nên plugin không nạp. `.claude/settings.json` còn lại `{"enabledPlugins": {}}`.
4. Đọc `docs/build-spec.md`, hỏi đáp chốt **22 quyết định** (D-01 → D-22): tích hợp vào repo, chuyển toàn bộ sang cm, contract Spec + view model FE, map vào màn có sẵn, mock repo + TanStack Query, i18n vi/en tự viết, giữ editor với constraint engine, Vitest + RTL, `src/domain` + `src/services`, ẩn nút chưa hoạt động, làm theo phase.
5. Viết [docs/prd.md](prd.md).
6. Chất vấn PRD, chốt thêm **17 quyết định** (D-23 → D-39): vượt tải là cảnh báo; mustLoad chưa xếp chặn Duyệt; tự đồng bộ trường xung đột; định nghĩa LIFO che kín 100%; `roundCm` + EPSILON; mã lỗi + tham số; ngân sách hiệu năng 50 ms / 8 ms với lưới không gian; mock trong Web Worker; revision bất biến; tính lại thứ tự khi Duyệt; quy tắc ID instance; debounce xem trước xe; bảng kiện ảo hoá + panel form; ngưỡng trọng tâm 10% / 50%; So sánh revision; route mới; Playwright + GitHub Actions.
7. Sinh gói **55 issue** trong [docs/issues/](issues/README.md); kiểm tra bằng script: không thiếu phụ thuộc, không vòng lặp, không phụ thuộc phase sau. Đường găng ~26 ngày.
8. Dời hạ tầng i18n (LM-027, LM-028) lên phase 1 vì editor ở phase 2 cần từ điển thông báo lỗi.

**Chưa làm / lưu ý**

- Chưa sửa code ứng dụng. (Commit và dọn escape Spec đã làm ở mục LM-001 phía trên.)
- LM-044 cần thêm dependency `@tanstack/react-virtual`, hoặc dùng phân trang 50 dòng nếu nhóm không đồng ý.

---

## 3. Trạng thái issue

### Phase 0 — Nền tảng

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-001](issues/LM-001-commit-scene-first-tao-nhanh.md) | Commit scene-first, tạo nhánh | ✅ | 14/09/2026 | 14/09/2026 | `d737f93`, nhánh `feat/spec-mvp` |
| [LM-002](issues/LM-002-chot-contract-backend.md) | Chốt contract backend | 🟨 | 14/09/2026 | | Chờ nhóm backend, không chặn |
| [LM-003](issues/LM-003-gom-luat-ve-mot-nguon.md) | Cập nhật AGENTS.md | ✅ | 15/09/2026 | 15/09/2026 | Luật gom về AGENTS.md |
| [LM-004](issues/LM-004-them-vitest-rtl.md) | Vitest + RTL | ✅ | 14/09/2026 | 14/09/2026 | 39/39 test, Vitest 5.0.0 |
| [LM-005](issues/LM-005-them-playwright-test.md) | Playwright | ✅ | 15/09/2026 | 15/09/2026 | `6c4287a`, 23/23 E2E (CI mode); sửa Tailwind `source('.')` |
| [LM-006](issues/LM-006-github-actions-ci.md) | GitHub Actions | ✅ | 15/09/2026 | 15/09/2026 | Run 34949580777 xanh 5/5; job đỏ đúng chỗ đã kiểm |
| [LM-055](issues/LM-055-tailwind-merge-bo-mau-chu.md) | Bug `cn()` bỏ màu chữ nút | ✅ | 15/09/2026 | 15/09/2026 | TDD, 5 test; `/thanh-phan` chờ E2E |

### Phase 1 — Domain, service, dữ liệu, i18n nền

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-010](issues/LM-010-domain-models-schema.md) | Domain models + zod | ✅ | 15/09/2026 | 15/09/2026 | `4901e6f`, 39 test, 34 mã lỗi |
| [LM-011](issues/LM-011-numeric-roundcm-epsilon.md) | `roundCm` + EPSILON | ✅ | 14/09/2026 | 14/09/2026 | TDD 6 test; quy ước AGENTS chờ LM-003 |
| [LM-012](issues/LM-012-orientation-6-huong.md) | 6 hướng đặt | ✅ | 15/09/2026 | 15/09/2026 | `32012e5`, 12 test; mã mismatch → LM-014/023 |
| [LM-013](issues/LM-013-mo-rong-quantity-instance-id.md) | Mở rộng quantity, ID | ✅ | 15/09/2026 | 15/09/2026 | `e4cad8c`, 16 test |
| [LM-014](issues/LM-014-mo-hinh-loi-ma-tham-so.md) | Mô hình lỗi | ✅ | 15/09/2026 | 15/09/2026 | 22 mã, test kiểu; hoàn tất sau khi agent dừng |
| [LM-015](issues/LM-015-geometry-boundary-overlap-volume.md) | Biên, chồng lấn, thể tích | ✅ | 14/09/2026 | 14/09/2026 | TDD 8 test; phần diện tích giao → LM-018 |
| [LM-016](issues/LM-016-luoi-khong-gian.md) | Lưới không gian | ✅ | 15/09/2026 | 15/09/2026 | `f26fb1b`, 9 test; benchmark `1b0a8af`: thả 0,47 ms, xếp kín 35,1 ms |
| [LM-017](issues/LM-017-validation-dau-vao-xe-kien.md) | Validation đầu vào | ✅ | 15/09/2026 | 15/09/2026 | Agent, `dfe2d5f`, 33 test; `field` dạng react-hook-form |
| [LM-018](issues/LM-018-vat-can-va-ty-le-do-day.md) | Vật cản, tỷ lệ đỡ đáy | ✅ | 15/09/2026 | 15/09/2026 | Agent, `31b378e`, 19 test; `PlacementLayout` dùng lại cho LM-019/023 |
| [LM-019](issues/LM-019-tai-xep-chong-toan-stack.md) | Truyền tải toàn stack | ✅ | 15/09/2026 | 15/09/2026 | TDD 14 test; tính lại cục bộ = toàn bộ trên 200 lần dời |
| [LM-020](issues/LM-020-kiem-tra-lifo.md) | Kiểm tra LIFO | ✅ | 15/09/2026 | 15/09/2026 | Agent, `42d97ae`, 13 test; thiếu điểm giao → throw |
| [LM-021](issues/LM-021-metrics-trong-tam.md) | Metrics, trọng tâm | ✅ | 15/09/2026 | 15/09/2026 | TDD 15 test; thể tích không trừ vật cản |
| [LM-022](issues/LM-022-thu-tu-xep-kha-thi.md) | Thứ tự xếp khả thi | ✅ | 15/09/2026 | 15/09/2026 | TDD 6 test; `recomputeOrders` 5,1 ms / 1.000 kiện |
| [LM-023](issues/LM-023-constraint-engine-facade-benchmark.md) | Constraint engine + benchmark | ✅ | 15/09/2026 | 15/09/2026 | TDD 11 test; p95 32,8 ms / 1,9 ms / 1,5 ms; lưới 3 chiều |
| [LM-024](issues/LM-024-mock-optimization-service.md) | MockOptimizationService | ✅ | 15/09/2026 | 15/09/2026 | TDD 13 test + property 500; 1.000 instance 49 ms |
| [LM-025](issues/LM-025-worker-tien-trinh-huy-loi.md) | Web Worker | ✅ | 15/09/2026 | 15/09/2026 | TDD 9 test; Chromium thật không long task; E2E UI → LM-048 |
| [LM-026](issues/LM-026-mock-repository-revision.md) | Mock repository, revision | ✅ | 15/09/2026 | 15/09/2026 | Agent `2050a7b` + seed đã duyệt; 29 test |
| [LM-027](issues/LM-027-ha-tang-i18n.md) | Hạ tầng i18n | ✅ | 15/09/2026 | 15/09/2026 | `e00b097`, `53a205e`, 24 test |
| [LM-028](issues/LM-028-tu-dien-thong-bao-rang-buoc.md) | Thông báo ràng buộc vi/en | ✅ | 15/09/2026 | 15/09/2026 | TDD 59 test, 22 mã × vi/en; `issueField` → LM-041 |

### Phase 2 — Engine 3D sang cm

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-030](issues/LM-030-view-model-scene-cm.md) | View model từ result | ✅ | 15/09/2026 | 15/09/2026 | f02a540 |
| [LM-031](issues/LM-031-engine-doi-don-vi-cm.md) | Engine sang cm | ✅ | 15/09/2026 | 15/09/2026 | f02a540 · ảnh viewer-cm/ |
| [LM-032](issues/LM-032-engine-6-huong-dat.md) | 6 hướng trong engine | ✅ | 15/09/2026 | 15/09/2026 | de12ef7 |
| [LM-033](issues/LM-033-ve-vat-can-3d.md) | Vẽ vật cản | ✅ | 15/09/2026 | 15/09/2026 | 5fbc6ba (agent) |
| [LM-034](issues/LM-034-editor-do-chinh-xac-cm.md) | Editor theo cm | ✅ | 15/09/2026 | 15/09/2026 | de12ef7 · sửa chồng lấn giả do số thực |
| [LM-035](issues/LM-035-editor-dung-constraint-engine.md) | Editor dùng constraint engine | ✅ | 15/09/2026 | 15/09/2026 | de12ef7 · p95 kiểm khi thả ≈ 2 ms |
| [LM-036](issues/LM-036-timeline-thu-tu-service-lifo.md) | Timeline, LIFO | ✅ | 15/09/2026 | 15/09/2026 | 66dc2e4 (agent) |
| [LM-037](issues/LM-037-tai-truc-se-co-sau.md) | Tải trục "Sẽ có sau" | ✅ | 15/09/2026 | 15/09/2026 | f02a540 |
| [LM-038](issues/LM-038-e2e-3d-sang-cm-hieu-nang.md) | E2E 3D, hồi quy hiệu năng | ✅ | 15/09/2026 | 15/09/2026 | báo cáo viewer-cm-report.md |
| [LM-056](issues/LM-056-camera-giam-chuyen-dong-khong-ve-lai.md) | Bug camera khi giảm chuyển động | ✅ | 15/09/2026 | 15/09/2026 | b12303b (agent) |

### Phase 3 — Màn luồng Spec

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-040](issues/LM-040-vehicles-api-danh-sach-doi-xe.md) | Danh sách Đội xe | ✅ | 16/09/2026 | 16/09/2026 | d7f4d52 (agent, người điều phối hoàn tất) |
| [LM-041](issues/LM-041-trang-chi-tiet-xe-form-vat-can.md) | Chi tiết xe, vật cản | ✅ | 16/09/2026 | 16/09/2026 | d7f4d52 |
| [LM-042](issues/LM-042-xem-truoc-3d-xe.md) | Xem trước 3D xe | ✅ | 16/09/2026 | 16/09/2026 | 3224adf (agent) |
| [LM-043](issues/LM-043-trips-packages-api.md) | API chuyến và kiện | ✅ | 16/09/2026 | 16/09/2026 | 9e4c54a |
| [LM-044](issues/LM-044-bang-kien-ao-hoa-tong-hop.md) | Bảng kiện | ✅ | 16/09/2026 | 16/09/2026 | 9e4c54a — phân trang 50 dòng, không thêm react-virtual |
| [LM-045](issues/LM-045-panel-form-kien.md) | Panel form kiện | ✅ | 16/09/2026 | 16/09/2026 | 9e4c54a |
| [LM-046](issues/LM-046-diem-giao-danh-so-lai.md) | Điểm giao ↔ deliveryStop | ✅ | 16/09/2026 | 16/09/2026 | 9e4c54a |
| [LM-047](issues/LM-047-man-thiet-lap-toi-uu.md) | Thiết lập tối ưu | ✅ | 16/09/2026 | 16/09/2026 | 07f0b8f |
| [LM-048](issues/LM-048-chay-job-trang-thai.md) | Chạy job, trạng thái | ✅ | 16/09/2026 | 16/09/2026 | 07f0b8f — không hỏi bỏ draft (draft không qua trang) |
| [LM-049](issues/LM-049-planner-mock-badge-metrics-unplaced.md) | Planner hiển thị kết quả | ✅ | 16/09/2026 | 16/09/2026 | b953f61 |
| [LM-050](issues/LM-050-duyet-phuong-an-revision.md) | Duyệt phương án | ✅ | 16/09/2026 | 16/09/2026 | b953f61 — nút Duyệt ở header vẫn bấm được để đọc lý do chặn |
| [LM-051](issues/LM-051-so-sanh-revision.md) | So sánh revision | ✅ | 16/09/2026 | 16/09/2026 | 90f458c (agent); `?revision=` nhận mã revision |
| [LM-052](issues/LM-052-dashboard-kpi-spec.md) | Dashboard | ✅ | 16/09/2026 | 16/09/2026 | 45abf2f (agent) — gỡ biểu đồ bịa số |
| [LM-053](issues/LM-053-an-nut-chua-hoat-dong.md) | Ẩn nút chưa hoạt động | ✅ | 16/09/2026 | 16/09/2026 | 031f9f5 (agent) + 23964cc danh sách/form chuyến đọc kho |
| [LM-054](issues/LM-054-e2e-luong-spec.md) | E2E luồng Spec | ✅ | 16/09/2026 | 16/09/2026 | 84f5ead (agent) — sửa 2 bug; nút primary dispatcher trên tablet còn 40 px |

### Phase 4 — Kho, tài xế, dọn dẹp

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-060](issues/LM-060-kho-doc-revision-duyet.md) | Kho đọc revision duyệt | ✅ | 16/09/2026 | 16/09/2026 | 3bc6795 (agent) — kho không còn `?debug&packages=N` |
| [LM-061](issues/LM-061-tai-xe-doc-revision-duyet.md) | Tài xế đọc revision duyệt | ✅ | 16/09/2026 | 16/09/2026 | 93275bc (agent) — gỡ nút gọi (chuyến không có số điện thoại) |
| [LM-062](issues/LM-062-go-mock-mm-code-thua.md) | Gỡ mock mm, code thừa | ✅ | 16/09/2026 | 16/09/2026 | 66cd09c — JS −4,2 kB; cả phase +6,9 kB do màn mới |

### Phase 5 — i18n và nghiệm thu

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-070](issues/LM-070-i18n-dot-1-con-lai.md) | i18n đợt 1 phần còn lại | ✅ | 16/09/2026 | 16/09/2026 | 38d64e0 (agent) — 218 dòng → 0; E2E `i18n-en` |
| [LM-071](issues/LM-071-i18n-dot-2.md) | i18n đợt 2 | ✅ | 16/09/2026 | 16/09/2026 | 2ff95f3 (agent) — 292 dòng → 0; nút ngôn ngữ ở kho/tài xế |
| [LM-072](issues/LM-072-nghiem-thu-tai-lieu.md) | Nghiệm thu, bàn giao | ✅ | 16/09/2026 | 16/09/2026 | acceptance.md, handoff.md, benchmark + ảnh vi/en; mở LM-073 |

### Phase 6 — Hoàn thiện 5 vai trò

| ID | Việc | Trạng thái | Bắt đầu | Xong | Ghi chú |
|---|---|---|---|---|---|
| [LM-080](issues/LM-080-tach-tu-dien-theo-nhanh.md) | Tách từ điển theo nhánh | ✅ | 19/09/2026 | 19/09/2026 | 18 nhánh, JSON trước/sau giống hệt |
| [LM-081](issues/LM-081-vong-doi-chuyen-kho-mock.md) | Vòng đời chuyến trong kho | ✅ | 19/09/2026 | 19/09/2026 | 6 pha, khoá sửa, 26 mã lỗi vi/en |
| [LM-082](issues/LM-082-nguoi-dung-phien-nhat-ky.md) | Người dùng, phiên, nhật ký | ✅ | 19/09/2026 | 19/09/2026 | Đăng nhập qua kho, 28 mã nhật ký |
| [LM-083](issues/LM-083-seed-mo-rong-theo-ngay.md) | Seed mở rộng | ✅ | 19/09/2026 | 19/09/2026 | 8 xe, 12 người, 15 chuyến; dựng 0,31 s |
| [LM-084](issues/LM-084-phan-quyen-mock-403.md) | Phân quyền, 403 | ✅ | 19/09/2026 | 19/09/2026 | 13 quyền, 403, quản lý chỉ đọc; E2E 10/10 |
| [LM-085](issues/LM-085-bang-du-lieu-loc-sap-xep-phan-trang.md) | Bảng lọc/sắp xếp/phân trang | ✅ | 19/09/2026 | 19/09/2026 | Agent, `f0d2e87`; +23 test; sửa vòng focus toàn app |
| [LM-086](issues/LM-086-kho-chon-chuyen-tien-do.md) | Kho | ✅ | 19/09/2026 | 19/09/2026 | Agent, `197818d`; danh sách + tiến độ bền trong phiên |
| [LM-087](issues/LM-087-tai-xe-chuyen-cua-toi-tong-ket.md) | Tài xế | ✅ | 19/09/2026 | 19/09/2026 | Agent, `0184351`; chuyến của tôi, sự cố, tổng kết; E2E 30/30 |
| [LM-088](issues/LM-088-chuyen-trang-thai-loc-tien-trinh.md) | Chuyến | ✅ | 19/09/2026 | 20/09/2026 | Agent, `811b73c`; ngày, tài xế, 10 trạng thái, lọc, tiến trình, huỷ |
| [LM-089](issues/LM-089-doi-xe-trang-thai-bao-duong.md) | Đội xe | ✅ | 19/09/2026 | 19/09/2026 | Agent, `c64f7d3`; trạng thái, bảo dưỡng, lọc |
| [LM-090](issues/LM-090-dashboard-bieu-do-xuat-xlsx.md) | Dashboard | ✅ | 19/09/2026 | 19/09/2026 | Agent, `917480c`; lọc kỳ, 5 KPI, 3 biểu đồ, .xlsx |
| [LM-091](issues/LM-091-nhat-ky-he-thong.md) | Nhật ký | ✅ | 19/09/2026 | 19/09/2026 | Agent, `50aed9a`; /nhat-ky có lọc |
| [LM-092](issues/LM-092-nguoi-dung-quan-tri-day-du.md) | Người dùng | ✅ | 19/09/2026 | 19/09/2026 | Agent, `d34acc0`; khoá/xoá/đặt lại mật khẩu, ma trận quyền |
| [LM-093](issues/LM-093-nhap-kien-csv-xlsx.md) | Nhập kiện CSV/.xlsx | ✅ | 19/09/2026 | 20/09/2026 | Agent, `763ef2d`; mẫu, xem trước, lỗi theo dòng |
| [LM-094](issues/LM-094-planner-gon.md) | Planner gọn | ✅ | 19/09/2026 | 19/09/2026 | Agent, `46282cc`; một hàng 56 px từ 1.366 px, không Duyệt khi đã duyệt |
| [LM-095](issues/LM-095-bo-cuc-1366-het-cat-chu.md) | Bố cục 1.366 px | ✅ | 20/09/2026 | 20/09/2026 | Agent, `75a7811`; lưới co giãn, E2E 1.366/1.600 |
| [LM-096](issues/LM-096-ho-so-doi-mat-khau.md) | Hồ sơ | ✅ | 20/09/2026 | 20/09/2026 | Agent, `abd7620`; /ho-so, đổi mật khẩu |
| [LM-097](issues/LM-097-so-do-tuyen-svg.md) | Sơ đồ tuyến | ✅ | 19/09/2026 | 20/09/2026 | Agent, `78fc602`; SVG, trạng thái từng điểm |
| [LM-098](issues/LM-098-chuong-thong-bao.md) | Thông báo | ✅ | 20/09/2026 | 20/09/2026 | Agent, `56f51a0`; chuông theo vai trò |
| [LM-099](issues/LM-099-tim-kiem-toan-cuc.md) | Ctrl+K | ✅ | 20/09/2026 | 20/09/2026 | Agent, `b214642`; tìm chuyến/kiện/xe/người dùng |
| [LM-100](issues/LM-100-hoan-thien-nho.md) | Hoàn thiện nhỏ | ✅ | 19/09/2026 | 20/09/2026 | Agent, `f48c5e4` `cf17880` `d71bfca`; tiêu đề tab, E2E so sánh/404, tồn đọng |
| [LM-073](issues/LM-073-e2e-keo-kien-vao-vat-can.md) | E2E kéo kiện vào vật cản | ✅ | 19/09/2026 | 19/09/2026 | Spec §15 dòng 12 đủ E2E |
| [LM-101](issues/LM-101-nghiem-thu-dot-6.md) | Nghiệm thu đợt 6 | ✅ | 20/09/2026 | 20/09/2026 | `e798428`; E2E một ngày 5 vai trò, 80/80 E2E, 48 ảnh vi/en; điện thoại thật chờ người dùng |

---

## 4. Câu hỏi còn mở

| Ngày mở | Câu hỏi | Người trả lời | Trạng thái |
|---|---|---|---|
| 14/09/2026 | FE gọi thẳng FastAPI hay qua Spring Boot? Ai sở hữu contract? | Nhóm backend | 🟨 Chờ |
| 14/09/2026 | Tên điểm giao, revision, trạng thái duyệt có nằm trong contract? | Nhóm backend | 🟨 Chờ |
| 14/09/2026 | `constraintWarnings` đổi sang mã lỗi có cấu trúc? | Nhóm backend | 🟨 Chờ |
| 14/09/2026 | Ngưỡng trọng tâm 10% ngang / 50% cao có được nghiệp vụ xác nhận? | Nghiệp vụ | 🟨 Chờ |
| 14/09/2026 | Đồng ý thêm `@tanstack/react-virtual` cho bảng kiện? | Nhóm FE | 🟨 Chờ |

## 5. Mẫu mục nhật ký

```markdown
### dd/mm/yyyy — <tên phiên>

**Đã làm**
- LM-0xx: <việc đã xong> — commit `<hash>`

**Kiểm tra**
- pnpm lint: ✅ / ❌ · pnpm build: ✅ / ❌ · pnpm test: x/y · pnpm test:e2e: x/y

**Vướng mắc / quyết định mới**
- ...

**Việc tiếp theo**
- LM-0xx
```
