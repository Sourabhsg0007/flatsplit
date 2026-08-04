import { forwardRef } from 'react'
import { cn } from '../../lib/utils'

const variants = {
  default: 'ui-button-default',
  secondary: 'ui-button-secondary',
  outline: 'ui-button-outline',
  ghost: 'ui-button-ghost',
  destructive: 'ui-button-destructive',
  link: 'ui-button-link',
}

const sizes = {
  default: 'ui-button-md',
  sm: 'ui-button-sm',
  lg: 'ui-button-lg',
  icon: 'ui-button-icon',
}

export const Button = forwardRef(function Button({ className, variant = 'default', size = 'default', ...props }, ref) {
  return <button ref={ref} className={cn('ui-button', variants[variant], sizes[size], className)} {...props} />
})
