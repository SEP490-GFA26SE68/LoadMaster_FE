# AGENTS.md — LoadMaster Web

Đọc file này trước khi viết bất kỳ dòng code nào trong repo.

File này là **luật sống**: khi thực tế phát triển cho thấy một luật cũ sai hoặc thiếu,
sửa luật ở đây cùng lúc với sửa code, đừng để code và luật lệch nhau. Những mục đánh
dấu *(đã điều chỉnh)* là chỗ hướng đi ban đầu đã đổi và lý do vì sao.

## 1. Sản phẩm

LoadMaster là hệ thống lập kế hoạch và tối ưu chất xếp hàng hóa 3D cho doanh nghiệp vận tải vừa và nhỏ tại Việt Nam. Đây là repo frontend.

Giao diện **tiếng Việt**. Một codebase responsive phục vụ 5 vai trò:

| Vai trò | Thiết bị | Đặc điểm |
|---|---|---|
| Dispatcher | Desktop | Dữ liệu dày, phiên làm việc dài, bảng nhiều cột |
| Warehouse worker | Tablet tại kho | Sáng, đeo găng, nhìn xa, một thao tác mỗi màn |
| Driver | Điện thoại ngoài trời | Nắng, một tay, mạng yếu |
| Manager | Desktop / tablet | Dashboard, biểu đồ, xuất báo cáo |
| Admin | Desktop | Người dùng, phân quyền, nhật ký |

Backend là Spring Boot monolith + PostgreSQL, cộng một Python FastAPI service riêng cho tối ưu. Giao tiếp REST + WebSocket.

**Trạng thái hiện tại:** backend chưa nối. Toàn bộ dữ liệu là mẫu. *(đã điều chỉnh 19/09/2026, LM-084, D-41)* Phân quyền
**giả lập ở FE**: ma trận `features/auth/permissions.ts` (`ROLE_PERMISSIONS`, quản trị toàn quyền, quản lý chỉ đọc + xuất báo cáo);
mỗi nhóm route bọc `RequirePermission` trong `app/App.tsx`, thiếu quyền là màn 403 (`app/ForbiddenPage.tsx`) có nút về màn chính;
thanh điều hướng chỉ hiện mục có quyền; nút ghi ẩn qua `useCan()`. Backend thật phải kiểm lại ở server. Màn mới thêm route vào đúng nhóm quyền;
E2E đăng nhập bằng `login(route, role)`, kịch bản đi qua nhiều vai trò dùng `admin`. *(bổ sung 17/09/2026)* Đăng nhập xong mở
màn của vai trò (`features/auth/landing.ts`: điều phối `/chuyen`, quản lý `/`, kho `/kho`, tài xế `/tai-xe` (LM-087),
quản trị `/nguoi-dung`); liên kết sâu mở trước khi đăng nhập được giữ, gốc `/` thì không. Đăng xuất không ghi nhớ trang đang đứng
(`RequireAuth` chỉ nhớ trang khi người **chưa** đăng nhập mở nó). Nút thoát ở màn kho/tài xế theo vai trò (`features/auth/exit.ts`):
nhân viên kho và tài xế **ở màn danh sách** thì **đăng xuất** (màn chính của họ), **trong phiên xếp / trong chuyến** thì về danh sách
(`/kho`, `/tai-xe`, LM-086/087); điều phối viên và quản trị viên về trang chuyến, vai trò khác về màn chính. *(đã điều chỉnh 26/09/2026, V2.3)* Điều hướng là **thanh ngang 60 px trên dải trời** ở đầu trang (`app/NavRail.tsx`): logo
trái, nhóm mục giữa trên kính tối (`.glass-nav`), tìm nhanh · ngôn ngữ · chuông · tài khoản phải. Mục đang mở có **nền riêng** (cyan
trong + viền + quầng, `--nav-on`) và chữ trắng 600; chỉ báo kính trượt theo con trỏ của V2 đã bỏ (hai lớp phản hồi sẽ chồng nhau).
Ngôn ngữ trên thanh là một nút "VI" mở menu chọn (`components/LanguageMenu.tsx`); màn toàn màn hình kho/tài xế giữ hai nút
`LanguageSwitch` 56 px. Vòng focus trên dải trời là `--cyan-300` (`--primary` không đủ tương phản trên nền tối). Trước 23/09/2026 đây là
rail dọc 96 px; 23/09 đổi sang ngang 56 px nền sáng (V2), 26/09 lên dải trời (V2.3). Thanh còn có nút Tìm nhanh (Ctrl+K / ⌘K, LM-099 — chỉ nhóm có quyền xem; màn toàn màn hình không
có), chuông thông báo (LM-098 — sự kiện nhật ký liên quan vai trò, không gồm việc chính mình làm; "đã đọc" là state giao diện trong tab,
`read-state.ts`) và mục "Hồ sơ cá nhân" trong menu tài khoản (`/ho-so`, LM-096 — mọi người đã đăng nhập; kho/tài xế mở từ nút tài khoản
56 px ở màn chính). Nút hành động trên thanh dùng `components/NavRailButton.tsx`. Thanh ngang chật hơn rail dọc: thêm mục vào đây phải
đo lại ở 1.366 px.

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
  components/           component dùng chung: StatusBadge, DataTable, FilterBar, EmptyState, TripLockBanner, ConfirmDialog,
                        VehicleName (tên xe không bẻ biển số), PageHero (thanh tiêu đề màn), KpiTile (ô số liệu)...
  features/
    auth/               đăng nhập, phiên, RequireAuth
    trips/              danh sách, chi tiết, form chuyến, so sánh phương án
    optimization/       chạy job, theo dõi tiến trình
    viewer3d/           toàn bộ code Three.js, tách biệt hoàn toàn
    warehouse/          luồng xếp hàng ở kho
    driver/             luồng giao hàng
    manager/            dashboard
    fleet/              đội xe
    admin/              người dùng
  lib/                  format, helper, mock dùng chung, api client
    i18n/               từ điển vi/en (mỗi nhánh một file trong vi/, en/ — LM-080), provider, hook (LM-027)
    mock-db/            kho in-memory: xe, chuyến, revision bất biến, Duyệt (LM-026); vòng đời chuyến, tiến độ kho/giao,
                        bảo dưỡng xe (LM-081); người dùng, phiên, nhật ký (LM-082); seed 15 chuyến neo theo ngày (LM-083)
  types/                type dùng từ hai feature trở lên
  domain/               logic nghiệp vụ THUẦN theo Spec — không React, không Three.js
    geometry/           số (roundCm, EPSILON), hộp, chồng lấn, biên thùng, 6 hướng đặt, lưới không gian
    models/             type contract Spec + zod schema (LM-010)
    constraints/        validation và ràng buộc, trả mã lỗi (LM-014 →)
    metrics/            tỷ lệ sử dụng, trọng tâm (LM-021)
    fixtures/           dữ liệu mẫu Spec mục 12
    cargo/              mở rộng quantity thành instance, trùng ID, mã kiện mới (LM-013)
  services/
    optimization/       interface OptimizationService, MockOptimizationService, worker (LM-024 →)
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
`--cyan-*`, `--n-*`, `--amber/violet/green/red-*`, `--sky`, `--card-shadow`, `--glass-dark*`, `--primary-fill-*`, `--on-primary`,
`--font-display`. Khối dưới đây là trạng thái hiện tại. Chỗ nào luật cũ ở mục 4–5 khác V2.3 thì theo các dòng
*(đã điều chỉnh 25/09/2026, V2.3)*. `design/v2.3/tokens/v3.css` chỉ để tham chiếu, không import vào `src/`.

