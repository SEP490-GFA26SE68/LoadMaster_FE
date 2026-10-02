import { expect, test } from 'vitest'
import { baseStyle, emptyStyle, goongMapTilesKey, GOONG_STYLE_URL } from './map-style'
import { projectToSketch, routeExtent, routeLine } from './route-map-model'

const DEPOT = { name: 'Kho Long Bình', lat: 10.9294, lng: 106.8747 }
const STOPS = [
  { id: 'STOP-04', number: 4, name: 'Biên Hoà', lat: 10.947, lng: 106.824 },
  { id: 'STOP-03', number: 3, name: 'Dĩ An', lat: 10.8935, lng: 106.783 },
]

test('the route line joins the depot and the stops in visiting order; a backend polyline replaces it', () => {
  expect(routeLine({ depot: DEPOT, stops: STOPS })).toStrictEqual([DEPOT, ...STOPS])
  expect(routeLine({ stops: STOPS })).toStrictEqual(STOPS)
  const path = [{ lat: 10.93, lng: 106.87 }, { lat: 10.94, lng: 106.85 }, { lat: 10.947, lng: 106.824 }]
  expect(routeLine({ depot: DEPOT, stops: STOPS, path })).toBe(path)
})

test('the extent covers the vehicle too, though it is not on the line', () => {
  const vehicle = { name: '60C-123.45', lat: 11.2, lng: 107.1 }
  expect(routeExtent({ depot: DEPOT, stops: STOPS, vehicle })).toContainEqual(vehicle)
  expect(routeLine({ depot: DEPOT, stops: STOPS, vehicle })).not.toContainEqual(vehicle)
})

test('the sketch projection keeps north up, east right, the padding and the aspect ratio', () => {
  const size = { width: 200, height: 100, padding: 10 }
  // Quanh xích đạo (vĩ độ giữa = 0, cos = 1) một độ kinh dài bằng một độ vĩ: ô 1° × 1° vừa chiều cao 80, căn giữa chiều ngang.
  const [southWest, northEast, center] = projectToSketch(
    [{ lat: -0.5, lng: 0 }, { lat: 0.5, lng: 1 }, { lat: 0, lng: 0.5 }],
    size,
  )
  expect(southWest).toStrictEqual({ x: 60, y: 90 })
  expect(northEast).toStrictEqual({ x: 140, y: 10 })
  expect(center).toStrictEqual({ x: 100, y: 50 })
})

test('the sketch projection shrinks longitude by the cosine of the latitude', () => {
  // Ở vĩ độ 60° một độ kinh dài bằng nửa độ vĩ: hộp 2° kinh × 1° vĩ quanh vĩ độ 60° là hình vuông.
  const [a, b] = projectToSketch([{ lat: 59.5, lng: 10 }, { lat: 60.5, lng: 12 }], { width: 100, height: 100, padding: 0 })
  expect(a?.x).toBeCloseTo(0, 6)
  expect(a?.y).toBeCloseTo(100, 6)
  expect(b?.x).toBeCloseTo(100, 6)
  expect(b?.y).toBeCloseTo(0, 6)
})

test('a single point, or identical points, sit in the middle; no points project to nothing', () => {
  const size = { width: 200, height: 100, padding: 10 }
  expect(projectToSketch([DEPOT, DEPOT], size)).toStrictEqual([{ x: 100, y: 50 }, { x: 100, y: 50 }])
  expect(projectToSketch([], size)).toStrictEqual([])
})

test('base style: the Goong web style with the key, an empty style without it — never another tile source', () => {
  expect(baseStyle('abc 123', '#E7EFF1')).toBe(`${GOONG_STYLE_URL}?api_key=abc%20123`)
  expect(GOONG_STYLE_URL).toBe('https://tiles.goong.io/assets/goong_map_web.json')
  const blank = baseStyle(undefined, '#E7EFF1')
  expect(blank).toStrictEqual({ version: 8, sources: {}, layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#E7EFF1' } }] })
  expect(JSON.stringify(emptyStyle('#E7EFF1'))).not.toMatch(/https?:/)
})

test('the map tiles key comes from VITE_GOONG_MAPTILES_KEY; blank means no key', () => {
  expect(goongMapTilesKey({ VITE_GOONG_MAPTILES_KEY: ' key-1 ' })).toBe('key-1')
  expect(goongMapTilesKey({ VITE_GOONG_MAPTILES_KEY: '' })).toBeUndefined()
  expect(goongMapTilesKey({ VITE_GOONG_MAPTILES_KEY: '   ' })).toBeUndefined()
  expect(goongMapTilesKey({})).toBeUndefined()
})

test('maplibre-gl is imported only inside src/components/map (AGENTS mục 2)', () => {
  const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })
  const importers = Object.entries(sources)
    .filter(([path, source]) => !path.endsWith('.test.ts') && /(from|import|import\()\s*'maplibre-gl/.test(source))
    .map(([path]) => path)
  expect(importers.filter((path) => !path.startsWith('/src/components/map/'))).toStrictEqual([])
  // chỉ hai file chạy thư viện (file còn lại chỉ lấy kiểu), đều là chunk lười: bản đồ của `RouteMap` và của `CoordinatePicker`
  const runtime = importers.filter((path) => !/^import type [^\n]* from 'maplibre-gl'$/m.test(sources[path] ?? ''))
  expect(runtime).toStrictEqual(['/src/components/map/CoordinatePickerMap.tsx', '/src/components/map/RouteMapCanvas.tsx'])
  for (const path of runtime) {
    const name = path.slice(path.lastIndexOf('/') + 1, -'.tsx'.length)
    const users = Object.entries(sources).filter(([other, source]) => other !== path && !other.endsWith('.test.ts') && source.includes(`./${name}'`))
    expect(users.map(([, source]) => source.includes(`lazy(() => import('./${name}'))`))).toStrictEqual([true])
  }
})
