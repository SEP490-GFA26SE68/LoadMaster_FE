import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { RouteMap } from '@/components/map'
import { nextGuidance, parseGuidanceSteps, remainingTo, type GeoPoint, type GuidanceStep, type NextGuidance } from '@/domain/routing'
import { getActiveRoutePlan } from '@/features/trips/route-plan-api'
import { useTripRoutePathQuery } from '@/features/trips/useRouteQuery'
import { useT, type MessageKey } from '@/lib/i18n'
import type { DeliveryStop, Trip } from '@/lib/mock-db'

const MANEUVER_KEYS = {
  'turn-right': 'driver.guidance.maneuvers.turn-right',
  'turn-left': 'driver.guidance.maneuvers.turn-left',
  straight: 'driver.guidance.maneuvers.straight',
  'uturn-right': 'driver.guidance.maneuvers.uturn-right',
  'uturn-left': 'driver.guidance.maneuvers.uturn-left',
  arrive: 'driver.guidance.maneuvers.arrive',
  'ramp-right': 'driver.guidance.maneuvers.ramp-right',
  'ramp-left': 'driver.guidance.maneuvers.ramp-left',
  merge: 'driver.guidance.maneuvers.merge',
  'fork-right': 'driver.guidance.maneuvers.fork-right',
  'fork-left': 'driver.guidance.maneuvers.fork-left',
  'roundabout-right': 'driver.guidance.maneuvers.roundabout-right',
  'roundabout-left': 'driver.guidance.maneuvers.roundabout-left',
} as const satisfies Record<string, MessageKey>

type MapStop = { readonly id: string; readonly number: number; readonly name: string; readonly lat: number; readonly lng: number }

function mapStopsOf(stops: readonly DeliveryStop[]): MapStop[] {
  return stops.flatMap((stop, index) =>
    stop.lat === undefined || stop.lng === undefined
      ? []
      : [{ id: stop.id, number: index + 1, name: stop.name, lat: stop.lat, lng: stop.lng }],
  )
}

function formatDistance(meters: number, t: ReturnType<typeof useT>): string {
  if (meters >= 1000) {
    const km = Math.round(meters / 100) / 10
    return t('driver.guidance.km', { count: km })
  }
  return t('driver.guidance.meters', { count: Math.max(0, meters) })
}

function useHere(): GeoPoint | undefined {
  const [here, setHere] = useState<GeoPoint | undefined>(undefined)
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return undefined
    const watch = navigator.geolocation.watchPosition(
      (position) => setHere({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10_000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [])
  return here
}

function currentLegSteps(stepsBySequence: ReadonlyMap<number, GuidanceStep[]>, stopNumber: number): GuidanceStep[] {
  return stepsBySequence.get(stopNumber) ?? []
}

function instructionOf(next: NextGuidance | undefined, stopName: string, t: ReturnType<typeof useT>): string {
  if (next?.instruction.trim()) return next.instruction
  const key = next ? MANEUVER_KEYS[next.maneuver as keyof typeof MANEUVER_KEYS] : undefined
  return key ? t(key) : t('driver.guidance.fallback', { name: stopName })
}

/**
 * Chỉ đường trong app (Goong tiles + bước maneuver): bản đồ tuyến và banner "Còn 300 m · Rẽ phải".
 * Không mở Google Maps. `id="driver-navigation"` để nút "Chỉ đường" trên thẻ liên hệ cuộn tới đây.
 */
export function DriverNavigation({
  trip,
  stopNumber,
  stopName,
  arrived,
}: {
  trip: Trip
  stopNumber: number
  stopName: string
  arrived: boolean
}) {
  const t = useT()
  const here = useHere()
  const stops = useMemo(() => mapStopsOf(trip.stops), [trip.stops])
  const depot = { name: trip.depot.name, lat: trip.depot.lat, lng: trip.depot.lng }
  const pathFallback = useMemo(
    () => ({ depot: { lat: depot.lat, lng: depot.lng }, stops: stops.map((stop) => ({ lat: stop.lat, lng: stop.lng })) }),
    [depot.lat, depot.lng, stops],
  )
  const pathQuery = useTripRoutePathQuery(trip.id, pathFallback, stops.length > 0, false)
  const planQuery = useQuery({
    queryKey: ['trips', trip.id, 'route-plan'],
    queryFn: () => getActiveRoutePlan(trip.id, false),
    enabled: trip.id !== '',
    staleTime: 15_000,
  })

  const stepsBySequence = useMemo(() => {
    const map = new Map<number, GuidanceStep[]>()
    for (const leg of planQuery.data?.legs ?? []) {
      map.set(leg.legSequence, parseGuidanceSteps(leg.steps ?? []))
    }
    return map
  }, [planQuery.data])

  const destination = stops.find((stop) => stop.number === stopNumber)
  const steps = currentLegSteps(stepsBySequence, stopNumber)
  const next = arrived
    ? undefined
    : (nextGuidance(steps, here) ?? (destination
      ? { instruction: '', maneuver: 'straight', remainingMeters: remainingTo(destination, here) }
      : undefined))

  const banner = arrived
    ? t('driver.guidance.arrived')
    : next
      ? t('driver.guidance.next', { distance: formatDistance(next.remainingMeters, t), instruction: instructionOf(next, stopName, t) })
      : t('driver.guidance.fallback', { name: stopName })

  if (stops.length === 0) return null

  return (
    <section id="driver-navigation" className="flex flex-none flex-col gap-2" aria-label={t('driver.guidance.title')}>
      <p className="m-0 rounded-lg border border-primary/30 bg-primary/8 px-4 py-3 font-display text-h3 font-[650] text-ink-strong">
        {banner}
      </p>
      {planQuery.data?.planVersion !== undefined ? (
        <p className="m-0 px-0.5 text-caption text-ink-3">{t('driver.guidance.version', { version: planQuery.data.planVersion })}</p>
      ) : null}
      <RouteMap
        label={t('driver.guidance.map', { name: stopName })}
        className="h-56"
        depot={depot}
        stops={stops}
        path={pathQuery.data}
        vehicle={here ? { name: t('map.vehicle', { name: trip.name }), lat: here.lat, lng: here.lng } : undefined}
      />
    </section>
  )
}
