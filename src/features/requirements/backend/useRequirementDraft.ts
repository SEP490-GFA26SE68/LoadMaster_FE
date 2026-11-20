import { useMutation } from '@tanstack/react-query'
import { draftRequirement } from './requirement-draft-api'

/** Đọc nội dung khách gửi thành bản nháp. Không ghi gì nên không làm mới truy vấn nào. */
export function useRequirementDraftMutation() {
  return useMutation({ mutationFn: (text: string) => draftRequirement(text) })
}
