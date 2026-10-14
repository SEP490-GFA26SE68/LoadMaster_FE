import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthProvider'

export function RequireAuth() {
  const { user, initialized } = useAuth()
  const location = useLocation()

  const [signedInOnMount] = useState(user !== null)

  if (!initialized) {
    return null
    // hoặc loading component nếu bạn có
  }

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
                  location.search
              }
        }
      />
    )
  }

  return <Outlet />
}