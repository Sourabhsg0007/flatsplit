import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from './ui/button'

const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)

  // push(kind, text, action?) — action: { label, onClick }
  const push = useCallback((kind, text, action = null) => {
    const id = ++idRef.current
    setToasts((prev) => [...prev, { id, kind, text, action }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, action ? 6000 : 3500)
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
            {t.action && (
              <Button
                variant="ghost"
                size="sm"
                className="toast-action"
                onClick={() => { t.action.onClick(); dismiss(t.id) }}
              >
                {t.action.label}
              </Button>
            )}
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
