import { Link } from 'react-router'

/** "システムエラー" (common spec 6). */
export default function SystemErrorPage() {
  return (
    <section>
      <h1>システムエラーが発生しました</h1>
      <p>時間をおいて再度お試しください。</p>
      <Link to="/products">商品一覧へ戻る</Link>
    </section>
  )
}
