import { expect, test } from 'vitest'
import { decodePolyline, encodePolyline, pathFromEncodedPolylines } from './polyline'

test('encode then decode round-trips coordinates', () => {
  const points = [
    { lat: 10.7626, lng: 106.6601 },
    { lat: 10.7769, lng: 106.7009 },
    { lat: 10.8500, lng: 106.7600 },
  ]
  const decoded = decodePolyline(encodePolyline(points))
  expect(decoded).toHaveLength(points.length)
  decoded.forEach((point, index) => {
    expect(point.lat).toBeCloseTo(points[index]!.lat, 5)
    expect(point.lng).toBeCloseTo(points[index]!.lng, 5)
  })
})

test('empty and blank polylines yield no points', () => {
  expect(decodePolyline('')).toStrictEqual([])
  expect(pathFromEncodedPolylines([null, undefined, ''])).toStrictEqual([])
})

test('pathFromEncodedPolylines merges legs and drops duplicate joints', () => {
  const leg1 = encodePolyline([
    { lat: 10.76, lng: 106.66 },
    { lat: 10.77, lng: 106.67 },
  ])
  const leg2 = encodePolyline([
    { lat: 10.77, lng: 106.67 },
    { lat: 10.78, lng: 106.68 },
  ])
  const path = pathFromEncodedPolylines([leg1, leg2])
  expect(path).toHaveLength(3)
  expect(path[0]?.lat).toBeCloseTo(10.76, 5)
  expect(path[1]?.lat).toBeCloseTo(10.77, 5)
  expect(path[2]?.lat).toBeCloseTo(10.78, 5)
})
