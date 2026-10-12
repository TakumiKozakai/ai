import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { ApiError, api } from '../api/client'
import type { ProductDetail } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useFlash } from '../context/FlashContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'
import { NO_IMAGE, yen } from '../utils/format'
import NotFoundPage from './NotFoundPage'

/** SC-02 商品詳細画面 */
export default function ProductDetailPage() {
  const { id = '' } = useParams()
  const validId = /^\d+$/.test(id)
  const location = useLocation()
  const navigate = useNavigate()
  const { me, loading: authLoading, updateCartQuantity } = useAuth()
  const { setFlash } = useFlash()
  const handleError = useApiErrorHandler()

  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!validId) return
    let cancelled = false
    setProduct(null)
    setQuantity(1)
    api
      .get<ProductDetail>(`/products/${id}`)
      .then((p) => !cancelled && setProduct(p))
      .catch((err) => !cancelled && handleError(err))
    return () => {
      cancelled = true
    }
  }, [id, validId])

  // A non-numeric id is "not found" without calling the API.
  if (!validId) return <NotFoundPage />

  async function onAddToCart(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await api.post<{ cartQuantity: number }>('/cart/items', { productId: Number(id), quantity })
      updateCartQuantity(res.cartQuantity)
      navigate('/cart', { state: { flash: { type: 'success', text: 'カートに商品を追加しました' } } })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFlash({ type: 'error', text: err.fieldErrors.quantity ?? err.message })
      } else {
        handleError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!product) {
    return <p className="loading">読み込み中...</p>
  }

  return (
    <section className="product-detail">
      <h1>{product.name}</h1>
      <img src={product.imageUrl ?? NO_IMAGE} alt={product.name} />
      <dl>
        <dt>カテゴリ</dt>
        <dd>{product.categoryName}</dd>
        <dt>価格</dt>
        <dd className="price">{yen(product.price)}</dd>
        <dt>在庫</dt>
        <dd>{product.inStock ? '在庫あり' : '在庫切れ'}</dd>
      </dl>
      <p className="description">{product.description ?? ''}</p>

      {!authLoading && (
        <div className="cart-form">
          {!me ? (
            <Link to="/login" state={{ from: location.pathname }}>
              ログインしてカートに入れる
            </Link>
          ) : product.inStock ? (
            <form onSubmit={onAddToCart}>
              <select aria-label="数量" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}>
                {Array.from({ length: product.maxQuantity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={submitting}>
                カートに入れる
              </button>
            </form>
          ) : (
            <button type="button" disabled>
              在庫切れ
            </button>
          )}
        </div>
      )}

      <Link to="/products">商品一覧へ戻る</Link>
    </section>
  )
}
