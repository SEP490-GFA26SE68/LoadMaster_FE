import { createContext, use } from 'react'
import type { User } from '@/types/user'
import type { UserAction } from './UserRowMenu'

/**
 * Dữ liệu các ô của bảng người dùng cần mà thay đổi theo thời gian (danh sách từ kho, người đang chọn, hàm thao tác).
 *
 * Vì sao không đưa thẳng vào định nghĩa cột: TanStack Table v9 dựng ô bằng `createElement(columnDef.cell)`, nên hàm `cell` mới là
 * **một loại component mới** — dựng lại mảng cột là gỡ rồi gắn lại mọi ô, kể cả menu thao tác đang mở. Trước đây cột được dựng lại
 * mỗi khi danh sách người dùng về lại từ kho (mở màn là đọc lại, staleTime 0), nên menu vừa mở bị gỡ khỏi DOM giữa lúc bấm (E2E
 * "Khoá tài khoản" chập chờn). Nay hàm `cell` cố định ở mức module; phần thay đổi đi qua context này, chỉ làm ô render lại.
 */
export type UsersTableContextValue = {
  readonly users: readonly User[]
  /** Người đang đăng nhập: luật chặn thao tác theo phạm vi của người đó (`accountGuards`). */
  readonly viewer: User | null
  /** Tên công ty theo mã, cho cột Công ty của quản trị hệ thống; rỗng khi cột không hiện hoặc kho chưa trả lời. */
  readonly companies: ReadonlyMap<string, string>
  readonly onAction: (action: UserAction, user: User) => void
  readonly selectedId: string | null
  readonly onSelect: (user: User) => void
  /** Mã phần tử của panel chi tiết, cho `aria-controls` ở nút tên. */
  readonly panelId: string
}

export const UsersTableContext = createContext<UsersTableContextValue | null>(null)

export function useUsersTable(): UsersTableContextValue {
  const value = use(UsersTableContext)
  if (!value) throw new Error('Ô bảng người dùng phải nằm trong <UsersTableContext>')
  return value
}
