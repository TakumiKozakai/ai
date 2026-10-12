import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Checkout, PaymentMethod } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'
import { PAYMENT_METHOD_LABELS, addressLabel, yen } from '../utils/format'

const emptyAddress = {
  recipientName: '',
  postalCode: '',
  prefecture: '',
  city: '',
  addressLine: '',
  building: '',
  phoneNumber: '',
}
type NewAddress = typeof emptyAddress

const PAYMENT_METHODS: PaymentMethod[] = ['CREDIT_CARD', 'BANK_TRANSFER', 'CASH_ON_DELIVERY']

function initialAddressId(data: Checkout): string {
  const def = data.addresses.find((a) => a.isDefault) ?? data.addresses[0]
  return def ? String(def.id) : 'new'
}

/** SC-04 購入手続き画面 */
export default function CheckoutPage() {
  const navigate = useNavigate()
  const { updateCartQuantity } = useAuth()
  const handleError = useApiErrorHandler()

  const [data, setData] = useState<Checkout | null>(null)
  const [addressId, setAddressId] = useState('')
  const [newAddress, setNewAddress] = useState<NewAddress>(emptyAddress)
  const [paymentMethod, setPaymentMethod] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    api
      .get<Checkout>('/checkout')
      .then((d) => {
        if (cancelled) return
        setData(d)
        setAddressId(initialAddressId(d))
      })
      .catch((err) => {
        if (cancelled) return
        // The cart is empty or not purchasable: back to the cart with the message.
        if (err instanceof ApiError && err.status === 409) {
          navigate('/cart', { replace: true, state: { flash: { type: 'error', text: err.message } } })
          return
        }
        handleError(err)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    try {
      const res = await api.post<{ orderNumber: string }>('/orders', { addressId, newAddress, paymentMethod })
      updateCartQuantity(0)
      navigate(`/orders/${res.orderNumber}/complete`, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setErrors(err.fieldErrors)
      } else if (err instanceof ApiError && err.status === 409) {
        navigate('/cart', { state: { flash: { type: 'error', text: err.message } } })
      } else {
        handleError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function addressInput(field: keyof NewAddress, label: string, maxLength: number, extra: { placeholder?: string; numeric?: boolean } = {}) {
    return (
      <div className="field">
        <label>
          {label}
          <input
            type="text"
            maxLength={maxLength}
            placeholder={extra.placeholder}
            inputMode={extra.numeric ? 'numeric' : undefined}
            value={newAddress[field]}
            onChange={(e) => setNewAddress({ ...newAddress, [field]: e.target.value })}
          />
        </label>
        {errors[field] && <p className="field-error">{errors[field]}</p>}
      </div>
    )
  }

  return (
    <section>
      <h1>購入手続き</h1>
      {!data ? (
        <p className="loading">読み込み中...</p>
      ) : (
        <form onSubmit={onSubmit} className="checkout-form">
          <h2>注文内容</h2>
          <table className="cart-table">
            <thead>
              <tr>
                <th>商品</th>
                <th>単価</th>
                <th>数量</th>
                <th>小計</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.productName}</td>
                  <td>{yen(it.unitPrice)}</td>
                  <td>{it.quantity}点</td>
                  <td>{yen(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="amounts">
            <dt>商品合計</dt>
            <dd>{yen(data.subtotalAmount)}</dd>
            <dt>送料</dt>
            <dd>{yen(data.shippingFee)}</dd>
            <dt>支払総額</dt>
            <dd>{yen(data.totalAmount)}</dd>
          </dl>
          <p className="note">5,000円以上のご購入で送料無料</p>

          <h2>配送先</h2>
          <fieldset>
            <legend>配送先</legend>
            {data.addresses.map((a) => (
              <label key={a.id} className="radio">
                <input
                  type="radio"
                  name="addressId"
                  value={String(a.id)}
                  checked={addressId === String(a.id)}
                  onChange={() => setAddressId(String(a.id))}
                />
                {addressLabel(a)}
              </label>
            ))}
            <label className="radio">
              <input type="radio" name="addressId" value="new" checked={addressId === 'new'} onChange={() => setAddressId('new')} />
              新しい住所を入力する
            </label>
            {errors.addressId && <p className="field-error">{errors.addressId}</p>}
          </fieldset>

          <div className="new-address">
            {addressInput('recipientName', '宛名', 100)}
            {addressInput('postalCode', '郵便番号', 7, { placeholder: '1234567', numeric: true })}
            <div className="field">
              <label>
                都道府県
                <select value={newAddress.prefecture} onChange={(e) => setNewAddress({ ...newAddress, prefecture: e.target.value })}>
                  <option value="">選択してください</option>
                  {data.prefectures.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              {errors.prefecture && <p className="field-error">{errors.prefecture}</p>}
            </div>
            {addressInput('city', '市区町村', 100)}
            {addressInput('addressLine', '町名・番地', 200)}
            {addressInput('building', '建物名', 200)}
            {addressInput('phoneNumber', '電話番号', 11, { placeholder: '09012345678', numeric: true })}
          </div>

          <h2>支払方法</h2>
          <fieldset>
            <legend>支払方法</legend>
            {PAYMENT_METHODS.map((m) => (
              <label key={m} className="radio">
                <input
                  type="radio"
                  name="paymentMethod"
                  value={m}
                  checked={paymentMethod === m}
                  onChange={() => setPaymentMethod(m)}
                />
                {PAYMENT_METHOD_LABELS[m]}
              </label>
            ))}
            {errors.paymentMethod && <p className="field-error">{errors.paymentMethod}</p>}
          </fieldset>

          <button type="submit" disabled={submitting}>
            注文を確定する
          </button>
        </form>
      )}
      <Link to="/cart">カートに戻る</Link>
    </section>
  )
}
