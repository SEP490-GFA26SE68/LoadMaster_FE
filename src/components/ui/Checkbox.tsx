import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Checkbox 18px (V2.3 `.cbx`): viền 1,5px `--n-500`, bo 4px. Chọn: nền `--primary` (cyan-700), dấu tích trắng stroke 3.
 */
export function Checkbox({
  className,
  label,
  id,
  disabled,
  ...props
}: ComponentProps<typeof CheckboxPrimitive.Root> & { label?: ReactNode }) {
  const generatedId = useId()
  const boxId = id ?? generatedId

  return (
    <div className="flex items-center gap-2.5">
      <CheckboxPrimitive.Root
        id={boxId}
        disabled={disabled}
        className={cn(
          'grid size-4.5 flex-none place-items-center rounded-xs border-[1.5px]',
          'transition-colors duration-(--dur-fast) ease-standard',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          'border-n-500 bg-bg',
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
          'disabled:cursor-not-allowed disabled:border-n-300 disabled:bg-n-100',
          className,
        )}
        {...props}
      >
        <CheckboxPrimitive.Indicator>
          <Check className="size-3 text-white" strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? (
        <label
          htmlFor={boxId}
          className={cn(
            'cursor-pointer text-body',
            disabled ? 'cursor-not-allowed text-n-600' : 'text-text',
          )}
        >
          {label}
        </label>
      ) : null}
    </div>
  )
}
