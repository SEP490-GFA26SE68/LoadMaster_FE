import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { changePassword, saveProfile } from './profile-api'

/**
 * Lưu họ tên, số điện thoại của chính mình: đọc lại người dùng của phiên (tên trên nav rail đổi ngay) và làm mới mọi màn đang
 * mở — tên người xuất hiện ở danh sách người dùng, chuyến (tài xế) và nhật ký.
 */
export function useSaveProfileMutation() {
  const t = useT()
  const { refreshUser } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveProfile,
    onSuccess: () => {
      // Đã lưu; chỉ lần đọc lại tên trên thanh hỏng thì báo lỗi đó
      refreshUser().catch((error: unknown) => toast.error(dataErrorMessage(error, t)))
      void queryClient.invalidateQueries()
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({ mutationFn: changePassword })
}
