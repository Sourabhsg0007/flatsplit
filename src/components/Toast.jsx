import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  const push = useCallback((kind, text) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, kind, text }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span>{t.text}</span>
            <Button variant="ghost" size="icon" className="toast-dismiss" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={15} />
            </Button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
