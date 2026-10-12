import { Navigate, Route, Routes } from 'react-router'
import FlashMessage from './components/FlashMessage'
import Header from './components/Header'
import RequireAuth from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'
import { FlashProvider } from './context/FlashContext'
import { PageErrorProvider, usePageError } from './context/PageErrorContext'
import CartPage from './pages/CartPage'
import CheckoutPage from './pages/CheckoutPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import OrderCompletePage from './pages/OrderCompletePage'
import ProductDetailPage from './pages/ProductDetailPage'
import ProductListPage from './pages/ProductListPage'
import SignupPage from './pages/SignupPage'
import SystemErrorPage from './pages/SystemErrorPage'

/** Screens of common spec 2. An API error replaces the screen without changing the URL. */
function Content() {
  const { error } = usePageError()
  if (error === 'notFound') return <NotFoundPage />
  if (error === 'system') return <SystemErrorPage />

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/products" replace />} />
      <Route path="/products" element={<ProductListPage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
      <Route path="/checkout" element={<RequireAuth><CheckoutPage /></RequireAuth>} />
      <Route path="/orders/:orderNumber/complete" element={<RequireAuth><OrderCompletePage /></RequireAuth>} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <FlashProvider>
        <PageErrorProvider>
          <Header />
          <main className="container">
            <FlashMessage />
            <Content />
          </main>
        </PageErrorProvider>
      </FlashProvider>
    </AuthProvider>
  )
}
