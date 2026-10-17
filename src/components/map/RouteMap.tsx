import { Map as MapIcon, Maximize2 } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
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
 * vẫn vẽ. `others` là xe của các chuyến khác (màn Giám sát): chỉ vị trí. Không có WebGL thì là sơ đồ SVG cùng dữ liệu. Hình luôn `aria-hidden`: nội dung tương đương là danh sách điểm `sr-only`.
 *
 * Nút Maximize2 trên canvas (và trên sơ đồ SVG) mở hộp thoại bản đồ lớn để quan sát dễ hơn — mọi chỗ dùng `RouteMap` đều có.
 */
export function RouteMap({ label, className, depot, stops, vehicle, others, path }: RouteMapProps) {
  const t = useT()
  const { locale } = useLocale()
  const [unavailable, setUnavailable] = useState(false)
  const [expanded, setExpanded] = useState(false)
  // Màn gọi thường dựng mảng mới mỗi lần render: giữ nguyên tham chiếu khi nội dung không đổi để mốc không bị gỡ rồi gắn lại.
  const json = JSON.stringify({ depot, stops, vehicle, others, path })
  const data = useMemo(() => JSON.parse(json) as RouteMapData, [json])
  const sketch = <RouteMapSketch data={data} />
  const useCanvas = HAS_WEBGL && !unavailable

  return (
    <>
      <div role="region" aria-label={label} className={cn('relative h-80 overflow-hidden rounded-md border border-border bg-n-100', className)}>
        {useCanvas ? (
          <Suspense fallback={sketch}>
            <RouteMapCanvas
              key={locale}
              data={data}
              onUnavailable={() => setUnavailable(true)}
              onExpand={() => setExpanded(true)}
            />
          </Suspense>
        ) : (
          <>
            {sketch}
            <div className="pointer-events-none absolute top-3 right-3">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="pointer-events-auto pointer-coarse:size-12"
                aria-label={t('map.expand')}
                title={t('map.expand')}
                onClick={() => setExpanded(true)}
              >
                <Maximize2 strokeWidth={1.75} />
              </Button>
            </div>
          </>
        )}
        <ol aria-label={t('map.points')} className="sr-only">
          {data.depot ? <li>{t('map.depot', { name: data.depot.name })}</li> : null}
          {data.stops.map((stop) => (
            <li key={stop.id}>{t('map.stop', { number: stop.number, name: stop.name })}</li>
          ))}
          {data.vehicle ? <li>{t('map.vehicle', { name: data.vehicle.name })}</li> : null}
          {data.others?.map((other) => (
            <li key={other.id}>{t('map.vehicle', { name: other.name })}</li>
          ))}
        </ol>
      </div>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        {expanded ? (
          <DialogContent className="w-[min(96vw,80rem)] max-w-full">
            <DialogHeader
              icon={MapIcon}
              title={t('map.expandTitle')}
              description={label}
            />
            <div className="px-7 pb-2 max-sm:px-5">
              <div
                role="region"
                aria-label={t('map.expandMap', { label })}
                className="relative h-[min(75dvh,48rem)] overflow-hidden rounded-md border border-border bg-n-100"
              >
                {useCanvas ? (
                  <Suspense fallback={sketch}>
                    {/* Không truyền onExpand: nút Maximize2 trong modal = canh toàn tuyến. */}
                    <RouteMapCanvas
                      key={`expanded-${locale}`}
                      data={data}
                      onUnavailable={() => setUnavailable(true)}
                    />
                  </Suspense>
                ) : (
                  sketch
                )}
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">{t('map.expandClose')}</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  )
}
