
import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { user, initialized } = useAuth()
  const location = useLocation()

  const [signedInOnMount] = useState(user !== null)

  // Chờ Keycloak kiểm tra phiên đăng nhập
  if (!initialized) {
    return null
  }

  // Chưa đăng nhập thì chuyển về trang đăng nhập
  if (!user) {
    return (
      <Navigate
        to="/dang-nhap"
        replace
        state={
          signedInOnMount
            ? null
            : {
                from:
                  location.pathname +
                  location.search +
                  location.hash,
              }
        }
      />
    )
  }

  return <Outlet />
}
