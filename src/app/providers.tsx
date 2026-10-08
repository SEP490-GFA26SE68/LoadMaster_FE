import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { onRemoteDbChange } from '@/lib/mock-db'
import { TOAST_CLASSES, TOAST_ICONS } from './toast-look'

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  // Kho vừa nhận dữ liệu của tab khác (FE-BL-06): làm mới mọi truy vấn đang hiện. Chỉ đánh dấu cũ và tải lại truy vấn đang mở, không đụng
  // tới state của form nên chữ người dùng đang nhập không mất.
  useEffect(() => onRemoteDbChange(() => void queryClient.invalidateQueries()), [queryClient])

  // Ngôn ngữ bọc ngoài cùng: đổi ngôn ngữ chỉ render lại chữ, không dựng lại
  // router hay cache query nên không mất dữ liệu đang nhập.
  return (
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </AuthProvider>
        <Toaster
          position="top-right"
          closeButton
          gap={12}
          // Dưới nút hành động của dải trời (V2.3): thanh điều hướng 60 px + tiêu đề 32 px + mô tả, nút chính kết thúc ở
          // khoảng 139 px. Rê chuột lên toast làm nó dừng đếm giờ, nên toast đè nút hành động góc phải thì người dùng không
          // bấm được nút cho tới khi đóng toast (LM-101). Trước V2.3 là 136 (thanh ngang 56 + tiêu đề 72).
          offset={{ top: 152, right: 16 }}
          mobileOffset={{ top: 152, right: 16, left: 16 }}
          icons={TOAST_ICONS}
          toastOptions={{ unstyled: true, classNames: TOAST_CLASSES, duration: 5000 }}
        />
      </QueryClientProvider>
    </I18nProvider>
  )
}
