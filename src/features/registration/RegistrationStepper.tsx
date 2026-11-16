import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Thanh bước của đăng ký trả phí: bước đã xong mang dấu kiểm, bước đang làm có quầng. */
export function RegistrationStepper({ current, labels }: { current: number; labels: string[] }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      {labels.map((label, idx) => {
        const num = idx + 1
        return (
          <div key={num} className="flex flex-1 items-center">
            <div className="flex flex-none flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-full text-caption font-semibold transition-colors',
                  current === num ? 'bg-primary text-n-0 ring-4 ring-primary/20' : current > num ? 'bg-success text-n-0' : 'bg-n-100 text-ink-3',
                )}
              >
                {current > num ? <Check className="size-4" strokeWidth={1.5} /> : num}
              </div>
              <span className={cn('text-caption font-medium', current >= num ? 'text-ink-strong' : 'text-ink-3')}>{label}</span>
            </div>
            {idx < labels.length - 1 && (
              <div className={cn('mx-2 h-0.5 flex-1 transition-colors', current > num ? 'bg-success' : 'bg-line-soft')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
