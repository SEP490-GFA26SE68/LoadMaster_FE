import { QueryClientContext } from '@tanstack/react-query'
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { connectApiAuth } from '@/lib/api-client'
import { backendConfig, type AuthSource } from '@/lib/backend-config'
import type { User } from '@/types/user'
import * as authApi from './auth-api'
import { createKeycloakSession, type KeycloakSession } from './keycloak-session'

/**
 * Phiên đăng nhập, hai nguồn (`VITE_AUTH_SOURCE`, `lib/backend-config.ts`):
 *
 * - `mock` (mặc định): đăng nhập bằng email và mật khẩu trên kho mẫu. Phiên giữ trong `sessionStorage` để tải lại trang không bị
 *   đăng xuất. Không dùng `localStorage` và không lưu dữ liệu nghiệp vụ ở client (AGENTS.md mục 9).
 * - `keycloak`: đăng nhập ở trang của Keycloak (backend). App không giữ phiên trong `sessionStorage`: mỗi lần mở trang hỏi lại
 *   Keycloak (`status` là `restoring` cho tới khi có câu trả lời), rồi đọc hồ sơ ở backend.
 */

const SESSION_KEY = 'loadmaster.phien'

/** Trang người dùng định mở trước khi bị chuyển sang Keycloak; đọc lại sau khi quay về. */
const RETURN_KEY = 'loadmaster.sau-dang-nhap'

type AuthValue = {
  user: User | null
  /** `restoring`: đang hỏi Keycloak xem còn phiên không — chưa biết đã đăng nhập hay chưa. Chế độ kho mẫu luôn là `ready`. */
  status: 'restoring' | 'ready'
  source: AuthSource
  /** Lỗi của lần mở lại phiên hoặc đọc hồ sơ ở backend (chỉ chế độ Keycloak); màn đăng nhập hiện câu tương ứng. */
  sessionError: unknown
  /** Chế độ kho mẫu. */
  signIn: (email: string, password: string) => Promise<User>
  /** Chế độ Keycloak: chuyển sang trang đăng nhập của Keycloak; `returnTo` là trang sẽ mở sau khi đăng nhập xong. */
  signInWithRedirect: (returnTo?: string) => Promise<void>
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

/** Trang định mở trước khi sang Keycloak. Lần đăng nhập kế tiếp và đăng xuất ghi đè hoặc xoá nó. */
export function readReturnPath(): string | undefined {
  try {
    return sessionStorage.getItem(RETURN_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function rememberReturnPath(path: string | undefined) {
  try {
    if (path) sessionStorage.setItem(RETURN_KEY, path)
    else sessionStorage.removeItem(RETURN_KEY)
  } catch {
    // Không nhớ được thì đăng nhập xong mở màn chính của vai trò.
  }
}

/** Một phiên Keycloak cho cả app: `keycloak-js` chỉ được khởi tạo một lần mỗi lần tải trang. */
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

  // Chế độ Keycloak: hỏi Keycloak một lần khi mở app; còn phiên thì đọc hồ sơ ở backend
  useEffect(() => {
    if (session === null) return
    let cancelled = false
    connectApiAuth(() => session.token())
    void (async () => {
      try {
        const signedIn = (await session.start()) ? await authApi.fetchBackendUser() : null
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
    }
  }, [session, queryClient])

  /**
   * Đổi người là xoá cache Query (FE-0-02): khoá truy vấn không mang người dùng hay công ty (`['trips']`, `['vehicles']`…), nên dữ
   * liệu kho đã lọc cho người trước sẽ hiện nguyên cho người đăng nhập sau trong cùng tab nếu để lại. Xoá cả lúc đăng xuất lẫn
   * lúc đăng nhập: truy vấn chạy giữa hai lần đó đọc kho khi không có phiên — kho không lọc.
   */
  const signIn = useCallback(async (email: string, password: string) => {
    if (viaKeycloak) throw new Error('Chế độ Keycloak đăng nhập bằng signInWithRedirect')
    const signedIn = await authApi.login(email, password)
    queryClient?.clear()
    writeStoredUser(signedIn)
    setUser(signedIn)
    return signedIn
  }, [queryClient, viaKeycloak])

  const signInWithRedirect = useCallback(async (returnTo?: string) => {
    if (session === null) throw new Error('Chế độ kho mẫu đăng nhập bằng signIn')
    rememberReturnPath(returnTo)
    await session.login(`${window.location.origin}/dang-nhap`)
  }, [session])

  const signOut = useCallback(async () => {
    await authApi.logout()
    writeStoredUser(null)
    rememberReturnPath(undefined)
    setUser(null)
    queryClient?.clear()
    // Keycloak đóng phiên của nó rồi đưa trình duyệt về màn đăng nhập
    if (session !== null) await session.logout(`${window.location.origin}/dang-nhap`)
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
    () => ({ user, status, source, sessionError, signIn, signInWithRedirect, signOut, refreshUser }),
    [user, status, source, sessionError, signIn, signInWithRedirect, signOut, refreshUser],
  )

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
