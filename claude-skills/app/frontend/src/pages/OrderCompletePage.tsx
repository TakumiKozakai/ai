import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api/client'
import type { Order } from '../api/types'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'
import { PAYMENT_METHOD_LABELS, addressLabel, dateTime, yen } from '../utils/format'

/** SC-05 注文完了画面 */
export default function OrderCompletePage() {
  const { orderNumber = '' } = useParams()
  const handleError = useApiErrorHandler()
  const [order, setOrder] = useState<Order | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .get<Order>(`/orders/${encodeURIComponent(orderNumber)}`)
      .then((o) => !cancelled && setOrder(o))
      .catch((err) => !cancelled && handleError(err))
    return () => {
      cancelled = true
    }
  }, [orderNumber])

  return (
    <section>
      <h1>ご注文ありがとうございました</h1>
      {!order ? (
        <p className="loading">読み込み中...</p>
      ) : (
        <>
          <p>ご注文を受け付けました。</p>
          <dl>
            <dt>注文番号</dt>
            <dd>{order.orderNumber}</dd>
            <dt>注文日時</dt>
            <dd>{dateTime(order.orderedAt)}</dd>
            <dt>支払方法</dt>
            <dd>{PAYMENT_METHOD_LABELS[order.paymentMethod]}</dd>
            <dt>配送先</dt>
            <dd>{addressLabel(order.shipping)}</dd>
          </dl>

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
              {order.items.map((it, i) => (
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
            <dd>{yen(order.subtotalAmount)}</dd>
            <dt>送料</dt>
            <dd>{yen(order.shippingFee)}</dd>
            <dt>支払総額</dt>
            <dd>{yen(order.totalAmount)}</dd>
          </dl>
        </>
      )}
      <Link to="/products">買い物を続ける</Link>
    </section>
  )
}
