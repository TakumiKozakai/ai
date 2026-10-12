import { useFlash } from '../context/FlashContext'

/** Screen message shown right below the header (common spec 5.1). */
export default function FlashMessage() {
  const { flash } = useFlash()
  if (!flash) return null
  return (
    <p className={`flash flash-${flash.type}`} role={flash.type === 'error' ? 'alert' : 'status'}>
      {flash.text}
    </p>
  )
}
