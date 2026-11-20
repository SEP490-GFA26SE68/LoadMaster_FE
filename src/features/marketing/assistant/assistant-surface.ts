import { createContext, useContext } from 'react'
import type { AssistantSurface } from './assistant-api'

/**
 * Trợ lý đang ở trang công khai (khách, mặc định) hay trong ứng dụng (người đã đăng nhập; `AppAssistant` bọc nút mở bằng giá trị `app`).
 * Khung chat là chunk lười nằm dưới nút mở nên đọc được cùng giá trị.
 */
export const AssistantSurfaceContext = createContext<AssistantSurface>('public')

export function useAssistantSurface(): AssistantSurface {
  return useContext(AssistantSurfaceContext)
}
