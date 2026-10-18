
import { useState } from 'react'
import {
  MapPin,
  Plus,
  Warehouse,
  Pencil,
  Star,
  Power,
  RefreshCw,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { dataErrorMessage, useT } from '@/lib/i18n'

import type { CompanyWarehouse } from './company-warehouses-api'
import { CompanyWarehouseFormDialog } from './CompanyWarehouseFormDialog'
import {
  useCompanyWarehousesQuery,
  useSetDefaultCompanyWarehouseMutation,
  useSetCompanyWarehouseActiveMutation,
} from './useCompanyWarehousesQuery'

export function CompanyWarehousesPage() {
  const t = useT()

  const warehousesQuery = useCompanyWarehousesQuery()
  const setDefault = useSetDefaultCompanyWarehouseMutation()
  const setActive = useSetCompanyWarehouseActiveMutation()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] =
    useState<CompanyWarehouse | null>(null)

  const warehouses = warehousesQuery.data ?? []

  const busy = setDefault.isPending || setActive.isPending

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(warehouse: CompanyWarehouse) {
    setEditing(warehouse)
    setFormOpen(true)
  }

  async function handleSetDefault(warehouse: CompanyWarehouse) {
    if (warehouse.isDefault || busy) return

    try {
      await setDefault.mutateAsync(warehouse.id)
      toast.success(t('companyWarehouses.defaultUpdated'))
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  async function handleSetActive(warehouse: CompanyWarehouse) {
    if (busy) return

    const nextActive = !warehouse.isActive

    try {
      await setActive.mutateAsync({
        warehouseId: warehouse.id,
        active: nextActive,
      })

      toast.success(
        t(
          nextActive
            ? 'companyWarehouses.activated'
            : 'companyWarehouses.deactivated',
        ),
      )
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
    }
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col px-shell py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {t('companyWarehouses.title')}
          </h1>

          <p className="mt-1 text-sm text-text-2">
            {t('companyWarehouses.pageDescription')}
          </p>
        </div>

        <Button type="button" onClick={openCreate}>
          <Plus className="size-4" />
          {t('companyWarehouses.add')}
        </Button>
      </div>

      {warehousesQuery.isPending ? (
        <div
          className="grid min-h-64 place-items-center"
          role="status"
        >
          <Spinner />
        </div>
      ) : warehousesQuery.isError ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-bg p-5"
        >
          <p className="text-danger">
            {dataErrorMessage(warehousesQuery.error, t)}
          </p>

          <Button
            type="button"
            variant="secondary"
            className="mt-4"
            onClick={() => void warehousesQuery.refetch()}
          >
            <RefreshCw className="size-4" />
            {t('companyWarehouses.retry')}
          </Button>
        </div>
      ) : warehouses.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border bg-bg p-6 text-center">
          <Warehouse className="size-10 text-text-3" />

          <p className="text-text-2">
            {t('companyWarehouses.empty')}
          </p>

          <Button type="button" onClick={openCreate}>
            <Plus className="size-4" />
            {t('companyWarehouses.add')}
          </Button>
        </div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {warehouses.map((warehouse) => {
            const hasCoordinates =
              warehouse.latitude !== null &&
              warehouse.longitude !== null

            return (
              <section
                key={warehouse.id}
                className="rounded-lg border border-border bg-bg p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Warehouse className="size-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">
                      {warehouse.warehouseName}
                    </h2>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {warehouse.isDefault ? (
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          {t('companyWarehouses.default')}
                        </span>
                      ) : null}

                      <span className="rounded-full border border-border px-2.5 py-1 text-xs">
                        {t(
                          warehouse.isActive
                            ? 'companyWarehouses.active'
                            : 'companyWarehouses.inactive',
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-text-3" />

                  <span className="text-text-2">
                    {warehouse.address}
                  </span>
                </div>

                <p className="mt-3 text-xs text-text-3">
                  {hasCoordinates
                    ? t('companyWarehouses.locationConfirmed')
                    : t('companyWarehouses.locationMissing')}
                </p>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => openEdit(warehouse)}
                  >
                    <Pencil className="size-4" />
                    {t('companyWarehouses.edit')}
                  </Button>

                  {!warehouse.isDefault && warehouse.isActive ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void handleSetDefault(warehouse)
                      }
                    >
                      <Star className="size-4" />
                      {t('companyWarehouses.setDefault')}
                    </Button>
                  ) : null}

                  {!warehouse.isDefault ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() =>
                        void handleSetActive(warehouse)
                      }
                    >
                      <Power className="size-4" />
                      {t(
                        warehouse.isActive
                          ? 'companyWarehouses.deactivate'
                          : 'companyWarehouses.activate',
                      )}
                    </Button>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <CompanyWarehouseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        warehouse={editing}
      />
    </div>
  )
}
