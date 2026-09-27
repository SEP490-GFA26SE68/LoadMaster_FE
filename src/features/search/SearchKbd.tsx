import type { ReactNode } from 'react'

/** Phím gợi ý trên kính tối của hộp tìm nhanh (V2.3 `.cmdk kbd`): ô 22px viền trắng mờ, chữ 11,5 / 600. */
export function SearchKbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-5.5 min-w-5.5 flex-none place-items-center rounded-sm border border-sky-glass-border bg-sky-glass px-1.5 font-sans text-note leading-none font-semibold text-glass-dark-text">
      {children}
    </kbd>
  )
}
