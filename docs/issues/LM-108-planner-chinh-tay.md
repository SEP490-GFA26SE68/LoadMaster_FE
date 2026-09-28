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

### Tay kéo theo trục và hút về vị trí gốc (28/09/2026)

Người dùng: kéo thả khó, "kéo một hồi không đưa thùng về chỗ cũ được". Kéo thân kiện là kéo tự do trên cả mặt phẳng kéo (X–Y, X–Z, Y–Z)
nên khó giữ một hướng; ba trục X/Y/Z trên kiện chỉ là đường vẽ.

- **Tay kéo theo trục** (`editor/EditorAxisHandles.tsx`): ba mũi tên X (dọc thùng), Y (ngang thùng), Z (chiều cao) mọc từ mặt kiện đang chọn,
  luôn vẽ đè (không bị kiện khác che), rê chuột thì sáng `--highlight`. Nắm mũi tên nào kiện chỉ chạy theo trục đó: mặt phẳng kéo chứa trục
  và quay về camera, phần dời lấy hình chiếu lên trục; hút mặt chỉ trên trục đó. Kéo thân kiện vẫn như cũ. Vùng nắm là hình trụ bán kính
  4,5 cm không vẽ (`visible={false}` trên vật liệu vẫn nhận raycast); số mesh cố định (6 mesh vẽ + 3 vùng nắm), không theo số kiện. Kiện
  ghim thì mũi tên mờ, không nắm được. Thay `EditorAxes` (đường trục không tương tác).
- **Hút về vị trí gốc**: kéo một trục về trong 6 cm (`EDITOR_RULES.homeSnapCm`) quanh vị trí của kiện trong phương án thì trục đó hút đúng
  vị trí gốc, thắng mọi mặt hút khác (`snapPosition(..., home)`, nguồn hút "Vị trí gốc"). Vẫn còn "Khôi phục kiện này" và hoàn tác.
- Lỗi gặp khi làm: chiếu phần dời lên trục bằng `delta.copy(dir).multiplyScalar(delta.dot(dir))` — `copy` chạy trước nên mọi cú kéo nhảy đúng
  1 đơn vị cảnh (100 cm); tính tích vô hướng trước rồi mới ghi.
- Test: `tests/viewer-editor.test.ts` (+1, hút vị trí gốc); E2E `planner-manual-edit` (+1: nắm mũi tên Z nâng `PKG-004-13` lên, chỉ `z` đổi,
  hạ về gần chỗ cũ thì hút đúng vị trí gốc).
