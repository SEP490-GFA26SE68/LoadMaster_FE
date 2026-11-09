import { QueryClientContext } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { connectApiAuth } from '@/lib/api-client'
import { backendConfig, type AuthSource } from '@/lib/backend-config'
import type { User } from '@/types/user'
import * as authApi from './auth-api'
import { createKeycloakSession, type KeycloakSession } from './keycloak-session'

/**
 * Phiên đăng nhập, hai nguồn (`VITE_AUTH_SOURCE`, `lib/backend-config.ts`). Cả hai đều đăng nhập bằng email và mật khẩu trên màn của
 * app — không chuyển sang trang nào khác:
 *
 * - `mock` (mặc định): kho mẫu kiểm mật khẩu. Phiên giữ trong `sessionStorage` để tải lại trang không bị đăng xuất. Không dùng
 *   `localStorage` và không lưu dữ liệu nghiệp vụ ở client (AGENTS.md mục 9).
 * - `keycloak`: đổi email và mật khẩu lấy token ở Keycloak của backend (`keycloak-session.ts`), rồi đọc hồ sơ ở backend. Mở trang thì
 *   mở lại phiên của tab (`status` là `restoring` cho tới khi xong).
 */

const SESSION_KEY = 'loadmaster.phien'

type AuthValue = {
  user: User | null
  /** `restoring`: đang mở lại phiên Keycloak của tab — chưa biết đã đăng nhập hay chưa. Chế độ kho mẫu luôn là `ready`. */
  status: 'restoring' | 'ready'
  source: AuthSource
  /** Lỗi của lần mở lại phiên hoặc đọc hồ sơ ở backend (chỉ chế độ Keycloak); màn đăng nhập hiện câu tương ứng. */
  sessionError: unknown
  /** Đăng nhập bằng email và mật khẩu — ở kho mẫu, hoặc ở Keycloak rồi đọc hồ sơ ở backend. Lỗi có mã là `AuthError`. */
  signIn: (email: string, password: string) => Promise<User>
  signOut: () => Promise<void>
  /** Đọc lại người dùng của phiên, ví dụ sau khi sửa hồ sơ (LM-096). */
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

/**
 * Hồ sơ ở backend sau khi Keycloak đã cấp phiên. Backend không nhận người này thì đóng luôn phiên Keycloak: để lại thì tab giữ một phiên
 * không dùng được, và lần mở trang sau lại vấp đúng lỗi đó.
 */
async function backendUserOf(session: KeycloakSession): Promise<User> {
  try {
    return await authApi.fetchBackendUser()
  } catch (error) {
    await session.logout()
    throw error
  }
}

/** Một phiên Keycloak cho cả app: mỗi lần tải trang chỉ mở lại phiên một lần. */
let sharedSession: KeycloakSession | undefined

type AuthProviderProps = {
  children: ReactNode
  /** Chỉ cho test: nguồn đăng nhập và phiên Keycloak giả. App lấy theo `backendConfig`. */
  source?: AuthSource
  keycloak?: KeycloakSession
}

export function AuthProvider({ children, source = backendConfig.authSource, keycloak }: AuthProviderProps) {
  const viaKeycloak = source === 'keycloak'
  const session = useMemo(() => (viaKeycloak ? (keycloak ?? (sharedSession ??= createKeycloakSession())) : null), [viaKeycloak, keycloak])
  const [user, setUser] = useState<User | null>(() => (viaKeycloak ? null : restoreUser()))
  const [status, setStatus] = useState<AuthValue['status']>(viaKeycloak ? 'restoring' : 'ready')
  const [sessionError, setSessionError] = useState<unknown>(null)
  // Vắng khi cây không có `QueryClientProvider` (vài test chỉ dựng phiên): khi đó không có cache nào để xoá
  const queryClient = use(QueryClientContext)

  // Chế độ Keycloak: mở lại phiên một lần khi mở app; còn phiên thì đọc hồ sơ ở backend
  useEffect(() => {
    if (session === null) return
    let cancelled = false
    connectApiAuth(() => session.token())
    // Phiên hết giữa chừng (không làm mới được, tab khác đăng xuất): về màn đăng nhập, bỏ dữ liệu của người vừa thoát
    const stopListening = session.onEnded(() => {
      authApi.forgetBackendUser()
      setUser(null)
      queryClient?.clear()
    })
    void (async () => {
      try {
        const signedIn = (await session.start()) ? await backendUserOf(session) : null
        if (cancelled) return
        queryClient?.clear()
        setUser(signedIn)
      } catch (error) {
        if (!cancelled) setSessionError(error)
      } finally {
        if (!cancelled) setStatus('ready')
      }
    })()
    return () => {
      cancelled = true
      stopListening()
    }
  }, [session, queryClient])

  /**
   * Đổi người là xoá cache Query (FE-0-02): khoá truy vấn không mang người dùng hay công ty (`['trips']`, `['vehicles']`…), nên dữ
   * liệu kho đã lọc cho người trước sẽ hiện nguyên cho người đăng nhập sau trong cùng tab nếu để lại. Xoá cả lúc đăng xuất lẫn
   * lúc đăng nhập: truy vấn chạy giữa hai lần đó đọc kho khi không có phiên — kho không lọc.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    let signedIn: User
    if (session === null) {
      signedIn = await authApi.login(email, password)
      writeStoredUser(signedIn)
    } else {
      await session.login(email, password)
      signedIn = await backendUserOf(session)
    }
    setSessionError(null)
    queryClient?.clear()
    setUser(signedIn)
    return signedIn
  }, [queryClient, session])

  const signOut = useCallback(async () => {
    await authApi.logout()
    authApi.forgetBackendUser()
    writeStoredUser(null)
    setUser(null)
    queryClient?.clear()
    // Đóng phiên ở Keycloak; RequireAuth đưa về màn đăng nhập
    if (session !== null) await session.logout()
  }, [queryClient, session])

  const refreshUser = useCallback(() => {
    if (session !== null) {
      // Danh tính nằm ở backend: đọc lại từ đó, không lấy tài khoản mẫu đang đứng thay
      void authApi.fetchBackendUser().then(setUser, () => undefined)
      return
    }
    const current = authApi.currentSessionUser()
    writeStoredUser(current)
    setUser(current)
  }, [session])

  const value = useMemo<AuthValue>(
    () => ({ user, status, source, sessionError, signIn, signOut, refreshUser }),
    [user, status, source, sessionError, signIn, signOut, refreshUser],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth(): AuthValue {
  const value = use(AuthContext)
  if (!value) throw new Error('useAuth phải nằm trong <AuthProvider>')
  return value
}

/** Đọc AuthContext an toàn, trả về null nếu nằm ngoài <AuthProvider> (ví dụ trong unit test). */
export function useAuthSafe(): AuthValue | null {
  return use(AuthContext)
}

/** Người dùng hiện tại, ném lỗi nếu gọi ở màn chưa qua RequireAuth. */
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('Màn hình này yêu cầu đăng nhập')
  return user
}
