import { useRef, useState, type FormEvent, type InputHTMLAttributes } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { ApiError, api } from '../api/client'
import type { Me } from '../api/types'
import { useAuth } from '../context/AuthContext'
import { useApiErrorHandler } from '../hooks/useApiErrorHandler'

const emptyForm = { name: '', email: '', password: '', passwordConfirm: '', phoneNumber: '' }
type SignupForm = typeof emptyForm

/** SC-06 会員登録画面 */
export default function SignupPage() {
  const navigate = useNavigate()
  const { me, loading, setMe } = useAuth()
  const handleError = useApiErrorHandler()
  const signedUp = useRef(false)

  const [form, setForm] = useState<SignupForm>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  // Not shown while logged in (common spec 4.4), except right after this signup.
  if (!loading && me && !signedUp.current) return <Navigate to="/products" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setErrors({})
    try {
      const res = await api.post<Me>('/auth/signup', form)
      signedUp.current = true
      setMe(res)
      navigate('/products', { replace: true, state: { flash: { type: 'success', text: '会員登録が完了しました' } } })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR') {
        setErrors(err.fieldErrors)
        setForm((f) => ({ ...f, password: '', passwordConfirm: '' }))
      } else {
        handleError(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function field(name: keyof SignupForm, label: string, input: InputHTMLAttributes<HTMLInputElement>, note?: string) {
    return (
      <div className="field">
        <label>
          {label}
          <input {...input} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} />
        </label>
        {note && <p className="note">{note}</p>}
        {errors[name] && <p className="field-error">{errors[name]}</p>}
      </div>
    )
  }

  return (
    <section>
      <h1>会員登録</h1>
      <form onSubmit={onSubmit} className="auth-form">
        {field('name', '氏名', { type: 'text', required: true, maxLength: 100 })}
        {field('email', 'メールアドレス', { type: 'email', required: true, maxLength: 255 })}
        {field(
          'password',
          'パスワード',
          { type: 'password', required: true, minLength: 8, maxLength: 64 },
          '8〜64文字の半角英数字・記号で、英字と数字をそれぞれ1文字以上含めてください',
        )}
        {field('passwordConfirm', 'パスワード（確認）', { type: 'password', required: true, minLength: 8, maxLength: 64 })}
        {field('phoneNumber', '電話番号', { type: 'text', maxLength: 11, inputMode: 'numeric', placeholder: '09012345678' })}
        <button type="submit" disabled={submitting}>
          登録する
        </button>
      </form>
      <Link to="/login">すでに会員の方はこちら</Link>
    </section>
  )
}
