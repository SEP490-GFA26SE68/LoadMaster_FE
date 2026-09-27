---
id: LM-108
title: Planner — điều phối viên chỉnh tay lại được, "Lưu bản chỉnh"; trọng lực khi kéo kiện
phase: V2.3
labels: [viewer3d, editor, rbac]
depends_on: [LM-107]
estimate: 1d
prd: []
---

# LM-108 — Chỉnh tay cho điều phối viên và trọng lực khi kéo kiện

## Vấn đề (28/09/2026)

- Người dùng: "Planner cũ còn kéo thả thùng hàng được, đợt này không thấy xài được nữa". Tái hiện: tài khoản **quản lý công ty** vẫn kéo
  được (test tạm kéo một kiện thật 40 cm); tài khoản **điều phối viên** không có nút Chỉnh sửa — từ LM-104 chỉ người duyệt được chỉnh, nên
  Planner của điều phối là chỉ xem.
- Nhánh `fix/update-animation` (minkoi, 19/09/2026): kéo kiện ở dưới thì kiện ở trên rơi xuống như trọng lực. Nhánh tách từ mã 17/09, chưa
  từng qua CI (lỗi TypeScript, còn `console.log`).

## Quyết định

Người dùng chọn (28/09/2026): **điều phối viên chỉnh tay, quản lý công ty duyệt**. Điều phối viên có lại Chỉnh sửa; khi đã dời / xoay kiện,
nút chính là "Lưu bản chỉnh": lưu thành phương án mới chưa duyệt và đưa vào hàng đợi `/duyet`.

## Kết quả (28/09/2026)

- **Quyền** (`approval/planner-access.ts`): thêm `canEdit` (`plans.approve` hoặc `optimization.run`), `approve: 'save'` và `notice`
  (dòng "Chờ quản lý công ty duyệt. Bạn vẫn chỉnh tay được…" khi điều phối xem bản chưa duyệt, chưa chỉnh gì).
- **Kho**: `saveEditedRevision(revisionId, patches)` — như Duyệt (revision mới, áp patch, tính lại thứ tự và metrics, revision nguồn giữ
  nguyên) nhưng không có `approvedAt`; ghi `editedBy`, nhật ký `revision.edited`; không patch thì `NO_EDITS`. Là bản mới nhất nên vào hàng
  đợi duyệt; người gửi lấy từ `editedBy` khi không có lần chạy.
- **Planner**: `useSaveEditedRevisionMutation`, `useViewerApproval().save` (cùng điều kiện với Duyệt: không lỗi chặn, không lỗi thời), nút
  "Lưu bản chỉnh" (icon lưu, có trạng thái đang lưu), lưu xong mở bản vừa lưu.
- **Trọng lực** (`editor/gravity.ts` viết lại từ nhánh của minkoi, giữ commit gốc của minkoi trong lịch sử): hàm thuần `settleAfterMove` —
  kiện đang tựa lên kiện vừa dời mà mất chỗ đỡ rơi xuống mặt đỡ cao nhất bên dưới (kiện khác, **nóc vật cản** — mới, sàn), dây chuyền lên
  trên, kiện ghim đứng yên, `roundCm`. `commitGravityMove`: kiện dời + kiện rơi là một lệnh `GRAVITY_MOVE`. Hoạt ảnh rơi trong
  `useCargoMatrices`: rơi đủ quãng ở chất lượng cao, quãng ngắn ở chất lượng giảm, bỏ qua kiện đang kéo và lần đổi phương án (bản gốc cắt
  quãng rơi ở 0,5 m và đổi đơn vị bằng `0.01` viết tay — nay dùng `toScene`).
- Test: `gravity.test.ts` (6), `planner-access.test.ts` (6), kho `approve.test.ts` (+2); E2E mới `planner-manual-edit.spec.ts` (điều phối
  nhích kiện dưới ra 60 cm → kiện trên rơi z 50 → 0, hoàn tác một lần trả lại, Lưu bản chỉnh → đứng trong hàng đợi duyệt); `rbac` đổi theo
  quyền mới.
- Kiểm tra: tsc, lint, build sạch; 979 passed unit/DOM; E2E đủ bộ 92/95 lần đầu — 2 test đo thời gian (`viewer-benchmark-cm`, `fleet-vehicle-preview`) chạy riêng xanh, `planner-compact` tablet sửa theo quyền mới rồi 4/4.
