import { QueryClientContext } from '@tanstack/react-query'
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@/types/user'
import * as authApi from './auth-api'

/**
 * Phiên đăng nhập.
 *
 * Phiên được giữ trong `sessionStorage` để tải lại trang không bị đăng xuất
 * khi đang phát triển. Đây là chỗ tạm: backend thật sẽ đặt cookie HttpOnly,
 * lúc đó bỏ hẳn phần lưu trữ này. Không dùng `localStorage` và không lưu dữ
 * liệu nghiệp vụ ở client (AGENTS.md mục 9).
 */

const SESSION_KEY = 'loadmaster.phien'

type AuthValue = {
  user: User | null
  signIn: (email: string, password: string) => Promise<User>
  signOut: () => Promise<void>
  /** Đọc lại người dùng của phiên từ kho, ví dụ sau khi sửa hồ sơ (LM-096). */
  refreshUser: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function readStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    // Trình duyệt chặn storage hoặc dữ liệu hỏng — coi như chưa đăng nhập.
    return null
  }
}

/** Phiên lưu ở tab được kho xác nhận lại: tài khoản đã bị khoá hoặc xoá thì coi như chưa đăng nhập. */
function restoreUser(): User | null {
  const restored = authApi.restoreSession(readStoredUser()?.id ?? null)
  writeStoredUser(restored)
  return restored
}

function writeStoredUser(user: User | null) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
    else sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // Không lưu được thì phiên chỉ sống trong bộ nhớ; app vẫn chạy bình thường.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreUser)
  // Vắng khi cây không có `QueryClientProvider` (vài test chỉ dựng phiên): khi đó không có cache nào để xoá
  const queryClient = use(QueryClientContext)

  /**
   * Đổi người là xoá cache Query (FE-0-02): khoá truy vấn không mang người dùng hay công ty (`['trips']`, `['vehicles']`…), nên dữ
   * liệu kho đã lọc cho người trước sẽ hiện nguyên cho người đăng nhập sau trong cùng tab nếu để lại. Xoá cả lúc đăng xuất lẫn
   * lúc đăng nhập: truy vấn chạy giữa hai lần đó đọc kho khi không có phiên — kho không lọc.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    const signedIn = await authApi.login(email, password)
    queryClient?.clear()
    writeStoredUser(signedIn)
    setUser(signedIn)
    return signedIn
  }, [queryClient])

  const signOut = useCallback(async () => {
    await authApi.logout()
    writeStoredUser(null)
    setUser(null)
    queryClient?.clear()
  }, [queryClient])

  const refreshUser = useCallback(() => {
    const current = authApi.currentSessionUser()
    writeStoredUser(current)
    setUser(current)
  }, [])

  const value = useMemo<AuthValue>(() => ({ user, signIn, signOut, refreshUser }), [user, signIn, signOut, refreshUser])

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return value
}

/** Người dùng hiện tại, ném lỗi nếu gọi ở màn chưa qua RequireAuth. */
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Màn hình này yêu cầu đăng nhập')
  return user
}
