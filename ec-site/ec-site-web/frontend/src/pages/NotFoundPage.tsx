import { Link } from 'react-router'

/** "ページが見つかりません" (common spec 6). */
export default function NotFoundPage() {
  return (
    <section>
      <h1>ページが見つかりません</h1>
      <p>お探しのページは存在しないか、削除された可能性があります。</p>
      <Link to="/products">商品一覧へ戻る</Link>
    </section>
  )
}