- `@theme` xoá thang mặc định `cyan/amber/violet/green/red` của Tailwind rồi khai lại bằng token: `bg-cyan-600`, `text-red-700`… là màu
  của bảng này, không có bậc nào ngoài bảng (`bg-red-300` không sinh class).
- `font-display` là họ chữ trong `cn()` (`THEME_FONT_FAMILIES` của `lib/utils.ts`); thêm họ chữ mới vào `@theme` thì thêm tên vào đó.
- *(đợt 2, 26/09/2026)* Kính sáng của V2 đã xoá (`--nav-glass`, `--follow-*`, `--tile-*`, `--glass-edge`, `--icon-ring`, `--spring`,
  lớp `.glass-follow`, `.glass-tile`). Còn lại tới đợt của màn dùng chúng: `--chrome` (header trắng của Chi tiết chuyến, So sánh),
  `--hero-icon` (form xe), `--table-head`. Thêm cho dải trời: `--sky-end`, `--sky-h`, `--sky-dots`, `--sky-overlap`, `--sky-text*`,
  `--sky-glass*`, `--nav-on*`, `--brand-mark*`, `--avatar-fill`; cho thành phần: `--scrim`, `--danger-shadow`, `--meter-fill`,
  `--focus-ring`, `--error-ring`. Lớp dùng chung trong `index.css`: `.sky`, `.glass-nav`, `.glass-dark`, utility `sky-overlap`.

