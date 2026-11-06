import { afterEach, expect, test, vi } from 'vitest'
import { fetchRoadPath } from './road-path'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('fetchRoadPath maps OSRM geojson coordinates to lat/lng', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ geometry: { coordinates: [[106.66, 10.76], [106.67, 10.77], [106.7, 10.78]] } }],
      }),
    })),
  )

  const path = await fetchRoadPath([
    { lat: 10.76, lng: 106.66 },
    { lat: 10.78, lng: 106.7 },
  ])

  expect(path).toStrictEqual([
    { lat: 10.76, lng: 106.66 },
    { lat: 10.77, lng: 106.67 },
    { lat: 10.78, lng: 106.7 },
  ])
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('router.project-osrm.org/route/v1/driving/106.66,10.76;106.7,10.78'),
  )
})

test('fetchRoadPath returns undefined when OSRM fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
  expect(await fetchRoadPath([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }])).toBeUndefined()
})
