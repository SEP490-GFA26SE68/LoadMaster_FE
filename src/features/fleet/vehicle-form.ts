import { z } from 'zod'
import type { TFunction } from '@/lib/i18n'
import type { Vehicle } from './vehicles-api'

export function createVehicleFormSchema(t: TFunction) {
  return z.object({
    id: z.string(),

    name: z
      .string()
      .trim()
      .min(1, t('fleet.form.nameRequired')),

    licensePlate: z
      .string()
      .trim()
      .min(1, t('fleet.form.licensePlateRequired')),

    vehicleTypeId: z
      .string()
      .trim()
      .min(1, t('fleet.form.vehicleTypeRequired')),
  })
}

export type VehicleFormSchema =
  ReturnType<typeof createVehicleFormSchema>

export type VehicleFormValues =
  z.infer<VehicleFormSchema>

export function toFormValues(
  vehicle?: Vehicle,
): VehicleFormValues {
  if (!vehicle) {
    return {
      id: '',
      name: '',
      licensePlate: '',
      vehicleTypeId: '',
    }
  }

  return {
    id: vehicle.id,
    name: vehicle.name,
    licensePlate: vehicle.licensePlate,
    vehicleTypeId: vehicle.vehicleTypeId,
  }
}

export type VehicleInput = {
  name: string
  licensePlate: string
  vehicleTypeId: string
}

export function toVehicleInput(
  values: VehicleFormValues,
): VehicleInput {
  return {
    name: values.name.trim(),
    licensePlate: values.licensePlate
      .trim()
      .toUpperCase(),
    vehicleTypeId: values.vehicleTypeId,
  }
}