```css
:root {
  /* thang gốc: --cyan-50 … --cyan-950 (#E7FCFD → #02222D), --n-0 … --n-900 xám ánh cyan (#FFFFFF → #0E1C21),
     --{amber|violet|green|red}-{50|200|500|700} — giá trị đầy đủ ở src/index.css */

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
     --badge-{neutral|info|cyan|success|warning|danger|violet}-{bg|fg|border}
     violet (V2.3) = đang chạy / đang tối ưu / đã xếp xong */

  /* thang mực bốn cấp (V2): tiêu đề và số quan trọng → dữ liệu vận hành → thông tin phụ → chú thích */
  --ink-strong: var(--n-900);  --ink-1: var(--n-800);  --ink-2: var(--n-700);  --ink-3: var(--n-600);
  /* --ink-3 #52676F: 5,9:1 trên trắng, 5,5:1 trên --app (đo 26/09/2026). Đổi token này thì đo lại cả hai nền. */

  /* năm cặp tint cho nền icon và chip. Nghĩa cố định, không mượn sang mục đích khác:
     blue = vận hành (V2.3: sắc cyan, giữ tên) · green = sẵn sàng/xong · amber = cần chú ý
     violet = phân tích phụ · slate = ngữ cảnh (không phải số đo) */
  --tint-blue: var(--cyan-50);     --tint-blue-fg: var(--cyan-800);
  --tint-green: var(--green-50);   --tint-green-fg: var(--green-700);
  --tint-amber: var(--amber-50);   --tint-amber-fg: var(--amber-700);
  --tint-violet: var(--violet-50); --tint-violet-fg: var(--violet-700);
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
- *(bổ sung 19/09/2026, LM-092)* Hành động bị chặn vì luật (tự khoá mình, quản trị viên cuối…) hiện mờ kèm lý do ngay tại chỗ, không để
  bấm rồi mới báo lỗi; luật cần dữ liệu khác thì để kho trả mã và hiện bằng `dataErrorMessage`.
- Lớp nổi mở từ trong hộp thoại (Select) phải cao hơn lớp phủ Dialog (`z-300`): `SelectContent` dùng `z-400`.
- *(LM-090)* Biểu đồ 2D dùng token qua `var()`: một chuỗi một màu `--primary`, không chú giải; tám màu điểm giao chỉ cho điểm giao;
  lưới `--border` 1 px; nhãn trục micro 11 px, số mono; cột ≤ 24 px bo 4 px đầu dữ liệu; tắt animation; tooltip là lớp nổi (`--e2`).
  Hình `aria-hidden`, có bảng số `sr-only` cùng giá trị (`ChartCard`/`ChartTable`).

### Thành phần V2.3 *(bổ sung 26/09/2026, LM-102)*

Mẫu: `design/v2.3/screens/web/ThanhPhan.jpg`, `TrangThaiChung.jpg`, `MenuToanCuc.jpg`; kiểu gốc `design/v2.3/tokens/v3.css`.

- **Chip trạng thái** (`Badge`, `StatusBadge`): cao 26, chữ `fine` 600, nền tint không viền. **Ngữ pháp chấm**: đặc = trạng thái · vòng
  rỗng = chờ người kế tiếp · quầng = đang chạy · quay = đang tính. Màu kể giai đoạn của chuyến: xám nháp, hổ phách cần bạn (đã tối ưu vòng
  rỗng, cần xem lại có quầng + viền), cyan đã duyệt, **tím** đang chạy (đang tối ưu, đang xếp, đã xếp xong vòng rỗng, đang giao), xanh lá
  hoàn thành, đã huỷ chip xám chữ gạch chấm đỏ. Xe: sẵn sàng xanh lá, đang phục vụ chuyến tím có quầng, bảo dưỡng xám. Tài khoản: đang
  hoạt động xanh lá, đã khoá xám. `shape="tag"` (20 px) cho phiên bản, "Đã chỉnh tay" (tím) và **MOCK RESULT** (`tone="mock"`).
- **Card**: `Card`/`CardHeader`/`CardTitle` (Archivo 650 16/22)/`CardMeta`/`CardActions`; bo 14, `--card-shadow`.
- **Ô nhập** (`components/ui/field-styles.tsx`, dùng chung cho Input, Textarea, Select, SelectField): nhãn `small` 600 `--ink-2`, viền
  `--line-strong`, focus viền `--cyan-500` + quầng `--focus-ring` (thay vòng outline), lỗi viền đỏ + `--error-ring` + icon.
- **Tab**: `TabsList tone="light" | "sky"`, vạch `--cyan-500` / `--cyan-400`; `TabCount` Archivo, `tone="warn"` nền hổ phách.
- **Hộp thoại**: bo 18, lớp phủ `--scrim`; `DialogHeader` có ô icon 40 px theo nghĩa; chân nền `--n-25`, nút dồn phải.
- **Toast**: bo 14, ô icon 30 px tô theo nghĩa; đặt dưới nút hành động của dải trời (`offset` 152).
- **Banner** (`components/Banner.tsx`): info / warning / danger / neutral, hành động dồn phải. `TripLockBanner` dựng trên nó.
- **Trạng thái rỗng**: không khung nét đứt; ô minh hoạ 64 px bo 18 theo nghĩa (`icon` + `tone`), tiêu đề Archivo 700.
- **Menu, Select, tooltip**: menu trắng đặc bo 14 padding 6, mục 36 px, `tone="danger"`; tooltip nền `--cyan-950`.

### Thanh tiêu đề màn *(bổ sung)*

*(bổ sung 19/09/2026, LM-094)* Planner từ 1.366 px: thanh trên 56 px là hàng điều khiển duy nhất (mã chuyến, MOCK RESULT, chỉ số,
Xếp/Dỡ, điểm giao, góc nhìn, trạng thái duyệt, Chỉnh sửa, So sánh, Duyệt); hẹp hơn thì điều khiển mô phỏng và Chỉnh sửa xuống thanh
công cụ riêng (tablet hai hàng 56 px). Thêm gì vào hàng này phải đo lại ở 1.366 px (`e2e/planner-compact.spec.ts`). Thanh công cụ
Planner dùng `PlannerSelect` (Select Radix); ô chọn kiện (tới 1.000 dòng) giữ `<select>` gốc.

*(đã điều chỉnh 26/09/2026, V2.3)* Thanh tiêu đề của màn trong khung ứng dụng nằm trên **dải trời** nên cao theo nội dung (tiêu
đề 32 px + mô tả, thêm tab nếu màn có), không còn cố định 72 px. Chỉ **56px** cho màn xem phương án 3D, vì ở đó chiều cao nhường cho
khung 3D. Header riêng còn nền trắng (Chi tiết chuyến, form xe) giữ 72 px tới đợt của màn đó.

*(đã điều chỉnh 26/09/2026, V2.3)* Màn trong khung ứng dụng dùng `components/PageHero.tsx` trên dải trời (`.sky`): tiêu đề h1
**Archivo 700 32 px rộng 112 %** chữ trắng, `meta` (số đếm, mã) mono `--sky-text-3`, một câu mô tả từ nhánh `pageHero` của từ điển,
hành động ở phải, tab của màn (`TabsList tone="sky"`) truyền làm `children`. Ô icon `.hero-icon` của V2 đã bỏ. Luật của nó:
`<h1>` chỉ chứa chữ tiêu đề (test đọc `exact: true`); hành động nằm trong **cùng** `<header>` với tiêu đề; mô tả ẩn dưới 768 px. Mô
tả nói màn dùng để làm gì — không số, không trạng thái. **Dải trời nối liền**: thanh điều hướng và `PageHero` là hai phần tử cùng lớp
`.sky` gắn ảnh vào khung nhìn (`background-attachment: fixed`), không phải một khối bọc. **Card đè lên dải**: `overlap` kéo dải
thêm `--sky-overlap` (44 px) và vùng cuộn đặt `sky-overlap` (`margin-top: -44px`, lề trên 0). Chỉ bật khi thứ đầu tiên của vùng cuộn
là card nền đặc — chữ trần trên dải trời không đọc được (Bảng điều khiển có dòng chọn kỳ, Hồ sơ có cột thông tin: chưa bật). **Không** dùng `PageHero` khi tiêu đề là dữ liệu (mã chuyến ở Chi tiết chuyến, tên xe ở form xe) hay cho thanh 56 px
của Planner; những màn đó giữ header riêng nhưng vẫn theo lề `px-shell`. Màn mới trong khung ứng dụng dùng `PageHero`.
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
- Nhãn một mã nghiệp vụ dùng ở nhiều màn (loại sự cố giao: `common.deliveryIssueKinds`) khai một lần, không chép vào nhánh của từng màn.
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

### Nút chưa hoạt động *(đã điều chỉnh 15/09/2026, D-20)*

Luật ban đầu cho phép giữ nút chưa nối backend nếu gọi `notifyPendingFeature()` để báo đang
chờ gì. Spec cấm "nút giả" (mục 9.3: Import CSV chỉ hiện khi hoạt động), nên nay:

- **Không hiển thị** nút hay mục menu chưa có chức năng. Không để nút bấm vào mà im lặng,
  không dùng toast báo "đang chờ", không báo thành công giả.
- Ngoại lệ duy nhất: nơi Spec yêu cầu giữ vị trí cho tính năng sau (tải trục) hiển thị nhãn
  **"Sẽ có sau" / "Coming later"** dạng chữ, không bấm được.
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

## 7. Quy tắc riêng cho 3D

### Three.js

- Toàn bộ code Three.js nằm trong `src/features/viewer3d`. Không import `three` ở nơi khác. Màn khác cần 3D thì import component từ `viewer3d` (ví dụ `PositionViewer` cho màn kho).
- Kiện hàng render bằng **InstancedMesh** với `setColorAt`, không tạo mesh riêng từng kiện. Tối đa 3 InstancedMesh cargo: solid, ghost và vỏ viền. Tier low tắt viền chung nhưng giữ viền cảnh báo khi có blocker. Mapping `instanceId ↔ placementId` nằm trong `scene/instance-layout.ts`, không lấy index của danh sách UI để picking. Editor và animation dỡ mỗi loại dùng tối đa một proxy tạm; bánh xe dùng instancing riêng, không nhân theo cargo count.
- *(bổ sung, LM-033)* Vật cản `vehicle.obstacles` vẽ trong `scene/ObstacleInstances.tsx`: đúng 2 draw call dù 1 hay 20 vật cản (một InstancedMesh thân màu `--obstacle`/`--obstacle-bearing` theo `loadBearing` + một `LineSegments` gộp cạnh), 0 vật cản không vẽ gì, không đổ bóng. `RESERVED_ZONE` có vạch nhìn xuyên bằng thuộc tính instance + `discard` trong shader, không thêm vật liệu trong suốt. Bấm vật cản ở chế độ Xem mở `ObstacleCallout`; chế độ Chỉnh sửa tắt raycast vật cản. `SceneCanvas` kèm danh sách `sr-only` mô tả vật cản; chú giải vật cản nằm dưới chú giải điểm giao. Đo bằng `?debug&packages=N&obstacles=0|1|20` (`benchmark-obstacles.mock.ts`).
- Nền Canvas luôn tối, kể cả khi phần còn lại của app sáng.
- Target chức năng/performance là 1.000 placements với draw calls dưới 100, số mesh/nhãn không tăng tuyến tính theo cargo. Đã kiểm tra selection, editor, playback và các vai trò trên Chromium; mục tiêu thiết bị thật: desktop hướng tới 60 FPS, tablet 45–60 FPS, phone khoảng ≥30 FPS bằng quality adaptation. Số đo SwiftShader không phải cam kết FPS trên thiết bị thật. Thêm `?debug` để đo trước khi thêm hiệu ứng.
- Mọi hiệu ứng nâng cao (post-processing, shadow, AO) phải có cờ tắt được trong `usePerformanceFlags`. Ba tier `high / balanced / low` điều khiển DPR, bóng, viền chung, trang trí, bề mặt cargo và animation; viền kiện đang chọn luôn được giữ. Runtime bỏ qua idle, hạ tier sau 3 mẫu chậm (>28 ms), nâng sau 8 mẫu nhanh (<18 ms), cooldown 12 giây. Debug quality override khóa tier để đo lặp lại.
- Animation trong Canvas dùng `@react-spring/three`. Animation ngoài Canvas dùng `motion`.
- Panel điều khiển nổi trên Canvas là React thường đặt đè bằng CSS, không dùng `<Html>` của drei trừ khi cần neo theo vật thể 3D. Lớp phủ phải `pointer-events-none`, chỉ bật lại trên đúng nhóm nút, nếu không nó nuốt thao tác kéo xoay.
- Canvas phải có `touch-action: none` (đã đặt toàn cục trong `index.css`). Thiếu nó thì trên máy tính bảng kéo ngón tay sẽ cuộn trang thay vì xoay mô hình — lỗi chỉ lộ khi chạm tay, dùng chuột không thấy.
- Ba lưu ý về camera: `fitToBox` của camera-controls **xoay camera** về nhìn thẳng mặt gần nhất nên làm mất góc chéo — dùng phép chiếu các góc bao theo preset và tỉ lệ khung; bounding sphere theo chiều dài làm góc cửa sau trên phone quá nhỏ. Resize panel giữ góc người dùng đang xoay. Vách thùng dùng mặt đơn pháp tuyến hướng vào trong để vách gần camera tự biến mất. `PCFSoftShadowMap` đã bị gỡ khỏi three r186, dùng `shadows="percentage"`.

### Foundation engine *(bổ sung)*

- *(đã điều chỉnh, LM-030)* Planner đọc revision của chuyến qua `viewer-api.ts` → `usePlanSourceQuery` → `adaptResult → ViewerSceneModel` (cm, snapshot bất biến): revision đã duyệt mới nhất, hoặc `?revision=<jobId>`. `ScenePlacement` ghép `PackagePlacement` với kiện gốc (`packageId`, tên, điểm giao, `fragilityLevel`); `step = loadingOrder`. *(đã điều chỉnh 19/09/2026, LM-086)* `/kho` là danh sách chuyến đã duyệt chờ xếp / đang xếp; `/kho?chuyen=<mã>` là phiên xếp theo bản duyệt chốt lúc `startLoading`, tiến độ và kiện thiếu ghi vào kho (`recordLoadingStep`), mở lại tiếp tục ở kiện chưa ghi đầu tiên; bản duyệt lỗi thời **không** vào phiên (chờ điều phối duyệt lại). Scene cm đưa cho `PositionViewer`; kho không còn fixture benchmark; kiện báo thiếu (`missingIds`) vẽ như kiện đã gỡ (`unloadedIds` của
`deriveSceneSemantics`), như khung 3D tài xế. *(LM-087)* Tài xế: `/tai-xe` "Chuyến của tôi" (chỉ chuyến có `driverId` là mình, quản trị thấy tất cả); `/tai-xe/diem-giao?chuyen=` đọc qua `driver-api.ts` → `adaptResult`, phương án là bản kho đã xếp (chưa xếp thì bản duyệt mới nhất, chỉ xem); kiện kho báo thiếu không nằm trong danh sách dỡ và mô phỏng; dỡ, sự cố, hoàn tất điểm ghi vào kho. Kết hợp `ViewerDraft` theo ID để sinh effective placements; chỉ commit `{ position?, orientation?, pinned? }`, vị trí draft là cm. Header hiện **MOCK RESULT** khi `isMockResult`. Chế độ màu thứ hai là **theo kiện gốc** (`packageId`) vì contract không có đơn hàng; `packaging` của kết quả là một kiểu trung tính.
- Kích thước placement **đã áp orientation**. Xoay luôn áp mã đích lên kích thước danh nghĩa `baseDimensionsById` (lấy từ `CargoPackage`), không đảo ngược kích thước đã xoay (`orientedSize` trong `scene-input.ts`). Xoay giữ nguyên góc vị trí của kiện.
- Cả ba vai trò dùng chung `SceneCanvas` với `frameloop="demand"`. CameraControls tự invalidate khi chuyển động; mọi thay đổi buffer imperative phải gọi invalidate. Spring chỉ ghi ma trận/proxy kiện đang chạy, không đưa state từng frame qua React.
- `frustumCulled={false}` không loại bỏ nhu cầu bounds của **raycast**. Cargo dùng sphere bao toàn bộ effective geometry và quãng animation, cập nhật khi geometry đổi. Không tính lại `computeBoundingSphere()` trong animation/step/slice path; cập nhật màu không ghi lại ma trận.
- Dữ liệu đo riêng trong `features/viewer3d/benchmark.mock.ts` (`createBenchmarkInput`: request + result đúng contract Spec, cm; tài xế dùng `createBenchmarkInput`): `?debug&packages=132|300|500|1000`, có thể thêm `&quality=high|balanced|low`. Không đổi mock nghiệp vụ và không kích hoạt benchmark khi thiếu `debug`. Đây là fixture renderer có khe hở, không phải phương án đã xác nhận ổn định chất xếp.
- Debug chỉ quan sát: FPS khi scene chuyển động, draw calls, tam giác, số kiện, DPR và tier. Khi nghỉ hiển thị trạng thái nghỉ; không tự invalidate để đo FPS. *(đã điều chỉnh 20/09/2026, LM-101)* "Nghỉ" là **demand loop đã dừng** — frame cuối không xin frame tiếp — rồi lặng 250 ms (`scene/perf-idle.ts`), không phải "lâu rồi chưa vẽ": máy yếu vẽ 2–3 FPS thì frame nào cũng cách nhau hơn 250 ms, lấy khoảng lặng làm chuẩn sẽ báo nghỉ giữa lúc scene đang chạy, giấu mất FPS và làm `quality-policy` (bỏ qua mẫu nghỉ) không bao giờ hạ tier trên đúng máy cần hạ. Chưa nâng mục tiêu FPS trên thiết bị thật chỉ dựa vào số đo Chromium phần mềm.
- Low tier dùng DPR 0,5 và vật liệu cargo Lambert sau phép đo kéo camera 1.000 kiện trên SwiftShader; giữ nguyên picking và nhãn HTML. Balanced/high giữ Standard. Phần 3D mềm hơn là trade-off có chủ ý để ưu tiên tương tác. Không suy diễn kết quả này thành cam kết FPS trên mọi thiết bị hoặc mọi tier.

### Manual editor *(bổ sung)*

- Planner có chế độ Xem/Chỉnh sửa. Chỉ kiện đang chọn dùng một proxy mesh; instance tương ứng được ẩn theo ID. Lưới sàn và chỉ dẫn trục có số draw call cố định.
- Kéo dùng pointer capture, ref và cập nhật Three imperative; chỉ commit một lệnh khi thả hợp lệ. Trong gesture tạm ngưng camera và raycast instances, khôi phục khi thả/hủy/unmount. Không đưa pointer position qua React mỗi frame.
- Snapping dùng cm trong `viewer3d/editor`: lưới 5 cm, ngưỡng hút 2 cm, hút cả mặt vật cản chịu tải (không hút vật cản không chịu tải), so qua `eq/lt/gt`, vị trí commit qua `roundCm`. Nút nudge đi đúng 1/5/10 cm (mặc định 1); snapping dùng khi kéo hoặc bấm Căn vị trí. Xoay chỉ vòng qua `effectiveOrientations` của kiện (6 mã Spec), không xoay quaternion tự do.
- *(đã điều chỉnh, LM-035)* Tính hợp lệ khi kéo/thả/xoay/nudge/căn/khôi phục do constraint engine của domain quyết định (`editor/editor-engine.ts`, dựng một lần mỗi snapshot, `sync` theo placement hiệu lực trước mỗi lần kiểm nên undo/redo/reset không lệch): issue `error` dính tới kiện (chủ thể hoặc `relatedIds`) chặn commit, `warning` vẫn commit; câu qua `formatIssue`. Issue toàn phương án (trọng tâm) không chặn thao tác. Đo Node: snap + sync + kiểm ở 1.000 kiện p95 ≈ 2,7 ms.
- Lịch sử giữ patch trước/sau theo ID, tối đa 200 lệnh, không snapshot placements mỗi lần di chuột. Ghim khóa move/rotate cho đến khi bỏ ghim. Reset mọi chỉnh sửa cần dialog; reset riêng bị chặn nếu vị trí gốc đang bị kiện khác chiếm.
- Không tạo placement từ UnplacedPackage, không lưu draft qua phiên/trang và không coi kiểm tra frontend là kết quả tối ưu authoritative.

### Operations và scene dùng chung *(bổ sung)*

- `operations/scene-semantics.ts` tách loaded/current/next/future/removed khỏi renderer. Planner, `PositionViewer` (kho) và `DriverCargoViewer` cùng dùng `SceneCanvas`; panel và workflow nằm ở wrapper. Không thêm engine cho từng vai trò.
- *(đã điều chỉnh, LM-036)* Loading lấy `placement.step` (= `loadingOrder`); unloading lấy `unloadingOrder` của kết quả qua `unloadSequence` (`operations/unloading.ts`), nhãn "Thứ tự dỡ" không kèm "gợi ý"; revision `ordersRecomputed` hiện thêm câu "tính lại ở FE". Màn tài xế (LM-061) dùng `unloadingOrder` của revision đã duyệt cho cả danh sách kiện của điểm giao lẫn mô phỏng, không có chữ "gợi ý". Nhánh thứ tự suy ra (stop tăng, cao trước, gần cửa trước, nhãn "gợi ý") chỉ còn làm dự phòng khi kết quả thiếu `unloadingOrder`; hiện không màn nào dùng tới. Stop-order consistency không chứng minh unload accessibility.
- Blocker là `lifoIssues` của domain qua `createLifoIndex`: chỉ kiện giao **muộn hơn** nằm hẳn sau mặt sau; kiện đã dỡ/đang ẩn gỡ khỏi lưới (`grid.remove`), tua lùi thì thêm lại; kiện chắn sắp theo x trước khi callout. `LIFO_BLOCKED` dừng mô phỏng và giữ target; `LIFO_PARTIAL` chỉ đánh dấu. Duyệt đếm hai mã này, không khẳng định dỡ được thực tế. Không tính người, xe nâng, clearance hay xoay lúc dỡ. Riêng hình ảnh dỡ (`UnloadMotion`) dùng `corridor` — mọi kiện còn lại trên hành lang thẳng, bất kể điểm giao — để không trượt xuyên kiện. Fixture benchmark có đúng một cặp kiện đổi điểm giao tạo ca `LIFO_BLOCKED` cho browser suite; seed đã duyệt không có ca LIFO.
- CoM là **tâm khối lượng hàng** đã xếp/còn lại, không phải toàn xe. *(đã điều chỉnh, LM-037)* Tải trục không hiện số nào: panel giữ chỗ với nhãn "Sẽ có sau" và chỉ liệt kê cấu hình `vehicle.axles` nếu có (Spec 7.10); Duyệt không kiểm tải trục. Cabin, bánh và khung gầm là mô hình minh họa, không phải axle geometry. *(bổ sung 17/09/2026)* Vị trí trục lấy `vehicle.axles[].positionXCm` khi xe có khai báo (`scene/truck-layout.ts`: trục đầu là cầu dẫn hướng bánh đơn, các trục sau bánh đôi), không có thì dùng vị trí minh hoạ; vẫn không tính tải trục.
- Chi tiết xe gộp geometry theo vật liệu; mọi bánh (bánh đôi cầu sau) dùng một InstancedMesh, một draw. *(bổ sung 17/09/2026)* Khung gầm chi tiết (`scene/truck-chassis.ts`: khung sườn chữ C, dầm ngang, trục, vi sai, nhíp, giảm chấn, các-đăng, bình nhiên liệu/hơi, ắc quy, ống xả, lốp dự phòng, chắn bùn, gầm thùng) gộp vào cùng hình học màu theo đỉnh của `vehicle-details` — không thêm draw call. Camera xoay được xuống dưới gầm (`maxPolarAngle` gần π) và có góc nhìn "Gầm xe" (`gam-xe`, tâm nhìn hạ xuống khung sườn); đèn yếu từ dưới giữ khung gầm không đen. Màn kho không có góc gầm xe. Cargo dùng atlas trung tính chung cho carton/pallet/crate qua thuộc tính instance, không phải nhãn hướng đặt. Low tắt chi tiết phụ; không tắt cues nghiệp vụ. Khi gặp `LIFO_BLOCKED`, playback dỡ tạm dừng và giữ target. Kiện còn vật trên hành lang thẳng (người dùng bỏ qua bước, hoặc bị che một phần) mờ tại chỗ; không dịch chuyển xuyên kiện khác. Reduced motion không dịch chuyển lớn; hoàn tất phải trở lại idle.
- Timeline dùng ô cao bằng nhau, 8–64 bins theo chiều rộng, slider giữ toàn bộ bước. Bản đồ điểm giao mặc định tắt; geometry nằm hoàn toàn trong mép sàn thùng (helper `operations/stop-map.ts`), depth test bình thường. Tính từ phân bố thể tích thực, giữ nhiều màu khi stop xen kẽ. Không đặt ribbon trên thân/gầm hoặc bên ngoài xe. Màu phải có số/tên điểm trong panel hoặc nhãn.
- *(bổ sung 19/09/2026, LM-094)* Bản đã duyệt chưa có dời/xoay: không có nút Duyệt, hiện "Đã duyệt lúc HH:mm dd/MM"; có thì "Duyệt bản chỉnh".
  Lý do chặn Duyệt ở tooltip + `aria-describedby` của nút, không in ở thanh. Pha chuyến khác `planning` hoặc thiếu `plans.approve`: không
  Chỉnh sửa, không Duyệt, một dòng lý do (`viewer.lock`). Hộp thông tin chỉ mở từ nút "Chi tiết / Hiển thị" ở góc khung 3D và thẻ kiện.
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
- Tải trục không hiện số khi backend chưa trả dữ liệu tin cậy: nhãn "Sẽ có sau" (LM-037, Spec 7.10).
- Mock optimization chạy trong Web Worker, không chặn main thread (LM-025, D-30).

Khi làm một issue trong nhóm này, sửa luật tương ứng ở các mục phía trên cùng lúc với code.

### Ảnh xem trước tĩnh dùng SVG, không dùng Three.js *(bổ sung)*

Ảnh nhỏ, không xoay được thì vẽ bằng SVG đẳng cự qua `lib/isometric.ts` — nhẹ hơn
nhiều và không kéo Three.js vào chunk. Đang dùng ở: xem trước trong modal tối ưu,
ảnh thu nhỏ màn so sánh phương án, hình minh hoạ hướng đặt kiện ở kho, skeleton lúc
đang tải Three.js, hình minh hoạ màn đăng nhập và sơ đồ tuyến ở chi tiết chuyến (`trips/RouteDiagram.tsx`, LM-097).

Chỉ dùng Three.js khi người dùng **cần xoay hoặc bấm vào vật thể**.

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

*(đã điều chỉnh 19/09/2026)* Không còn màn nào giữ dữ liệu nghiệp vụ ở `useState`: Đội xe (LM-040), Người dùng (LM-092, `users-api.ts` →
`useUsersQuery` + mutation), Nhật ký (`audit-api.ts`), kho và tài xế (LM-086/087) đều đọc/ghi kho mock qua Query. Trạng thái xe đọc
`useVehicleStatesQuery` (`['vehicles', 'states']`, `staleTime: 0` vì pha chuyến đổi ở màn khác); ghi bảo dưỡng vô hiệu hoá `['vehicles']`.

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
- Kết quả là **revision bất biến** theo `jobId`. Duyệt tạo revision approved mới; sửa xe/kiện sau
  khi tối ưu làm revision lỗi thời và chặn Duyệt. Kho và tài xế chỉ đọc revision đã duyệt.
- *(LM-088)* Chi tiết chuyến chỉ cho sửa khi `can('trips.edit') && phase === 'planning'`; form sửa chuyến mở ở `planning`, `loading`,
  `loaded` (hai pha sau khoá xe và điểm giao). Lý do khoá hiện bằng `TripLockBanner` (chi tiết chuyến, Thiết lập tối ưu). Hộp thoại mở từ
  mục `DropdownMenu` dùng `modal={false}` cho menu để focus về đúng hộp thoại.
- *(bổ sung 19/09/2026, LM-081 → LM-083)* Kho lưu **pha** chuyến `planning → loading → loaded → delivering → completed` (+ `cancelled`);
  trạng thái hiển thị lấy qua `tripStatus(trip, revisions)` (pha `planning` vẫn suy từ revision). Từ `loading` trở đi xe/điểm giao/kiện,
  tối ưu và Duyệt bị từ chối `TRIP_LOCKED`. Tiến độ kho (`loading.steps`) và giao (`delivery.stops`, `issues`) chỉ ghi qua hàm vận hành
  của kho (`startLoading`…`completeStop`). Bảo dưỡng xe lưu ngoài `VehicleConfig` (`listVehicleStates`, D-04).
- Người dùng và mật khẩu nằm trong kho; kho giữ **phiên** như cookie server (`authenticate`, `restoreSession`) và mọi hàm ghi thêm
  một sự kiện nhật ký `{ action, actorId, target, params }` — không lưu câu chữ, UI dịch nhánh `audit`. Lỗi của kho (`MockDbError`)
  hiện cho người dùng qua `dataErrorMessage(error, t)` (nhánh `dataErrors`, key trùng mã).
- Seed neo theo ngày (D-44): `getMockDb()` neo hôm nay giờ Việt Nam, dưới Vitest và `createMockDb()` mặc định neo `SEED_ANCHOR_DATE`
  (14/09/2026) để test tất định. Chuyến chính `TRIP-2026-0914` luôn đứng đầu `listTrips` và giữ `REV-001`/`REV-002`; test so số
  của seed (tổng kiện, số xe…) phải cập nhật khi đổi `seed-trips.ts`. Dựng seed ≈ 0,3 s một lần mỗi ngày neo.
  Mở app sớm hơn việc "hôm nay" muộn nhất của seed thì mọi mốc giờ seed lùi cùng một khoảng (`seed-shift.ts`): lịch sử không có sự kiện
  ở tương lai, sự kiện mới luôn nằm trên sự kiện seed; ngày chạy không đổi.
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
  overlay debug có thể báo nghỉ sớm. CI: `.github/workflows/ci.yml` (LM-006).
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
