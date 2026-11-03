import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GuestContact, GuestContactPatch } from '@/lib/mock-db'
import {
  forwardContactToTrialRequest,
  listContactHandlers,
  listContactPlanNames,
  listGuestContacts,
  replyGuestContact,
  updateGuestContact,
} from './contacts-api'

/**
 * Hook Query của màn Liên hệ của khách. Khoá dưới `['contacts', …]`, `staleTime: 0` — khách gửi yêu cầu mới ở trang giới thiệu (tab khác
 * cùng trình duyệt), người xử lý khác đổi trạng thái. Mọi lần ghi làm mới `['contacts']` và nhật ký (mỗi lần ghi thêm một sự kiện).
 */
export function useGuestContactsQuery() {
  return useQuery({ queryKey: ['contacts', 'list'], queryFn: () => listGuestContacts(), staleTime: 0 })
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

export function useReplyContactMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ contactId, subject, message }: { contactId: string; subject: string; message: string }) =>
      replyGuestContact(contactId, subject, message),
    onSuccess: () => Promise.all(['contacts', 'audit'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}

export function useForwardTrialMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ contact, note }: { contact: GuestContact; note?: string }) =>
      forwardContactToTrialRequest(contact, note),
    onSuccess: () => Promise.all(['contacts', 'audit', 'trial-requests'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}
