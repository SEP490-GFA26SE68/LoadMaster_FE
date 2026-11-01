
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CoordinatePicker } from '@/components/map'
import { Button } from '@/components/ui/Button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT } from '@/lib/i18n'

import {
  type CompanyWarehouse,
  type CompanyWarehouseInput,
} from './company-warehouses-api'

import {
  useCreateCompanyWarehouseMutation,
  useUpdateCompanyWarehouseMutation,
} from './useCompanyWarehousesQuery'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  warehouse?: CompanyWarehouse | null
}

export function CompanyWarehouseFormDialog({
  open,
  onOpenChange,
  warehouse,
}: Props) {
  const t = useT()
  const create = useCreateCompanyWarehouseMutation()
  const update = useUpdateCompanyWarehouseMutation()

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [coordinates, setCoordinates] = useState({
    lat: '',
    lng: '',
  })

  useEffect(() => {
    if (!open) return

    setName(warehouse?.warehouseName ?? '')
    setAddress(warehouse?.address ?? '')
    setCoordinates({
      lat: warehouse?.latitude?.toString() ?? '',
      lng: warehouse?.longitude?.toString() ?? '',
    })
  }, [open, warehouse])

  const pending = create.isPending || update.isPending

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const latitude = coordinates.lat.trim()
      ? Number(coordinates.lat)
      : null

    const longitude = coordinates.lng.trim()
      ? Number(coordinates.lng)
      : null

    if (
      !name.trim() ||
      !address.trim() ||
      name.trim().length > 255 ||
      address.trim().length > 500 ||
      (latitude === null) !== (longitude === null) ||
      (latitude !== null &&
        (!Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90)) ||
      (longitude !== null &&
        (!Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180))
    ) {
      toast.error(t('companyWarehouses.invalidInput'))
      return
    }

    const input: CompanyWarehouseInput = {
      warehouseName: name.trim(),
      address: address.trim(),
      latitude,
      longitude,
    }

    try {
      if (warehouse) {
        await update.mutateAsync({
          warehouseId: warehouse.id,
          input,
        })
      } else {
        await create.mutateAsync(input)
      }

      toast.success(
        warehouse
          ? t('companyWarehouses.updated')
          : t('companyWarehouses.created'),
      )

      onOpenChange(false)
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-24px)] max-w-4xl flex-col overflow-hidden p-0">
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogHeader
            title={t(
              warehouse
                ? 'companyWarehouses.edit'
                : 'companyWarehouses.add',
            )}
            description={t('companyWarehouses.formDescription')}
          />

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <Input
              label={t('companyWarehouses.name')}
              value={name}
              maxLength={255}
              required
              onChange={(event) => setName(event.target.value)}
            />

            <Input
              label={t('companyWarehouses.address')}
              value={address}
              maxLength={500}
              required
              onChange={(event) => {
                setAddress(event.target.value)

                // Địa chỉ đã thay đổi: không giữ tọa độ cũ.
                setCoordinates({ lat: '', lng: '' })
              }}
            />

            <CoordinatePicker
              label={t('companyWarehouses.coordinates')}
              value={coordinates}
              onChange={setCoordinates}
              onPlacePicked={(place) => {
                setAddress(place.address)
              }}
              hint={t('companyWarehouses.coordinatesHint')}
            />
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-5 py-4">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {t('companyWarehouses.cancel')}
            </Button>

            <Button type="submit" loading={pending}>
              {t('companyWarehouses.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
