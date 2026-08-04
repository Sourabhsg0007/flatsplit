import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Checkbox = CheckboxPrimitive.Root

export function CheckboxControl({ className, ...props }) {
  return (
    <CheckboxPrimitive.Root className={cn('ui-checkbox', className)} {...props}>
      <CheckboxPrimitive.Indicator className="ui-checkbox-indicator">
        <Check size={14} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
