import type { TFunction } from '@/lib/i18n'

/** Một điểm của chuyến đủ để gọi tên: mã điểm và tên. Số điểm là vị trí + 1 trong `Trip.stops`. */
export type StopRef = { readonly id: string; readonly name: string }

/** Nhãn điểm theo mã điểm cho câu của luật ("điểm 3 (Bếp ăn công nghiệp KCN Sóng Thần)"); mã lạ giữ nguyên. */
export function stopLabeler(stops: readonly StopRef[], t: TFunction): (stopId: string) => string {
  return (stopId) => {
    const index = stops.findIndex((stop) => stop.id === stopId)
    const stop = stops[index]
    return stop === undefined ? stopId : t('pickups.rules.stop', { number: index + 1, name: stop.name })
  }
}
