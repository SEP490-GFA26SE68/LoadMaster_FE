import { Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { VehicleTypeInput } from '@/lib/mock-db'
import type { VehicleAssignmentRow, VehicleTypeRow } from './vehicle-types-api'
import { createAssignColumns, createTypeColumns, VehicleTypesTableContext, type VehicleTypesTableValue } from './vehicle-types-table'
import { VehicleTypeDialog } from './VehicleTypeDialog'
import {
  useDeleteVehicleTypeMutation,
  useSaveVehicleTypeMutation,
  useSetVehicleTypeMutation,
  useVehicleAssignmentRowsQuery,
  useVehicleTypesQuery,
} from './useVehicleTypesQuery'

/**
 * Loại xe `/doi-xe/loai-xe` (LM-104) — backend có CRUD thật `/api/vehicle-types`. Bảng loại xe (tên, lòng thùng D × R × C cm, tải
 * trọng kg, xe đang dùng) và bảng gắn loại cho từng xe. Người có `vehicleTypes.edit` thêm / sửa / xoá loại (loại còn gắn xe không xoá
 * được: mục Xoá mờ kèm lý do) và đổi loại của xe; người chỉ có `fleet.view` xem.
 */
export function VehicleTypesPage() {
  const t = useT()
  const canEdit = useCan()('vehicleTypes.edit')
  const typesQuery = useVehicleTypesQuery()
  const vehiclesQuery = useVehicleAssignmentRowsQuery()
  const save = useSaveVehicleTypeMutation()
  const remove = useDeleteVehicleTypeMutation()
  const assign = useSetVehicleTypeMutation()
  const [editing, setEditing] = useState<{ row: VehicleTypeRow | null } | null>(null)
  const [deleting, setDeleting] = useState<VehicleTypeRow | null>(null)

  const types = useMemo<VehicleTypeRow[]>(() => {
    const vehicleTypes = typesQuery.data?.data ?? []
    const assignmentRows = vehiclesQuery.data ?? []

    return vehicleTypes.map((type) => {
      const vehicles = assignmentRows
        .filter((row) => row.vehicleTypeId === type.id)
        .map((row) => row.vehicle)

      return {
        type,
        vehicleIds: vehicles.map((vehicle) => vehicle.id),
        vehicles,
      }
    })
  }, [typesQuery.data, vehiclesQuery.data])

  const assigned = types.reduce(
    (sum, row) => sum + row.vehicleIds.length,
    0,
  )
  const typeColumns = useMemo(() => createTypeColumns(t), [t])
  const assignColumns = useMemo(() => createAssignColumns(t), [t])

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  function handleSave(input: VehicleTypeInput) {
    const id = editing?.row?.type.id
    save.mutate({ input, id }, {
      onSuccess: (type) => {
        setEditing(null)
        toast.success(t(id === undefined ? 'vehicleTypes.created' : 'vehicleTypes.saved', { name: type.name }))
      },
      onError: showError,
    })
  }

  function handleDelete() {
    if (!deleting) return
    const { id, name } = deleting.type
    remove.mutate(id, {
      onSuccess: () => {
        setDeleting(null)
        toast.success(t('vehicleTypes.deleted', { name }))
      },
      onError: showError,
    })
  }

  function handleAssign(vehicle: VehicleAssignmentRow['vehicle'], vehicleTypeId: string | null) {
    assign.mutate({ vehicleId: vehicle.id, vehicleTypeId }, {
      onSuccess: () => {
        const type = types.find((row) => row.type.id === vehicleTypeId)?.type.name
        toast.success(type ? t('vehicleTypes.assign.saved', { vehicle: vehicle.name, type }) : t('vehicleTypes.assign.cleared', { vehicle: vehicle.name }))
      },
      onError: showError,
    })
  }

  // Giá trị đổi chỉ làm ô render lại, không gỡ ô: cột dựng một lần theo ngôn ngữ
  const context: VehicleTypesTableValue = {
    canEdit,
    types,
    assigningId: assign.isPending ? (assign.variables?.vehicleId ?? null) : null,
    onEdit: (row) => setEditing({ row }),
    onDelete: setDeleting,
    onAssign: handleAssign,
  }

  const addButton = canEdit ? (
    <Button variant="primary" onClick={() => setEditing({ row: null })}>
      <Plus strokeWidth={1.5} />
      {t('vehicleTypes.add')}
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={typesQuery.isSuccess && types.length > 0}
        title={t('vehicleTypes.title')}
        meta={
          typesQuery.isSuccess
            ? t('vehicleTypes.count', {
              count: typesQuery.data.totalElements,
              assigned,
            })
            : undefined
        }
        description={t('pageHero.vehicleTypes')}
        back={{ to: '/doi-xe', label: t('vehicleTypes.toFleet') }}
        actions={types.length > 0 ? addButton : null}
      />
      <div className={typesQuery.isSuccess && types.length > 0 ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {typesQuery.isPending ? (
          <div role="status" aria-label={t('vehicleTypes.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : typesQuery.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(typesQuery.error, t)}
            action={<Button variant="secondary" onClick={() => void typesQuery.refetch()}><RotateCcw strokeWidth={1.5} />{t('tripReport.retry')}</Button>}
          />
        ) : types.length === 0 ? (
          <EmptyState mascot="empty" title={t('vehicleTypes.empty')} description={t('vehicleTypes.emptyDescription')} action={addButton ?? undefined} />
        ) : (
          <VehicleTypesTableContext value={context}>
            <div className="flex flex-col gap-4">
              <Card className="relative flex-none overflow-hidden">
                <DataTable data={types} columns={typeColumns} getRowId={(row) => row.type.id} density="spacious" appearance="paper" />
              </Card>
              <AssignCard rows={vehiclesQuery.data ?? []} loading={vehiclesQuery.isPending} columns={assignColumns} />
            </div>
          </VehicleTypesTableContext>
        )}
      </div>

      <VehicleTypeDialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null) }}
        type={editing?.row?.type ?? null}
        pending={save.isPending}
        onSubmit={handleSave}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => { if (!open) setDeleting(null) }}
        title={deleting ? t('vehicleTypes.deleteDialog.title', { name: deleting.type.name }) : ''}
        description={deleting ? t('vehicleTypes.deleteDialog.description', { id: deleting.type.id }) : ''}
        cancelLabel={t('vehicleTypes.deleteDialog.cancel')}
        confirmLabel={t('vehicleTypes.deleteDialog.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}

/** Bảng "Gắn loại cho xe": mọi xe của đội, mỗi xe một ô chọn loại (chỉ đọc khi không có quyền ghi). */
function AssignCard({ rows, loading, columns }: {
  rows: VehicleAssignmentRow[]
  loading: boolean
  columns: ReturnType<typeof createAssignColumns>
}) {
  const t = useT()
  const format = useFormat()
  return (
    <Card className="relative flex-none overflow-hidden">
      <CardHeader>
        <CardTitle as="h2">{t('vehicleTypes.assign.title')}</CardTitle>
        <CardMeta>{format.integer(rows.length)}</CardMeta>
        <p className="m-0 basis-full text-small text-ink-3">{t('vehicleTypes.assign.description')}</p>
      </CardHeader>
      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <DataTable data={rows} columns={columns} getRowId={(row) => row.vehicle.id} density="roomy" appearance="paper" />
      )}
    </Card>
  )
}
