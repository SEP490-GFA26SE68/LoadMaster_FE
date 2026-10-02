import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import { useT } from '@/lib/i18n'
import type { Coordinates } from './coordinates'
import { GOONG_STYLE_URL } from './map-style'

setWorkerUrl(workerUrl)

/** Tâm khi chưa có toạ độ: giữa vùng TP. Hồ Chí Minh – Đồng Nai – Bình Dương, như `RouteMapCanvas`. */
const FALLBACK_CENTER: [number, number] = [106.8, 10.9]

/**
 * Bản đồ bấm chọn toạ độ của `CoordinatePicker` (FE-4b-03, D-72) — chỉ dựng khi có khoá map tiles của Goong **và** có WebGL; không có
 * thì ô chọn toạ độ chỉ còn danh sách địa danh và hai ô gõ. Bấm lên bản đồ là chọn điểm đó; mốc đứng ở toạ độ đang có. Không xoay,
 * không nghiêng; lăn chuột chỉ phóng khi giữ Ctrl / ⌘. Bàn phím không bấm được lên bản đồ: lối tương đương là danh sách và hai ô gõ.
 */
export default function CoordinatePickerMap({ apiKey, value, onPick, onUnavailable }: {
  apiKey: string
  value: Coordinates | null
  onPick: (point: Coordinates) => void
  onUnavailable: () => void
}) {
  const t = useT()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const onPickRef = useRef(onPick)
  const initialRef = useRef(value)

  useEffect(() => {
    onPickRef.current = onPick
  }, [onPick])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const start = initialRef.current
    let map: MapLibreMap
    try {
      map = new MapLibreMap({
        container,
        style: `${GOONG_STYLE_URL}?api_key=${encodeURIComponent(apiKey)}`,
        center: start ? [start.lng, start.lat] : FALLBACK_CENTER,
        zoom: start ? 12 : 8,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        cooperativeGestures: true,
        attributionControl: { compact: true },
        locale: {
          'Map.Title': t('map.picker.map'),
          'NavigationControl.ZoomIn': t('map.zoomIn'),
          'NavigationControl.ZoomOut': t('map.zoomOut'),
          'AttributionControl.ToggleAttribution': t('map.attribution'),
          'CooperativeGesturesHandler.WindowsHelpText': t('map.gestures.ctrl'),
          'CooperativeGesturesHandler.MacHelpText': t('map.gestures.command'),
          'CooperativeGesturesHandler.MobileHelpText': t('map.gestures.touch'),
        },
      })
    } catch {
      onUnavailable()
      return
    }
    map.touchZoomRotate.disableRotation()
    map.keyboard.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.getCanvas().style.cursor = 'crosshair'
    map.on('click', (event) => onPickRef.current({ lat: Number(event.lngLat.lat.toFixed(5)), lng: Number(event.lngLat.lng.toFixed(5)) }))
    mapRef.current = map
    const resize = new ResizeObserver(() => map.resize())
    resize.observe(container)
    return () => {
      resize.disconnect()
      markerRef.current = null
      mapRef.current = null
      map.remove()
    }
    // Bản đồ dựng một lần; `CoordinatePicker` gắn `key` theo ngôn ngữ nên đổi ngôn ngữ là dựng lại với chuỗi mới.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lat = value?.lat
  const lng = value?.lng
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (lat === undefined || lng === undefined) {
      markerRef.current?.remove()
      markerRef.current = null
      return
    }
    // Mốc mặc định của MapLibre, tô bằng token thương hiệu thay màu xanh có sẵn của thư viện
    markerRef.current ??= new Marker({ color: getComputedStyle(map.getContainer()).getPropertyValue('--primary').trim() }).setLngLat([lng, lat]).addTo(map)
    markerRef.current.setLngLat([lng, lat])
    // Toạ độ đến từ danh sách hoặc ô gõ có thể nằm ngoài khung nhìn: đưa bản đồ về đó
    if (!map.getBounds().contains([lng, lat])) map.easeTo({ center: [lng, lat] })
  }, [lat, lng])

  return (
    <div className="relative h-56 overflow-hidden rounded-md border border-border bg-n-100">
      <div className="absolute inset-0">
        <div ref={containerRef} data-coordinate-map className="size-full" style={{ fontFamily: 'inherit' }} />
      </div>
    </div>
  )
}
