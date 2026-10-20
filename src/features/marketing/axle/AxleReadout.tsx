import { CircleCheck, TriangleAlert } from 'lucide-react'
import type { CSSProperties } from 'react'
import { roundKg } from '@/domain/geometry'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { meterParts, type AxleDemoGroup, type AxleDemoResult } from './axle-demo'

/**
 * Thanh đo của một trục: phần tải khi xe rỗng (xám) rồi phần hàng dồn lên (cyan, vượt giới hạn thì đỏ), vạch giới hạn ở hai phần ba thanh.
 * Hai phần chạy bằng `transform` (không đổi bố cục); hình là trang trí — số và chữ "Vượt …" ở ngay trên thanh.
 */
function AxleMeter({ load }: { load: AxleDemoGroup }) {
  const parts = meterParts(load)
  const over = load.overKg !== null
  const base = { transform: `scaleX(${parts.base.toFixed(4)})` } as CSSProperties
  const cargo = { transform: `translateX(${(parts.base * 100).toFixed(3)}%) scaleX(${parts.cargo.toFixed(4)})` } as CSSProperties
  return (
    <div aria-hidden className="relative h-3 rounded-full bg-n-100">
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div className="ax-meter absolute inset-0 origin-left bg-n-300" style={base} />
        <div className={cn('ax-meter absolute inset-0 origin-left', over ? 'bg-danger' : 'ax-meter-fill')} style={cargo} />
      </div>
      <span className="absolute -inset-y-1.5 w-0.5 -translate-x-1/2 rounded-sm bg-ink-strong" style={{ left: `${(parts.limit * 100).toFixed(3)}%` }} />
    </div>
  )
}

/** Một trục: tên, trạng thái bằng chữ kèm icon, tải / giới hạn, thanh đo và phần tách tải rỗng / hàng. */
function AxleRow({ load }: { load: AxleDemoGroup }) {
  const t = useT()
  const format = useFormat()
  const over = load.overKg !== null
  const cargoKg = roundKg(Math.abs(load.cargoLoadKg))
  const split = { empty: format.weight(load.emptyLoadKg), cargo: format.weight(cargoKg) }
  return (
    <div className="flex flex-col gap-2.5" data-axle-row={load.group}>
      <dt className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="text-body-lg font-semibold text-ink-strong">{t(`landingAxle.readout.groups.${load.group}`)}</span>
        <span className={cn('flex items-center gap-1.5 text-body font-semibold pointer-coarse:text-body-lg', over ? 'text-danger' : 'text-success')}>
          {over ? <TriangleAlert aria-hidden className="size-4" strokeWidth={1.5} /> : <CircleCheck aria-hidden className="size-4" strokeWidth={1.5} />}
          {over ? t('landingAxle.readout.over', { over: format.weight(load.overKg ?? 0) }) : t('landingAxle.readout.within')}
        </span>
      </dt>
      <dd className="m-0 flex flex-col gap-2.5">
        <span className="font-display text-h2 font-bold tabular-nums text-ink-strong font-stretch-108%">
          {t('landingAxle.readout.load', { load: format.weight(roundKg(load.loadKg)), limit: format.weight(load.limitKg) })}
        </span>
        <AxleMeter load={load} />
        <span className="text-body text-ink-2 tabular-nums pointer-coarse:text-body-lg">
          {load.cargoLoadKg < 0 ? t('landingAxle.readout.lifted', split) : t('landingAxle.readout.added', split)}
        </span>
      </dd>
    </div>
  )
}

/**
 * Bảng số của mục tải trục: tiêu đề rồi hai trục. Vượt giới hạn luôn có chữ "Vượt …" và icon,
 * không chỉ đổi màu. Vùng `aria-live` nằm ở `LandingAxle` (đọc sau khi người xem thôi kéo), không ở đây — số ở đây đổi theo từng bước.
 */
export function AxleReadout({ result }: { result: AxleDemoResult }) {
  const t = useT()
  return (
    <div className="flex flex-col gap-5">
      <h3 className="m-0 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('landingAxle.readout.title')}</h3>
      <dl className="m-0 flex flex-col gap-6">
        <AxleRow load={result.front} />
        <AxleRow load={result.rear} />
      </dl>
    </div>
  )
}
