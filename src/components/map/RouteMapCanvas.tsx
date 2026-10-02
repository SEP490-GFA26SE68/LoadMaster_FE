import { LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Worker của MapLibre đóng gói cùng app (không CDN): Vite dựng nó thành file riêng và trả URL.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/Button'
import type { GeoPoint } from '@/domain/routing'
import { useT } from '@/lib/i18n'
import { baseStyle, emptyStyle, goongMapTilesKey } from './map-style'
import { routeExtent, routeLine, type RouteMapData } from './route-map-model'
import { DepotMarker, StopMarker, VehicleMarker } from './RouteMapMarker'

setWorkerUrl(workerUrl)

const ROUTE = 'route-line'
const FIT = { padding: 48, maxZoom: 14, animate: false } as const
/** Tâm lúc dựng, trước khi canh theo dữ liệu: giữa vùng TP. Hồ Chí Minh – Đồng Nai – Bình Dương. */
const FALLBACK_CENTER: [number, number] = [106.8, 10.9]

type Pin = { key: string; point: GeoPoint; kind: 'depot' | 'stop' | 'vehicle'; number?: number; element: HTMLElement }

const lngLat = (point: GeoPoint): [number, number] => [point.lng, point.lat]
const token = (element: Element, name: string) => getComputedStyle(element).getPropertyValue(name).trim()

function drawLine(map: MapLibreMap, line: readonly GeoPoint[], color: string) {
  const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: line.map(lngLat) } }
  const source = map.getSource<GeoJSONSource>(ROUTE)
  if (source) {
    source.setData(data)
    return
  }
  map.addSource(ROUTE, { type: 'geojson', data })
  map.addLayer({ id: ROUTE, type: 'line', source: ROUTE, layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': color, 'line-width': 3 } })
}

function fit(map: MapLibreMap, extent: readonly GeoPoint[]) {
  const [first] = extent
  if (!first) return
  map.fitBounds(extent.reduce((bounds, point) => bounds.extend(lngLat(point)), new LngLatBounds(lngLat(first), lngLat(first))), FIT)
}

/**
 * Bản đồ MapLibre của `RouteMap` (FE-4b-07) — file duy nhất chạy `maplibre-gl`, chỉ tải khi có WebGL. Đường tuyến là một lớp
 * GeoJSON; mốc là phần tử DOM do React vẽ qua portal (token và màu điểm giao của app, không dùng sprite hay font của style nền).
 * Không xoay, không nghiêng: bắc luôn ở trên. Lăn chuột chỉ phóng to khi giữ Ctrl / ⌘ để trang vẫn cuộn được qua bản đồ.
 */
export default function RouteMapCanvas({ data, onUnavailable }: { data: RouteMapData; onUnavailable: () => void }) {
  const t = useT()
  const hintId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const styleReadyRef = useRef(false)
  const dataRef = useRef(data)

  const pins = useMemo<Pin[]>(() => {
    const pin = (key: string, point: GeoPoint, kind: Pin['kind'], number?: number): Pin => {
      const element = document.createElement('div')
      element.setAttribute('aria-hidden', 'true')
      return { key, point, kind, number, element }
    }
    return [
      ...(data.depot ? [pin('depot', data.depot, 'depot')] : []),
      ...data.stops.map((stop) => pin(`stop:${stop.id}`, stop, 'stop', stop.number)),
      ...(data.vehicle ? [pin('vehicle', data.vehicle, 'vehicle')] : []),
    ]
  }, [data])
  /** Khung nhìn chỉ canh lại khi kho, điểm giao hoặc đường tuyến đổi — xe chạy (F6) không giật khung nhìn của người đang xem. */
  const extentKey = JSON.stringify(routeExtent({ ...data, vehicle: undefined }).map(lngLat))

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const background = token(container, '--n-100')
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: baseStyle(goongMapTilesKey(), background),
        center: FALLBACK_CENTER,
        zoom: 9,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
        attributionControl: { compact: true },
        locale: {
          'Map.Title': t('map.canvas'),
          'AttributionControl.ToggleAttribution': t('map.attribution'),
          'CooperativeGesturesHandler.WindowsHelpText': t('map.gestures.ctrl'),
          'CooperativeGesturesHandler.MacHelpText': t('map.gestures.command'),
          'CooperativeGesturesHandler.MobileHelpText': t('map.gestures.touch'),
        },
      })
    } catch {
      // WebGL bị chặn hoặc không tạo được context: RouteMap vẽ sơ đồ SVG thay thế.
      onUnavailable()
      return
    }
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    mapRef.current = map

    map.on('style.load', () => {
      styleReadyRef.current = true
      drawLine(map, routeLine(dataRef.current), token(container, '--primary'))
    })
    // Style nền không tải được (khoá sai, mất mạng): về nền trống, lớp dữ liệu vẫn vẽ.
    map.on('error', () => {
      if (!styleReadyRef.current && goongMapTilesKey()) map.setStyle(emptyStyle(background))
    })
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(container)

    return () => {
      resize.disconnect()
      styleReadyRef.current = false
      mapRef.current = null
      map.remove()
    }
    // Bản đồ dựng một lần; `RouteMap` gắn `key` theo ngôn ngữ nên đổi ngôn ngữ là dựng lại với chuỗi mới.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    dataRef.current = data
    const map = mapRef.current
    const container = containerRef.current
    if (!map || !container) return
    if (styleReadyRef.current) drawLine(map, routeLine(data), token(container, '--primary'))
    const markers = pins.map((pin) => new Marker({ element: pin.element }).setLngLat(lngLat(pin.point)).addTo(map))
    return () => markers.forEach((marker) => marker.remove())
  }, [data, pins])

  useEffect(() => {
    if (mapRef.current) fit(mapRef.current, routeExtent({ ...dataRef.current, vehicle: undefined }))
  }, [extentKey])

  // Khung ngoài của `RouteMap` đã mang tên bản đồ; canvas (MapLibre tự đặt role="region") chỉ nói nó là phần điều khiển được.
  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute('aria-describedby', hintId)
  }, [hintId])

  return (
    <>
      {/* MapLibre đặt `position: relative` lên khung của nó, nên lớp phủ kín vùng là phần tử bọc ngoài. */}
      <div className="absolute inset-0">
        <div ref={containerRef} data-route-map className="size-full" style={{ fontFamily: 'inherit' }} />
      </div>
      <p id={hintId} className="sr-only">{t('map.keyboardHint')}</p>
      <div className="pointer-events-none absolute top-3 right-3 flex flex-col gap-1.5">
        {([
          ['zoomIn', Plus, () => mapRef.current?.zoomIn()],
          ['zoomOut', Minus, () => mapRef.current?.zoomOut()],
          ['fit', Maximize2, () => mapRef.current && fit(mapRef.current, routeExtent(dataRef.current))],
        ] as const).map(([key, Icon, onClick]) => (
          <Button
            key={key}
            type="button"
            variant="secondary"
            size="icon"
            className="pointer-events-auto pointer-coarse:size-12"
            aria-label={t(`map.${key}`)}
            title={t(`map.${key}`)}
            onClick={onClick}
          >
            <Icon strokeWidth={1.75} />
          </Button>
        ))}
      </div>
      {pins.map((pin) =>
        createPortal(
          pin.kind === 'stop' ? <StopMarker number={pin.number ?? 0} /> : pin.kind === 'depot' ? <DepotMarker /> : <VehicleMarker />,
          pin.element,
          pin.key,
        ),
      )}
    </>
  )
}
