import { cn } from '../../lib/utils'

export function Badge({ className, variant = 'secondary', ...props }) {
  return <span className={cn('ui-badge', `ui-badge-${variant}`, className)} {...props} />
}
