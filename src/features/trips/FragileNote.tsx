import { TriangleAlert } from 'lucide-react'
import type { CargoPackage } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { isFragile } from './package-requirements'

/**
 * Ghi chú hàng dễ vỡ ở cột phải của Chi tiết chuyến (V2): số kiện mức Cao và tên các dòng kiện đó, để điều phối xem yêu cầu trước khi
 * xếp. Nền tint hổ phách — nghĩa "cần chú ý" (AGENTS mục 4). Không có kiện dễ vỡ thì không hiện gì.
 */
export function FragileNote({ packages }: { packages: readonly CargoPackage[] }) {
  const t = useT()
  const format = useFormat()
  const fragile = packages.filter(isFragile)
  if (fragile.length === 0) return null
  const count = fragile.reduce((sum, pkg) => sum + pkg.quantity, 0)

  return (
    // V2.3: ô ghi chú hổ phách trong mục Tóm tắt hàng hoá (`ChiTietChuyen.jpg` .note)
    <section role="note" className="flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-small text-ink-strong">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none text-amber-700" strokeWidth={1.75} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-semibold text-amber-700">{t('trips.packages.fragileTitle', { count })}</span>
        <span className="text-ink-2">{t('trips.packages.fragileNote', { names: format.list(fragile.map((pkg) => pkg.name)) })}</span>
      </div>
    </section>
  )
}
