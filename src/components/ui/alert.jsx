import { cn } from '../../lib/utils'

export function Alert({ className, variant = 'default', ...props }) {
  return <div role={variant === 'destructive' ? 'alert' : undefined} className={cn('ui-alert', `ui-alert-${variant}`, className)} {...props} />
}

export function AlertTitle({ className, ...props }) {
  return <h3 className={cn('ui-alert-title', className)} {...props} />
}

export function AlertDescription({ className, ...props }) {
  return <div className={cn('ui-alert-description', className)} {...props} />
}
