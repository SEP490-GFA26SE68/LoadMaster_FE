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
| Điều phối | Desktop | Đăng ký kiện và in nhãn QR, đưa yêu cầu giao vào chuyến, tạo chuyến, nhập kiện (tay hoặc CSV/.xlsx), chạy tối ưu, xem phương án 3D, chỉnh tay từng kiện, so sánh và **duyệt** |
| Kho | Máy tính bảng | Chọn chuyến đã duyệt, xếp từng kiện theo thứ tự, báo kiện thiếu, xem vị trí kiện trong thùng bằng 3D |
| Tài xế | Điện thoại | Chuyến của tôi, xuất phát, danh sách kiện theo điểm giao, báo sự cố, gọi khách, tổng kết chuyến |
| Quản lý công ty | Desktop | Lập yêu cầu giao (điểm đến, hạn, ưu tiên, kiện từ kho kiện); bảng điều khiển theo kỳ, 5 chỉ số có nguồn, 3 biểu đồ, xuất báo cáo `.xlsx`; xem chuyến và phương án (chỉ đọc) |
| Quản trị hệ thống · Quản trị công ty | Desktop | Người dùng, phân quyền theo ma trận, khoá/mở, đặt lại mật khẩu, nhật ký hệ thống; quản trị hệ thống còn quản lý công ty (tạo công ty kèm quản trị công ty đầu tiên với mật khẩu tạm hiện một lần, sửa kho xuất phát); quản trị công ty còn xem gói cước, số dư credit và lịch sử, đăng ký, huỷ gói, nạp credit qua trang thanh toán giả lập |
| Quản lý nền tảng | Desktop | Danh mục gói cước: thêm, sửa giá và credit, bật/tắt bán, xoá gói không còn công ty dùng |
| Hỗ trợ khách hàng | Desktop | Mọi yêu cầu hỗ trợ của các công ty: lọc theo công ty, loại, trạng thái; trả lời, đổi trạng thái; xem gói, số dư và giao dịch credit gần nhất của công ty đó. Người dùng công ty gửi và theo dõi yêu cầu của mình ở mục "Yêu cầu hỗ trợ" của menu tài khoản, chuông báo khi có trả lời |

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
| Quản trị hệ thống | `quantri@loadmaster.vn` | `/nen-tang/cong-ty` |
| Quản lý nền tảng | `nentang@loadmaster.vn` | `/nen-tang/goi` |
| Hỗ trợ khách hàng | `hotro@loadmaster.vn` | `/ho-tro` |
| Quản trị công ty | `qtcongty@loadmaster.vn` | `/nguoi-dung` |
| Quản lý công ty | `quanly@loadmaster.vn` | `/` |
| Điều phối | `dieuphoi@loadmaster.vn` | `/chuyen` |
| Kho | `kho@loadmaster.vn` | `/kho` |
| Tài xế | `taixe@loadmaster.vn` | `/tai-xe` |

Các tài khoản trên (trừ ba tài khoản nền tảng) thuộc Công ty TNHH Vận tải Long Bình. Công ty thứ hai, Giao nhận Phương Nam, cũng đủ năm
vai trò công ty: `qtcongty@`, `quanly@`, `dieuphoi@`, `taixe@phuongnam.vn` và nhân viên kho `viet.lam@phuongnam.vn`.

Thêm `?lang=en` vào URL để xem bản tiếng Anh.

## Trạng thái

- Các vai trò nối thành một vòng khép kín trên cùng một kho dữ liệu: điều phối thêm kiện hoặc nhập file vào kho kiện, in nhãn QR, tạo đơn từ kiện của kho kiện, lập
  chuyến, gán đơn, chạy tối ưu, chỉnh tay và duyệt → kho quét QR xếp, tài xế quét QR dỡ → báo cáo chuyến. Quản trị hệ thống và quản trị
  công ty quản lý tài khoản và đọc nhật ký. Giao diện theo bản thiết kế V2.3 "Cyan kính".
