import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'

export interface Flash {
  type: 'success' | 'error'
  text: string
}

interface FlashState {
  flash: Flash | null
  setFlash: (flash: Flash | null) => void
}

const FlashContext = createContext<FlashState | null>(null)

/**
 * Screen messages (common spec 5.1). A message passed as navigation state
 * ({ flash }) is shown once on the destination screen. It is removed from the
 * history entry right away so that it disappears on reload, and any message is
 * cleared on the next navigation.
 */
export function FlashProvider({ children }: { children: ReactNode }) {
  const [flash, setFlash] = useState<Flash | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const skipNextClear = useRef(false)

  useEffect(() => {
    const state = location.state as { flash?: Flash } | null
    if (state?.flash) {
      setFlash(state.flash)
      const { flash: _removed, ...rest } = state
      skipNextClear.current = true
      navigate(location.pathname + location.search, { replace: true, state: Object.keys(rest).length ? rest : null })
      return
    }
    if (skipNextClear.current) {
      skipNextClear.current = false
      return
    }
    setFlash(null)
    // Runs only when the history entry changes.
  }, [location.key])

  return <FlashContext.Provider value={{ flash, setFlash }}>{children}</FlashContext.Provider>
}

export function useFlash(): FlashState {
  const ctx = useContext(FlashContext)
  if (!ctx) throw new Error('useFlash must be used within FlashProvider')
  return ctx
}
