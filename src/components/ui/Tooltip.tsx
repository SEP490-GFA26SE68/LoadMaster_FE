import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Tooltip V2.3 (`.tip`): nền `--cyan-950`, chữ `--cyan-50` 12,5px, bo 6px. Là lớp nổi nên được dùng bóng (mục 5 AGENTS.md).
 */
export const TooltipProvider = TooltipPrimitive.Provider
export const Tooltip = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipContent({
  className,
  sideOffset = 10,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-100 rounded-sm bg-cyan-950 px-2.5 py-1.5',
          'text-fine text-cyan-50 shadow-e2',
          'select-none',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}
