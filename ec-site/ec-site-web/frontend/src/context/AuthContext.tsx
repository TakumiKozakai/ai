import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Me } from '../api/types'

interface AuthState {
  /** null while not logged in (or while loading). */
  me: Me | null
  /** true until the first GET /api/me finishes. */
  loading: boolean
  setMe: (me: Me | null) => void
  updateCartQuantity: (quantity: number) => void
  logout: () => Promise<void>
  /** true between the logout request and arriving at the login screen. */
  isLoggingOut: () => boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const loggingOut = useRef(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    api
      .get<Me>('/me')
      .then(setMe)
      .catch(() => setMe(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (location.pathname === '/login') loggingOut.current = false
  }, [location.pathname])

  const updateCartQuantity = useCallback((quantity: number) => {
    setMe((current) => (current ? { ...current, cartQuantity: quantity } : current))
  }, [])

  // Common spec 4.1 / SC-07 3.5: delete the cookie, then show the login screen
  // with "ログアウトしました". RequireAuth must not redirect with "from" meanwhile.
  const logout = useCallback(async () => {
    loggingOut.current = true
    try {
      await api.post('/auth/logout')
    } catch (err) {
      loggingOut.current = false
      throw err
    }
    navigate('/login', { replace: true, state: { flash: { type: 'success', text: 'ログアウトしました' } } })
    setMe(null)
  }, [navigate])

  const isLoggingOut = useCallback(() => loggingOut.current, [])

  return (
    <AuthContext.Provider value={{ me, loading, setMe, updateCartQuantity, logout, isLoggingOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
