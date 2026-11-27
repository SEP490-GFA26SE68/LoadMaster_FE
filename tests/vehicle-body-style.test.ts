import { expect, test } from 'vitest'
import { isTruckBodyStyle, isVanBodyStyle, parseVehicleBodyStyle, VEHICLE_BODY_STYLES } from '@/types/vehicle-body-style'

test('the eight styles split into four vans and four trucks', () => {
  expect(VEHICLE_BODY_STYLES.filter(isVanBodyStyle)).toEqual(['VAN_MINI_FLAT', 'VAN_MINI_HOOD', 'VAN_MID', 'VAN_LARGE'])
  expect(VEHICLE_BODY_STYLES.filter(isTruckBodyStyle)).toEqual(['TRUCK_BOX', 'TRUCK_CANVAS', 'TRUCK_FLATBED', 'TRUCK_REEFER'])
  expect(isVanBodyStyle(undefined)).toBe(false)
  expect(isTruckBodyStyle(undefined)).toBe(false)
})

test('a server value outside the list reads as no style', () => {
  expect(parseVehicleBodyStyle('TRUCK_REEFER')).toBe('TRUCK_REEFER')
  expect(parseVehicleBodyStyle('truck_reefer')).toBeUndefined()
  expect(parseVehicleBodyStyle('SEMI_TRAILER')).toBeUndefined()
  expect(parseVehicleBodyStyle(null)).toBeUndefined()
  expect(parseVehicleBodyStyle(3)).toBeUndefined()
})
