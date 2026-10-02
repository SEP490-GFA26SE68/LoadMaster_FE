import { expect, test } from 'vitest'
import { SEED_PLACES } from '@/lib/mock-db'
import { formatCoordinate, parseCoordinates } from './coordinates'
import { placeAddress, searchPlaces } from './place-search'

/** Địa danh mẫu và ô chọn toạ độ (FE-4b-03). Kỳ vọng chép tay từ `seed-places.ts`. */

const names = (query: string, limit?: number) => searchPlaces(SEED_PLACES, query, limit).map((place) => place.name)

test('the sample gazetteer has provinces, districts and industrial parks, each with a unique id and coordinates inside Vietnam', () => {
  expect(SEED_PLACES).toHaveLength(70)
  expect(new Set(SEED_PLACES.map((place) => place.kind))).toStrictEqual(new Set(['PROVINCE', 'DISTRICT', 'INDUSTRIAL_PARK']))
  expect(new Set(SEED_PLACES.map((place) => place.id)).size).toBe(70)
  expect([SEED_PLACES[0]?.id, SEED_PLACES.at(-1)?.id]).toStrictEqual(['PLC-001', 'PLC-070'])
  expect(SEED_PLACES.filter((place) => place.lat < 8 || place.lat > 23.5 || place.lng < 102 || place.lng > 110)).toStrictEqual([])
  expect(SEED_PLACES.find((place) => place.name === 'KCN Hoà Khánh')).toMatchObject({ kind: 'INDUSTRIAL_PARK', region: 'Q. Liên Chiểu, Đà Nẵng', lat: 16.0747, lng: 108.1506 })
})

test('search ignores diacritics and case; every word must match the name or the region', () => {
  expect(names('da nang')).toStrictEqual(['Đà Nẵng', 'Liên Chiểu', 'KCN Hoà Khánh'])
  expect(names('KCN SONG THAN')).toStrictEqual(['KCN Sóng Thần 1', 'KCN Sóng Thần 2'])
  expect(names('hoa khanh lien chieu')).toStrictEqual(['KCN Hoà Khánh'])
  expect(names('xyz')).toStrictEqual([])
})

test('names starting with the query come first; an empty query finds nothing; the limit cuts the list', () => {
  // "Biên Hoà" là tên một thành phố; hai khu công nghiệp chỉ có chữ đó ở giữa tên hoặc ở vùng
  expect(names('bien hoa')).toStrictEqual(['Biên Hoà', 'KCN Biên Hoà 2', 'KCN Amata'])
  // "Tân" đứng đầu tên bốn địa danh, và nằm giữa tên hai khu công nghiệp
  expect(names('tan')).toStrictEqual(['Tân Bình', 'Tân Uyên', 'Tân An', 'KCN Nam Tân Uyên', 'KCN Tân Bình', 'KCN Tân Tạo'])
  expect(names('   ')).toStrictEqual([])
  expect(names('kcn', 3)).toStrictEqual(['KCN Biên Hoà 2', 'KCN Amata', 'KCN Long Thành'])
})

test('the address of a place is its name followed by its region', () => {
  expect(placeAddress({ name: 'KCN Trà Nóc', region: 'Q. Bình Thuỷ, Cần Thơ' })).toBe('KCN Trà Nóc, Q. Bình Thuỷ, Cần Thơ')
})

test('typed coordinates: both or none, a dot or a comma, inside the valid range', () => {
  expect(parseCoordinates('', '  ')).toStrictEqual({ kind: 'empty' })
  expect(parseCoordinates('10.9294', '106,8747')).toStrictEqual({ kind: 'ok', lat: 10.9294, lng: 106.8747 })
  expect(parseCoordinates('-33.86', ' 151.2 ')).toStrictEqual({ kind: 'ok', lat: -33.86, lng: 151.2 })
  expect(parseCoordinates('10.9294', '')).toStrictEqual({ kind: 'error', field: 'lng', code: 'incomplete' })
  expect(parseCoordinates('', '106.8')).toStrictEqual({ kind: 'error', field: 'lat', code: 'incomplete' })
  expect(parseCoordinates('91', '106.8')).toStrictEqual({ kind: 'error', field: 'lat', code: 'invalid' })
  expect(parseCoordinates('10.9', '181')).toStrictEqual({ kind: 'error', field: 'lng', code: 'invalid' })
  expect(parseCoordinates('abc', '106.8')).toStrictEqual({ kind: 'error', field: 'lat', code: 'invalid' })
  expect(parseCoordinates('1e1', '106.8')).toStrictEqual({ kind: 'error', field: 'lat', code: 'invalid' })
})

test('a picked coordinate shows at most five decimals', () => {
  expect([formatCoordinate(10.9294), formatCoordinate(106.874712345), formatCoordinate(21)]).toStrictEqual(['10.9294', '106.87471', '21'])
})
