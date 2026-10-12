import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { usePageError } from '../context/PageErrorContext'

/**
 * Handles API errors that are common to every screen:
 * 401 -> login screen with the current URL as "from" (common spec 4.4),
 * 404 -> "ページが見つかりません", others -> "システムエラー" (common spec 6).
 */
export function useApiErrorHandler() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setMe } = useAuth()
  const { showError } = usePageError()

  return useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.status === 401) {
        setMe(null)
        navigate('/login', { replace: true, state: { from: location.pathname + location.search } })
        return
      }
      if (err instanceof ApiError && err.status === 404) {
        showError('notFound')
        return
      }
      console.error(err)
      showError('system')
    },
    [navigate, location.pathname, location.search, setMe, showError],
  )
}
