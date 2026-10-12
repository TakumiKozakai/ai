import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../context/AuthContext'

/**
 * Screens that need login (SC-03 to SC-05): redirect to the login screen with the
 * current URL as "from" so that the user comes back after logging in (common spec 4.4).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading, isLoggingOut } = useAuth()
  const location = useLocation()

  if (loading) return <p className="loading">読み込み中...</p>
  if (!me) {
    if (isLoggingOut()) return null
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  return <>{children}</>
}
