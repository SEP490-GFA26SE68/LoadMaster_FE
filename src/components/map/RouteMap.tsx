import { lazy, Suspense, useMemo, useState } from 'react'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { RouteMapData } from './route-map-model'
import { RouteMapSketch } from './RouteMapSketch'

const RouteMapCanvas = lazy(() => import('./RouteMapCanvas'))

/** jsdom và trình duyệt tắt WebGL không có lớp này: khi đó không tải chunk MapLibre, chỉ vẽ sơ đồ SVG (như `VehiclePreview`). */
const HAS_WEBGL = typeof WebGLRenderingContext !== 'undefined'

type RouteMapProps = RouteMapData & {
  /** Tên vùng bản đồ cho trình đọc màn hình: "Bản đồ tuyến TRIP-…". */
  label: string
  /** Mặc định cao 320 px; truyền lớp chiều cao khác khi màn cần. */
  className?: string
}

/**
 * Bản đồ tuyến dùng chung (FE-4b-07, D-75): kho xuất phát, điểm giao theo thứ tự đi (màu điểm giao kèm số), đường tuyến (nối thẳng,
 * hoặc `path` khi backend trả polyline) và vị trí xe. MapLibre GL tải lười trên nền Goong; không có khoá thì nền trống, lớp dữ liệu
 * vẫn vẽ. Không có WebGL thì là sơ đồ SVG cùng dữ liệu. Hình luôn `aria-hidden`: nội dung tương đương là danh sách điểm `sr-only`.
 */
export function RouteMap({ label, className, depot, stops, vehicle, path }: RouteMapProps) {
  const t = useT()
  const { locale } = useLocale()
  const [unavailable, setUnavailable] = useState(false)
  // Màn gọi thường dựng mảng mới mỗi lần render: giữ nguyên tham chiếu khi nội dung không đổi để mốc không bị gỡ rồi gắn lại.
  const json = JSON.stringify({ depot, stops, vehicle, path })
  const data = useMemo(() => JSON.parse(json) as RouteMapData, [json])
  const sketch = <RouteMapSketch data={data} />

  return (
    <div role="region" aria-label={label} className={cn('relative h-80 overflow-hidden rounded-md border border-border bg-n-100', className)}>
      {HAS_WEBGL && !unavailable ? (
        <Suspense fallback={sketch}>
          <RouteMapCanvas key={locale} data={data} onUnavailable={() => setUnavailable(true)} />
        </Suspense>
      ) : (
        sketch
      )}
      <ol aria-label={t('map.points')} className="sr-only">
        {data.depot ? <li>{t('map.depot', { name: data.depot.name })}</li> : null}
        {data.stops.map((stop) => (
          <li key={stop.id}>{t('map.stop', { number: stop.number, name: stop.name })}</li>
        ))}
        {data.vehicle ? <li>{t('map.vehicle', { name: data.vehicle.name })}</li> : null}
      </ol>
    </div>
  )
}