- Đang chuyển sang 8 vai trò của backend v2: ma trận quyền và tài khoản mẫu đã có đúng tám vai trò và hai công ty logistics; quản trị hệ thống
  không còn quyền vận hành; điều phối viên là người duyệt phương án, quản lý công ty chỉ xem (không còn hàng đợi duyệt). Khách hàng của app là
  công ty logistics: hai vai trò Nhà sản xuất, Logistics của Review 1 cùng lô hàng và luồng quét nhận hàng giữa hai bên đã bỏ; kiện
  thuộc công ty của người tạo. Dữ liệu cách ly theo công ty ngay ở kho: người của Long Bình và Phương Nam không thấy chuyến, xe, kiện,
  yêu cầu giao, người dùng hay nhật ký của nhau, và tài khoản nền tảng không đọc được dữ liệu vận hành. Người dùng và nhật ký chia hai phạm vi: quản
  trị hệ thống thấy mọi công ty, tạo tài khoản nền tảng, khoá / mở khoá / đặt lại mật khẩu mọi người; quản trị công ty tạo, sửa, khoá người
  của công ty mình và đọc nhật ký của công ty mình. Kho mock đã giữ kiện theo mô hình kho kiện của backend (kích thước, loại hàng, điểm đến
  riêng từng kiện; trạng thái ghi theo mốc của chuyến; cờ "Không tìm thấy" / "Hư hỏng"). Màn Kho kiện: điều phối viên thêm kiện, nhập file
  `.csv` / `.xlsx` theo cột của backend (xem trước, có dòng lỗi thì không lưu dòng nào), xem chi tiết kiện kèm mã QR và lịch sử, gỡ cờ; quản lý
  công ty chỉ xem. Nhãn QR in bằng trình duyệt, bốn nhãn mỗi trang A4 (mã QR, mã của bên gửi, loại hàng, số đo, điểm đến, dòng "Hàng dễ
  vỡ"). Màn Tra cứu kiện cho điều phối viên và nhân viên kho: quét hoặc gõ mã để xem kiện, in lại nhãn; kho quét thấy kiện mang cờ "Không
  tìm thấy" thì cờ được gỡ và điều phối viên được báo. Kiện thêm ngay trong chuyến tự thành kiện của kho kiện có mã QR. Yêu cầu giao thay
  đơn hàng của Review 1: quản lý công ty lập yêu cầu (điểm đến, hạn, ưu tiên, kiện chọn từ kho kiện), điều phối viên xem và đưa yêu cầu
  vào điểm giao của chuyến; "Đã giao" và "Giao thiếu" lấy từ trạng thái và cờ của kiện. Một chuyến chở một loại hàng: kiện khác loại
  chỉ vào chuyến khi điều phối viên ghi lý do, thẻ "Phân nhóm hàng" ở chi tiết chuyến nói loại đang khoá, kiện khác loại và cảnh báo xe.
  Điều phối viên tối ưu tuyến ở chi tiết chuyến (mock, MOCK RESULT): thứ tự điểm, giờ đến dự kiến, mức hạn và bản đồ tuyến; chuyến thành
  "Đã lập kế hoạch" khi đã tối ưu tuyến và về "Nháp" khi thêm, bớt điểm giao. Loại xe khai giới hạn tải trục trước / sau và độ lệch
  trọng tâm tối đa (mặc định 15 %), xe lấy giới hạn của loại đang gắn; Planner ước lượng tải trục trước / sau bằng mô hình đòn bẩy
  (MOCK RESULT) cho xe đã khai trục, vượt giới hạn thì không duyệt được, và cảnh báo khi trọng tâm hàng lệch ngang hoặc lệch dọc quá
  ngưỡng của loại xe. Mock xếp hàng theo vùng điểm giao: thùng chia theo tỷ lệ thể tích hàng của từng điểm, điểm giao cuối nằm sâu
  nhất; Planner vẽ dải vùng trên sàn thùng kèm tên điểm và tỷ lệ, đánh dấu kiện nằm ngoài vùng của điểm mình, đếm số lần dỡ-xếp lại
  và hiện mức hạn của từng điểm giao trong hộp Chi tiết. Duyệt bị chặn khi phương án lỗi thời, còn kiện bắt buộc chưa xếp, lỗi ràng
  buộc hoặc vượt tải trục — nút Duyệt nói đúng loại lý do và kho tự từ chối; tuyến có điểm trễ hạn dự kiến thì phải xác nhận rồi mới
  duyệt, điểm sát hạn chỉ hiện trong hộp duyệt. Chuyến Đã lập kế hoạch đổi xe bằng hộp thoại "Đổi xe" (chi tiết chuyến và Planner):
  chỉ chọn được xe sẵn sàng và chở được hàng (kích thước, thể tích, tải trọng, trục), xe khác bị khoá kèm lý do; đổi xe làm phương án
  hiện tại lỗi thời. Mỗi lần chạy tối ưu ra ba phương án A · B · C theo ba mục tiêu — tối đa thể tích, cân bằng tải trục, ít dỡ-xếp
  lại — trong một job; không còn ô chọn mục tiêu hay thuật toán, và chỉ chạy khi chuyến Đã lập kế hoạch. Chạy xong mở màn so sánh của
  lần chạy: mức hạn các điểm giao một lần phía trên, ba thẻ cạnh nhau (thể tích, tải trọng, tải trục so giới hạn, trọng tâm, dỡ-xếp
  lại, kiện chưa xếp, thời gian chạy, ảnh thu nhỏ), giá trị tốt nhất đánh dấu trung tính, mỗi thẻ mở phương án trong Planner để duyệt.
  Xe mẫu khai hai trục với số ước lượng theo cỡ xe (chưa đối chiếu thông số nhà sản xuất) để bản demo có tải trục. Kho và tài xế đối
  chiếu kiện theo ba mức trong một hộp dùng chung: quét QR, gõ mã (mã QR hoặc mã của bên gửi khi nó duy nhất trong chuyến), hoặc xác
  nhận tay kèm lý do khi nhãn không đọc được — mỗi lần đối chiếu ghi cách, người, thời điểm. Xác nhận tay chờ điều phối viên duyệt ở Chi
  tiết chuyến (có chuông); còn chờ thì kho chưa xong xếp, tài xế chưa hoàn tất điểm giao được; bị từ chối thì người gửi được báo và
  phải kiểm lại kiện. Màn chính của kho và tài xế chia chuyến theo trạng thái (kho: đang xếp, chờ soạn, xếp xong, chờ tối ưu lại; tài
  xế: đang vận chuyển, xếp xong, kho đang xếp — chỉ xem, đã giao gần đây). Màn của quản lý nền tảng và hỗ trợ khách hàng làm ở các
  bước sau.
  Xe mẫu khai hai trục với số ước lượng theo cỡ xe (chưa đối chiếu thông số nhà sản xuất) để bản demo có tải trục. Chuyến Đang vận
  chuyển có vị trí xe **mô phỏng** trên bản đồ tuyến ở chi tiết chuyến và giờ đến các điểm chưa giao tính lại từ vị trí (MOCK RESULT);
  điểm giao chuyển sang sát hạn hoặc trễ hạn dự kiến thì điều phối viên nhận thông báo ở chuông và toast. Mở trang kèm `?toc-do=<n>`
  để đồng hồ của kho chạy nhanh n lần khi demo. Màn Giám sát (`/giam-sat`) cho điều phối viên và quản lý công ty: bản đồ các xe đang
  chạy, danh sách chuyến kèm điểm tiếp, giờ đến dự kiến, mức hạn và sự cố, chi tiết từng chuyến (giờ đến từng điểm so hạn, lịch sử vị
  trí, xác nhận tay chờ duyệt). Tài xế và điều phối viên báo sự cố trên đường kèm số phút dự kiến chậm — xe mô phỏng đứng thêm đúng số
  phút đó; điều phối viên tìm tuyến khác (mock, MOCK RESULT; chỉ đổi đường, không đổi thứ tự điểm), đánh dấu đã xử lý hoặc chuyển quản
  lý, và sự cố quá 30 phút chưa xử lý tự chuyển lên. Quản lý công ty ghi đã liên hệ khách và nhập hạn mới ở tab "Sự cố cần xử lý";
  mức hạn tính lại ngay và điều phối viên được báo. Nhận hàng dọc đường (D-88): điều phối viên hoặc tài xế gửi yêu cầu nhận thêm hàng khi
  chuyến đang vận chuyển (điểm nhận, điểm giao, hạn, nhiều dòng kiện); kho kiểm mười luật Đạt / Không đạt ngay khi lưu (luật 4–7 và 10 là
  ước lượng, có nhãn). Điều phối viên duyệt — còn luật không đạt thì phải ghi lý do vượt luật — hoặc từ chối kèm lý do: duyệt xong kiện vào kho
  kiện có mã QR, điểm nhận và điểm giao chèn vào tuyến đang chạy (các điểm cũ giữ thứ tự, phương án đã xếp không lỗi thời) và có nút in
  nhãn gửi bên gửi dán sẵn. Tài xế thấy điểm nhận trong danh sách điểm với biểu tượng và chữ riêng, đối chiếu từng kiện lên xe bằng ba
  mức, rồi dỡ chúng ở điểm giao như kiện thường; kiện nhận chưa có vị trí 3D nên nằm ở danh sách riêng. Màn của quản lý nền tảng và hỗ
  trợ khách hàng làm ở các bước sau.
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
pnpm test          # Vitest: 2.152 test unit + DOM
pnpm test:e2e      # Playwright: 135 test trên desktop / tablet / phone (CI chia bốn phần chạy song song)
pnpm test:bench    # cổng ngân sách hiệu năng của bộ kiểm ràng buộc
```

Lần chạy gần nhất (08/10/2026, nhánh `feat/fe-8-06-07-cong-ty-ho-tro`): lint, kiểm kiểu, 2.152/2.152 unit; sáu spec E2E (công ty, yêu cầu hỗ trợ, phân quyền, nhật ký, người dùng, hồ sơ) xanh, bộ E2E đủ do CI chạy (`.github/workflows/ci.yml`).

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
