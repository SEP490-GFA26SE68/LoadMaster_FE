import { QueryClientContext } from '@tanstack/react-query'
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { DEMO_ACCOUNTS, getMockDb } from '@/lib/mock-db'
import type { User } from '@/types/user'
import * as authApi from './auth-api'
import { keycloak } from './keycloak'

type AuthValue = {
  user: User | null
  initialized: boolean
  signIn: (redirectUri?: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

const SESSION_KEY = 'loadmaster.phien'

function restoreMockSession(): User | null {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as User
    if (parsed?.id) {
      getMockDb().restoreSession(parsed.id)
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreMockSession)
  const [initialized, setInitialized] = useState(false)

  const queryClient = use(QueryClientContext)

  useEffect(() => {
    let mounted = true

    async function initialize() {
      try {
        const storedMock = restoreMockSession()
        if (storedMock && import.meta.env.MODE === 'test') {
          if (mounted) {
            setUser(storedMock)
            setInitialized(true)
          }
          return
        }

        const authenticated = await authApi.initAuth()

        if (!mounted) return

        if (authenticated) {
          const currentUser =
            await authApi.getCurrentUser()

          if (!mounted) return

          const demoAccount = DEMO_ACCOUNTS.find((item) => item.role === currentUser.role)
          if (demoAccount) {
            getMockDb().restoreSession(demoAccount.id)
          }

          setUser(currentUser)
        }

        keycloak.onAuthLogout = () => {
          if (!mounted) return

          setUser(null)
          queryClient?.clear()
        }

        keycloak.onTokenExpired = async () => {
          try {
            await keycloak.updateToken(30)
          } catch {
            if (!mounted) return

            setUser(null)
            queryClient?.clear()

            await keycloak.login({
              redirectUri:
                `${window.location.origin}/dang-nhap`,
            })
          }
        }
      } catch (error) {
        console.error(
          'Failed to initialize authentication',
          error,
        )

        if (mounted) {
          setUser(null)
        }
      } finally {
        if (mounted) {
          setInitialized(true)
        }
      }
    }

    void initialize()

    return () => {
      mounted = false

      keycloak.onAuthLogout = undefined
      keycloak.onTokenExpired = undefined
    }
  }, [queryClient])

  const signIn = useCallback(async (redirectUri?: string) => {
    await authApi.login(redirectUri)
  }, [])

  const signOut = useCallback(async () => {
    queryClient?.clear()
    setUser(null)

    await authApi.logout()
  }, [queryClient])

  const refreshUser = useCallback(async () => {
    const currentUser = await authApi.getCurrentUser()
    setUser(currentUser)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      user,
      initialized,
      signIn,
      signOut,
      refreshUser,
    }),
    [user, initialized, signIn, signOut, refreshUser],
  )

  return (
    <AuthContext value={value}>
      {children}
    </AuthContext>
  )
}

export function useAuth(): AuthValue {
  const value = use(AuthContext)

  if (!value) {
    throw new Error('useAuth phải nằm trong <AuthProvider>')
  }

  return value
}

export function useCurrentUser(): User {
  const { user } = useAuth()

  if (!user) {
    throw new Error('Màn hình này yêu cầu đăng nhập')
  }

  return user
}