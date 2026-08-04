import { cn } from '../../lib/utils'

export function Skeleton({ className, ...props }) {
  return <span className={cn('ui-skeleton', className)} {...props} />
}
