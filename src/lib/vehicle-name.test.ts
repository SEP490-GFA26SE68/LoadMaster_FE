import { expect, test } from 'vitest'
import { splitVehicleName } from './vehicle-name'

test('the plate is what follows the last " · "', () => {
  expect(splitVehicleName('Hyundai HD210 · 60C-446.32')).toStrictEqual({ model: 'Hyundai HD210', plate: '60C-446.32' })
  expect(splitVehicleName('Hino · FC9J · 51C-190.07')).toStrictEqual({ model: 'Hino · FC9J', plate: '51C-190.07' })
})

test('a name without " · " has no plate', () => {
  expect(splitVehicleName('Truck 6m')).toStrictEqual({ model: 'Truck 6m', plate: null })
  expect(splitVehicleName('Xe ·tải')).toStrictEqual({ model: 'Xe ·tải', plate: null })
  expect(splitVehicleName('Xe mới · ')).toStrictEqual({ model: 'Xe mới', plate: null })
})
