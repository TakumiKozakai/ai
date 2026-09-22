import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router'

export type PageErrorKind = 'notFound' | 'system'

interface PageErrorState {
  /** The error screen to show instead of the current screen (common spec 6). */
  error: PageErrorKind | null
  showError: (kind: PageErrorKind) => void
}

const PageErrorContext = createContext<PageErrorState | null>(null)

/**
 * The error is tied to the history entry that is current when it is reported, so
 * any later navigation clears it. The key is read at call time because FlashProvider
 * replaces the entry (and its key) while a screen is still loading.
 */
export function PageErrorProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const currentKey = useRef(location.key)
  currentKey.current = location.key
  const [state, setState] = useState<{ kind: PageErrorKind; key: string } | null>(null)

  const showError = useCallback((kind: PageErrorKind) => setState({ kind, key: currentKey.current }), [])
  const error = state && state.key === location.key ? state.kind : null

  return <PageErrorContext.Provider value={{ error, showError }}>{children}</PageErrorContext.Provider>
}

export function usePageError(): PageErrorState {
  const ctx = useContext(PageErrorContext)
  if (!ctx) throw new Error('usePageError must be used within PageErrorProvider')
  return ctx
}
