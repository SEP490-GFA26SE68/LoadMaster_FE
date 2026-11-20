import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { NewGuestContact } from '@/lib/mock-db'
import { sendGuestContact } from './contact-api'
import { listPublicPlans } from './pricing-api'

/**
 * Hook Query của hai trang công khai. Gói đang bán nằm dưới `['billing', 'plans', …]` để mọi lần sửa danh mục gói (`['billing']`) làm mới
 * cả bảng giá; `staleTime: 0` — quản lý nền tảng đổi gói ở màn khác. Gửi liên hệ làm mới danh sách liên hệ và nhật ký của người xử lý.
 * Trang giới thiệu chỉ bật truy vấn gói khi phần gói cước hoặc form liên hệ tới gần khung nhìn (`enabled`, `useNearViewport`).
 */
export function usePublicPlansQuery(enabled = true) {
  return useQuery({ queryKey: ['billing', 'plans', 'public'], queryFn: listPublicPlans, staleTime: 0, enabled })
}

export function useSendContactMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: NewGuestContact) => sendGuestContact(input),
    onSuccess: () => Promise.all(['contacts', 'audit'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}
