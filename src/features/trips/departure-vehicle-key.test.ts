import { expect, test } from 'vitest'
import { departureVehicleKey } from './useDepartureVehicles'
test('warehouse, trip and authenticated user/company scopes never share choices keys', () => {
 const keys = [departureVehicleKey('1','7','101','1'),departureVehicleKey('1','7','102','1'),departureVehicleKey('2','7','101','1'),departureVehicleKey('1','8','101','1'),departureVehicleKey('1','7','101','2')]
 expect(new Set(keys.map(k=>JSON.stringify(k))).size).toBe(keys.length)
})
