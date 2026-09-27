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
- [ ] A — Trạng thái chuyến 5 + Đã huỷ, dòng phụ tiến độ kho / lỗi thời; quyền duyệt chuyển sang Quản lý công ty.
- [ ] B — Nền: kho mock cho loại kiện, kiện đăng ký + mã QR, lô hàng + công ty logistics + nhận hàng, đơn hàng, quyết định duyệt (duyệt /
      từ chối / yêu cầu tối ưu lại / đề xuất đổi xe, tách chuyến), lịch sử lần chạy (mục tiêu, thuật toán), loại xe, seal, báo cáo chuyến;
      vai trò Nhà sản xuất, Logistics; route + thanh điều hướng + quyền; component QR (vẽ + quét).

### Giai đoạn 2 (song song, sau khi gộp giai đoạn 1)
- [ ] C — Luồng 1 phía nhà sản xuất: loại kiện, đăng ký kiện (thủ công / theo số lượng / nhập file), in nhãn QR, lô hàng.
- [ ] D — Luồng 1 phía logistics (quét QR nhận hàng) + luồng 2: đơn hàng, gán đơn vào điểm giao, kiểm tra "Sẵn sàng tối ưu".
- [ ] E — Luồng 3 (mục tiêu, thuật toán, lịch sử lần chạy) + luồng 4 (hàng đợi chờ duyệt, thanh quyết định trong Planner).
- [ ] F — Luồng 5 (quét QR khi xếp, seal khi xếp xong, quét QR khi dỡ, báo cáo chuyến) + loại xe.

## Kết quả

*(điền khi xong)*
