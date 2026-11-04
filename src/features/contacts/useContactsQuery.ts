import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GuestContactPatch } from '@/lib/mock-db'
import { listContactHandlers, listContactPlanNames, listGuestContacts, updateGuestContact } from './contacts-api'

/** Việc màn làm được theo nguồn dữ liệu (kho mẫu hay backend) — component đọc ở đây, không gọi `-api.ts`. */
export { CONTACTS_SOURCE } from './contacts-api'

/**
 * Hook Query của màn Liên hệ của khách. Khoá dưới `['contacts', …]`, `staleTime: 0` — khách gửi yêu cầu mới ở trang giới thiệu (tab khác
 * cùng trình duyệt), người xử lý khác đổi trạng thái. Mọi lần ghi làm mới `['contacts']` và nhật ký (mỗi lần ghi thêm một sự kiện).
 */
export function useGuestContactsQuery() {
  return useQuery({ queryKey: ['contacts', 'list'], queryFn: listGuestContacts, staleTime: 0 })
}

export function useContactHandlersQuery() {
  return useQuery({ queryKey: ['contacts', 'handlers'], queryFn: listContactHandlers, staleTime: 0 })
}

export function useContactPlanNamesQuery() {
  return useQuery({ queryKey: ['contacts', 'plan-names'], queryFn: listContactPlanNames, staleTime: 0 })
}

export function useUpdateContactMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, patch }: { contactId: string; patch: GuestContactPatch }) => updateGuestContact(contactId, patch),
    onSuccess: () => Promise.all(['contacts', 'audit'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}
