import { setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Worker của MapLibre đóng gói cùng app (không CDN): Vite dựng nó thành một file riêng và trả URL. Một chỗ duy nhất đặt URL đó —
// hai chunk lười của bản đồ (`RouteMapCanvas`, `CoordinatePickerMap`) cùng lấy thư viện từ đây nên dùng chung một chunk MapLibre.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)

export { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, type GeoJSONSource } from 'maplibre-gl'
