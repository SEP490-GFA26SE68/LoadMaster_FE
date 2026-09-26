import { useT } from '@/lib/i18n'
import { readToken } from '@/lib/tokens'
import { cn } from '@/lib/utils'
import { SheetCard } from '../SheetLayout'

export type SwatchStep = {
  /** Bậc hiện trên ô: "50", "700"… */
  label: string
  token: `--${string}`
  note?: string
}

/**
 * Một thang màu (cyan thương hiệu, xám ánh cyan): ô màu tô bằng chính token, mã hex đọc từ CSS lúc chạy (`readToken`) — sửa
 * `src/index.css` là trang đổi theo, không có hex nào ghi tay ở đây. Không đọc được (jsdom) thì hiện "—".
 */
export function SwatchScaleCard({ title, meta, steps }: { title: string; meta: string; steps: readonly SwatchStep[] }) {
  const t = useT()
  return (
    <SheetCard title={title} meta={meta} className="col-span-12">
      <ol
        className={cn(
          'm-0 grid list-none grid-cols-4 gap-2 p-0 sm:grid-cols-6',
          steps.length > 11 ? 'lg:grid-cols-12' : 'lg:grid-cols-11',
        )}
      >
        {steps.map((step) => (
          <li key={step.token} className="flex min-w-0 flex-col">
            <span
              aria-hidden
              className="flex h-14.5 items-end rounded-md border border-n-900/6 p-1.5"
              style={{ background: `var(${step.token})` }}
            >
              <span className="rounded-sm bg-bg/92 px-1.5 py-1 font-display text-note leading-none font-[650] text-n-900 ring-1 ring-n-900/8">
                {step.label}
              </span>
            </span>
            <span className="sr-only">{step.token}</span>
            <span className="mt-1.75 font-mono text-note leading-none text-ink-3">{readToken(step.token) || t('designSystem.style.unread')}</span>
            {step.note ? <span className="mt-1 text-note text-ink-2">{step.note}</span> : null}
          </li>
        ))}
      </ol>
    </SheetCard>
  )
}
