import type { ReactNode } from 'react'

/** Một dòng nhãn — giá trị của thẻ thanh toán (trang giả lập của kho mẫu và trang xác nhận khi nối backend). */
export function CheckoutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-line-soft py-3 last:border-b-0">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="m-0 text-right font-medium text-ink-strong">{children}</dd>
    </div>
  )
}
