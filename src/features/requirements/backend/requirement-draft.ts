import { deadlineParts, MAX_NAME, type RequirementFormValues } from './requirement-form'
import type { RequirementDraft } from './requirement-draft-api'

/**
 * Bản nháp của trợ lý → giá trị của form tạo yêu cầu giao (thuần). Chỉ năm ô: điểm đến (tên + địa chỉ), hạn (ngày + giờ), ưu tiên, số
 * kiện dự kiến, ghi chú. **Không bao giờ** chạm khách hàng, kiện hay toạ độ: khách luôn do người dùng chọn, kiện chọn từ kho kiện, toạ
 * độ cần chọn trên bản đồ. Trường bản nháp để trống (`null`) không có trong kết quả, nên ô đó giữ giá trị đang có.
 */
export type DraftFormValues = Partial<
  Pick<RequirementFormValues, 'destinationName' | 'address' | 'deadlineDate' | 'deadlineTime' | 'priority' | 'expectedPackageCount' | 'note'>
>

/** Cắt theo ký tự (không tách đôi ký tự ngoài BMP) để vừa `max` đơn vị UTF-16 như kiểm tra của form. */
function cut(text: string, max: number): string {
  let out = ''
  for (const char of text) {
    if (out.length + char.length > max) break
    out += char
  }
  return out.trim()
}

export function draftToFormValues(draft: RequirementDraft): DraftFormValues {
  const values: DraftFormValues = {}
  if (draft.destinationText !== null) {
    // Máy chủ chỉ lưu địa chỉ (`destination`); tên điểm đến là nhãn trên màn nên cắt cho vừa ô, địa chỉ giữ nguyên để form tự báo nếu quá dài.
    values.destinationName = cut(draft.destinationText, MAX_NAME)
    values.address = draft.destinationText
  }
  if (draft.deadline !== null) Object.assign(values, deadlineParts(draft.deadline))
  if (draft.priority !== null) values.priority = draft.priority
  if (draft.expectedPackageCount !== null) values.expectedPackageCount = String(draft.expectedPackageCount)
  if (draft.note !== null) values.note = draft.note
  return values
}
