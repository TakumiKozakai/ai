import { useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'

/** Common header (common spec 3). */
export default function Header() {
  const { me, loading, logout } = useAuth()
  const handleError = useApiErrorHandler()
  const [busy, setBusy] = useState(false)

  async function onLogout() {
    setBusy(true)
    try {
      await logout()
    } catch (err) {
      handleError(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="site-header">
      <Link to="/products" className="site-name">
        ECサイト
      </Link>
      {!loading && (
        <nav className="site-nav">
          {me ? (
            <>
              <span>{me.name} さん</span>
              <Link to="/cart">カート（{me.cartQuantity}）</Link>
              <button type="button" onClick={onLogout} disabled={busy}>
                ログアウト
              </button>
            </>
          ) : (
            <>
              <Link to="/login">ログイン</Link>
              <Link to="/signup">会員登録</Link>
            </>
          )}
        </nav>
      )}
    </header>
  )
}
