import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Cart, CartItem } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useFlash } from '../context/FlashContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'
import { NO_IMAGE, yen } from '../utils/format'

function problemMessage(item: CartItem): string | null {
  switch (item.problem) {
    case 'UNPUBLISHED':
      return 'この商品は現在購入できません。削除してください'
    case 'OUT_OF_STOCK':
      return '在庫切れです。削除してください'
    case 'INSUFFICIENT_STOCK':
      return `在庫が不足しています（在庫: ${item.stockQuantity}点）。数量を変更してください`
    default:
      return null
  }
}

/** SC-03 カート画面 */
export default function CartPage() {
  const navigate = useNavigate()
  const { updateCartQuantity } = useAuth()
  const { setFlash } = useFlash()
  const handleError = useApiErrorHandler()

  const [cart, setCart] = useState<Cart | null>(null)
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)

  const showCart = useCallback(
    (c: Cart) => {
      setCart(c)
      setQuantities(Object.fromEntries(c.items.map((it) => [it.cartItemId, String(it.quantity)])))
      updateCartQuantity(c.totalQuantity)
    },
    [updateCartQuantity],
  )

  const reload = useCallback(async () => {
    try {
      showCart(await api.get<Cart>('/cart'))
    } catch (err) {
      handleError(err)
    }
  }, [showCart, handleError])

  useEffect(() => {
    let cancelled = false
    api
      .get<Cart>('/cart')
      .then((c) => !cancelled && showCart(c))
      .catch((err) => !cancelled && handleError(err))
    return () => {
      cancelled = true
    }
  }, [])

  // Runs a cart change. 400 shows the message and reloads the cart; 404 reloads silently.
  async function change(action: () => Promise<Cart>, successText: string) {
    setBusy(true)
    try {
      showCart(await action())
      setFlash({ type: 'success', text: successText })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setFlash({ type: 'error', text: err.fieldErrors.quantity ?? err.message })
        await reload()
      } else if (err instanceof ApiError && err.status === 404) {
        await reload()
      } else {
        handleError(err)
      }
    } finally {
      setBusy(false)
    }
  }

  function onUpdate(e: FormEvent, item: CartItem) {
    e.preventDefault()
    const quantity = Number(quantities[item.cartItemId])
    void change(() => api.patch<Cart>(`/cart/items/${item.cartItemId}`, { quantity }), '数量を変更しました')
  }

  function onDelete(item: CartItem) {
    void change(() => api.delete<Cart>(`/cart/items/${item.cartItemId}`), 'カートから商品を削除しました')
  }

  return (
    <section>
      <h1>カート</h1>
      {!cart ? (
        <p className="loading">読み込み中...</p>
      ) : cart.items.length === 0 ? (
        <p>カートに商品が入っていません</p>
      ) : (
        <>
          <table className="cart-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>単価</th>
                <th>数量</th>
                <th>小計</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cart.items.map((item) => {
                const problem = problemMessage(item)
                return (
                  <tr key={item.cartItemId}>
                    <td>
                      <img src={item.imageUrl ?? NO_IMAGE} alt={item.productName} className="thumb" />
                      {item.published ? (
                        <Link to={`/products/${item.productId}`}>{item.productName}</Link>
                      ) : (
                        <span>{item.productName}</span>
                      )}
                      {problem && <p className="field-error">{problem}</p>}
                    </td>
                    <td>{yen(item.unitPrice)}</td>
                    <td>
                      <form onSubmit={(e) => onUpdate(e, item)} className="inline-form">
                        <input
                          type="number"
                          aria-label="数量"
                          min={1}
                          max={10}
                          required
                          value={quantities[item.cartItemId] ?? ''}
                          onChange={(e) => setQuantities({ ...quantities, [item.cartItemId]: e.target.value })}
                        />
                        <button type="submit" disabled={busy}>
                          更新
                        </button>
                      </form>
                    </td>
                    <td>{yen(item.subtotal)}</td>
                    <td>
                      <button type="button" onClick={() => onDelete(item)} disabled={busy}>
                        削除
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="cart-summary">
            <p>合計 {cart.totalQuantity}点</p>
            <p>商品合計 {yen(cart.subtotalAmount)}</p>
            {!cart.purchasable && (
              <p className="field-error">購入できない商品がカートに含まれています。数量を変更するか削除してください</p>
            )}
            <button type="button" onClick={() => navigate('/checkout')} disabled={!cart.purchasable}>
              購入手続きへ進む
            </button>
          </div>
        </>
      )}
      <Link to="/products">買い物を続ける</Link>
    </section>
  )
}
