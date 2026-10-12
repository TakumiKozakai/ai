import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Category, ProductPage } from '../api/types'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'
import { NO_IMAGE, yen } from '../utils/format'

function buildQuery(keyword: string, categoryId: string, page?: number): string {
  const q = new URLSearchParams()
  if (keyword.trim() !== '') q.set('keyword', keyword)
  if (categoryId !== '') q.set('categoryId', categoryId)
  if (page !== undefined) q.set('page', String(page))
  const s = q.toString()
  return s ? `?${s}` : ''
}

/** SC-01 商品一覧画面 */
export default function ProductListPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const handleError = useApiErrorHandler()

  const keyword = params.get('keyword') ?? ''
  const categoryId = params.get('categoryId') ?? ''
  const page = params.get('page') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [form, setForm] = useState({ keyword, categoryId })
  const [result, setResult] = useState<ProductPage | null>(null)
  const [keywordError, setKeywordError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api
      .get<Category[]>('/categories')
      .then((cs) => !cancelled && setCategories(cs))
      .catch((err) => !cancelled && handleError(err))
    return () => {
      cancelled = true
    }
    // Categories are loaded once.
  }, [])

  // The search conditions live in the URL, so reload and back/forward show the same result.
  useEffect(() => {
    setForm({ keyword, categoryId })
    let cancelled = false
    setLoading(true)
    const q = new URLSearchParams()
    if (keyword) q.set('keyword', keyword)
    if (categoryId) q.set('categoryId', categoryId)
    if (page) q.set('page', page)
    api
      .get<ProductPage>(`/products?${q.toString()}`)
      .then((r) => {
        if (cancelled) return
        setResult(r)
        setKeywordError('')
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 400) {
          setResult(null)
          setKeywordError(err.fieldErrors.keyword ?? err.message)
          return
        }
        handleError(err)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [keyword, categoryId, page])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    navigate(`/products${buildQuery(form.keyword, form.categoryId)}`)
  }

  const selectedCategory = categories.some((c) => String(c.id) === form.categoryId) ? form.categoryId : ''

  return (
    <section>
      <h1>商品一覧</h1>

      <form className="search-form" onSubmit={onSubmit}>
        <div className="field">
          <input
            type="text"
            aria-label="キーワード"
            placeholder="商品名・説明で検索"
            maxLength={100}
            value={form.keyword}
            onChange={(e) => setForm({ ...form, keyword: e.target.value })}
          />
          {keywordError && <p className="field-error">{keywordError}</p>}
        </div>
        <select
          aria-label="カテゴリ"
          value={selectedCategory}
          onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
        >
          <option value="">すべてのカテゴリ</option>
          {categories.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
        <button type="submit">検索</button>
      </form>

      {loading && !result && !keywordError && <p className="loading">読み込み中...</p>}

      {result && !keywordError && (
        <>
          {result.totalCount > 0 ? (
            <p>{result.totalCount}件の商品が見つかりました</p>
          ) : (
            <p>該当する商品が見つかりませんでした</p>
          )}

          <ul className="product-grid">
            {result.items.map((p) => (
              <li key={p.id} className="product-card">
                <img src={p.imageUrl ?? NO_IMAGE} alt={p.name} />
                <Link to={`/products/${p.id}`}>{p.name}</Link>
                <span className="price">{yen(p.price)}</span>
                {!p.inStock && <span className="badge-out-of-stock">在庫切れ</span>}
              </li>
            ))}
          </ul>

          {result.totalPages >= 2 && (
            <nav className="pagination" aria-label="ページ送り">
              {result.page > 1 && <Link to={`/products${buildQuery(keyword, categoryId, result.page - 1)}`}>前へ</Link>}
              <span>
                {result.page} / {result.totalPages} ページ
              </span>
              {result.page < result.totalPages && (
                <Link to={`/products${buildQuery(keyword, categoryId, result.page + 1)}`}>次へ</Link>
              )}
            </nav>
          )}
        </>
      )}
    </section>
  )
}
