import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Me } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useFlash } from '../context/FlashContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'

/** Where to go after login: the URL passed as "from", or the product list. */
function destination(state: unknown): string {
  const from = (state as { from?: string } | null)?.from
  return from && from.startsWith('/') && !from.startsWith('/login') ? from : '/products'
}

/** SC-07 ログイン画面 */
export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { me, loading, setMe } = useAuth()
  const { setFlash } = useFlash()
  const handleError = useApiErrorHandler()
  const loggedIn = useRef(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Not shown while logged in (common spec 4.4), except right after this login.
  if (!loading && me && !loggedIn.current) return <Navigate to="/products" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.post<Me>('/auth/login', { email, password })
      loggedIn.current = true
      setMe(res)
      navigate(destination(location.state), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setFlash({ type: 'error', text: err.message })
        setPassword('')
      } else {
        handleError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section>
      <h1>ログイン</h1>
      <form onSubmit={onSubmit} className="auth-form">
        <div className="field">
          <label>
            メールアドレス
            <input type="email" required maxLength={255} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
        <div className="field">
          <label>
            パスワード
            <input type="password" required maxLength={64} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={submitting}>
          ログイン
        </button>
      </form>
      <Link to="/signup">会員登録はこちら</Link>
    </section>
  )
}
