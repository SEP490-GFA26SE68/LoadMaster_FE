
import { RouteMap } from '@/components/map'
import type { GeoPoint } from '@/domain/routing'
import { useT } from '@/lib/i18n'
import { decodeGoongPolyline } from './goong-polyline'
import type {
    BackendActiveRoutePlan,
    TripDetailApiResponse,
    TripStopApiResponse,
} from './trips-api'
type Props = {
    trip: TripDetailApiResponse
    stops: TripStopApiResponse[]
    routePlan: BackendActiveRoutePlan | null
}

export function BackendTripRouteCard({
    trip,
    stops,
    routePlan,
}: Props) {
    const t = useT()

    const mapStops = [...stops]
        .sort((a, b) => a.stopSequence - b.stopSequence)
        .filter(
            (stop) =>
                stop.latitude != null &&
                stop.longitude != null &&
                Number.isFinite(stop.latitude) &&
                Number.isFinite(stop.longitude),
        )
        .map((stop) => ({
            id: String(stop.id),
            number: stop.stopSequence,
            name:
                stop.stopName ||
                stop.address ||
                `#${stop.stopSequence}`,
            lat: stop.latitude!,
            lng: stop.longitude!,
        }))


    let path: GeoPoint[] | undefined

    if (routePlan?.legs?.length) {
        const orderedLegs = [...routePlan.legs].sort(
            (a, b) => a.legSequence - b.legSequence,
        )

        // Chỉ vẽ tuyến Goong nếu tất cả các chặng có polyline.
        if (orderedLegs.every((leg) => Boolean(leg.polyline))) {
            try {
                const decoded: GeoPoint[] = []

                for (const leg of orderedLegs) {
                    const points = decodeGoongPolyline(leg.polyline!)

                    if (points.length < 2) {
                        throw new Error('Invalid route segment')
                    }

                    // Bỏ điểm đầu chặng kế tiếp nếu trùng
                    // với điểm cuối chặng trước đó.
                    const last = decoded[decoded.length - 1]
                    const first = points[0]

                    if (
                        last &&
                        first &&
                        last.lat === first.lat &&
                        last.lng === first.lng
                    ) {
                        decoded.push(...points.slice(1))
                    } else {
                        decoded.push(...points)
                    }
                }

                if (decoded.length > 1) {
                    path = decoded
                }
            } catch {
                // Polyline không hợp lệ: RouteMap dùng đường nối thẳng.
                path = undefined
            }
        }
    }


    const hasDepotCoordinates =
        trip.originLatitude != null &&
        trip.originLongitude != null &&
        Number.isFinite(trip.originLatitude) &&
        Number.isFinite(trip.originLongitude)

    return (
        <section className="overflow-hidden rounded-lg border border-border bg-bg">
            <div className="border-b border-border px-5 py-4">
                <h2 className="text-lg font-semibold">
                    {t('trips.detail.deliveryStops')}
                </h2>

                <p className="mt-1 text-sm text-text-2">
                    {stops.length} {t('trips.detail.stopUnit')}
                </p>
            </div>

            {hasDepotCoordinates ? (
                <RouteMap
                    label={t('trips.routePlan.map', {
                        id: String(trip.id),
                    })}
                    className="h-80"
                    depot={{
                        name: trip.originName,
                        lat: trip.originLatitude,
                        lng: trip.originLongitude,
                    }}
                    stops={mapStops}
                    path={path}
                />
            ) : (
                <div className="px-5 py-8 text-sm text-text-2">
                    {t('backendTripRoute.missingDepotCoordinates')}
                </div>
            )}

            {mapStops.length < stops.length && (
                <p className="border-t border-border px-5 py-3 text-sm text-text-2">
                    {t('backendTripRoute.missingStopCoordinates', {
                        count: stops.length - mapStops.length,
                    })}
                </p>
            )}
        </section>
    )
}
