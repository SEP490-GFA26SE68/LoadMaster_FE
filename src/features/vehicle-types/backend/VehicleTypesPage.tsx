
import { Plus, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'

import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useT } from '@/lib/i18n'

import type {
  VehicleType,
  VehicleTypeInput,
} from './vehicle-types-api'

import {
  createTypeColumns,
  VehicleTypesTableContext,
  type VehicleTypesTableValue,
} from './vehicle-types-table'

import { VehicleTypeDialog } from './VehicleTypeDialog'

import {
  useDeleteVehicleTypeMutation,
  useSaveVehicleTypeMutation,
  useVehicleTypesQuery,
} from './useVehicleTypesQuery'

/**
 * Danh sách loại xe từ BE thật.
 *
 * Mỗi loại xe lưu cấu hình lòng thùng,
 * tải trọng và vật cản.
 *
 * Vehicle được gán loại ngay khi tạo xe,
 * không thực hiện gán bằng bảng mock.
 *
 * Sửa loại xe (PUT) đổi lòng thùng, cửa, tải trọng, vật cản: máy chủ làm phương án của chuyến chưa rời kho dùng loại đó lỗi thời.
 * Loại còn gắn xe không xoá được (mục Xoá mờ kèm lý do).
 */
export function VehicleTypesPage() {
  const t = useT()
  const canEdit = useCan()('vehicleTypes.edit')

  const typesQuery = useVehicleTypesQuery()
  const save = useSaveVehicleTypeMutation()
  const remove = useDeleteVehicleTypeMutation()

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<VehicleType | null>(null)
  const [deleting, setDeleting] = useState<VehicleType | null>(null)

  const types = typesQuery.data?.data ?? []

  const typeColumns = useMemo(
    () => createTypeColumns(t),
    [t],
  )

  function handleSave(input: VehicleTypeInput) {
    const id = editing?.id
    save.mutate(
      { input, id },
      {
        onSuccess: (type) => {
          setCreating(false)
          setEditing(null)

          toast.success(
            t(id === undefined ? 'vehicleTypes.created' : 'vehicleTypes.saved', {
              name: type.name,
            }),
          )
        },

        onError: (error) => {
          toast.error(
            dataErrorMessage(error, t),
          )
        },
      },
    )
  }

  function handleDelete() {
    if (!deleting) return
    const type = deleting
    remove.mutate(type.id, {
      onSuccess: () => {
        setDeleting(null)
        toast.success(t('vehicleTypes.deleted', { name: type.name }))
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  const context: VehicleTypesTableValue = {
    canEdit,
    canUpdate: canEdit,
    canDelete: canEdit,
    onEdit: setEditing,
    onDelete: setDeleting,
  }

  const addButton = canEdit ? (
    <Button
      variant="primary"
      onClick={() => setCreating(true)}
    >
      <Plus strokeWidth={1.5} />
      {t('vehicleTypes.add')}
    </Button>
  ) : null

  const hasTypes = types.length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        title={t('vehicleTypes.title')}
        meta={
          typesQuery.isSuccess
            ? t('vehicleTypes.server.count', { count: typesQuery.data.totalElements })
            : undefined
        }
        description={t('pageHero.vehicleTypes')}
        back={{
          to: '/doi-xe',
          label: t('vehicleTypes.toFleet'),
        }}
        actions={hasTypes ? addButton : null}
      />

      <div
        className="min-h-0 flex-1 overflow-auto px-shell py-6"
      >
        {typesQuery.isPending ? (
          <div
            role="status"
            aria-label={t('vehicleTypes.loading')}
            className="flex justify-center py-16"
          >
            <Spinner />
          </div>
        ) : typesQuery.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(typesQuery.error, t)}
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  void typesQuery.refetch()
                }
              >
                <RotateCcw strokeWidth={1.5} />
                {t('tripReport.retry')}
              </Button>
            }
          />
        ) : !hasTypes ? (
          <EmptyState
            mascot="empty"
            title={t('vehicleTypes.empty')}
            description={t(
              'vehicleTypes.emptyDescription',
            )}
            action={addButton ?? undefined}
          />
        ) : (
          <VehicleTypesTableContext value={context}>
            <Card className="relative flex-none overflow-hidden">
              <DataTable
                data={types}
                columns={typeColumns}
                getRowId={(row) => row.id}
                density="spacious"
                appearance="paper"
              />
            </Card>
          </VehicleTypesTableContext>
        )}
      </div>

      <VehicleTypeDialog
        open={creating || editing !== null}
        onOpenChange={(open) => {
          if (open) return
          setCreating(false)
          setEditing(null)
        }}
        type={editing}
        pending={save.isPending}
        onSubmit={handleSave}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        title={t('vehicleTypes.deleteDialog.title', { name: deleting?.name ?? '' })}
        description={t('vehicleTypes.deleteDialog.description', { id: deleting?.id ?? '' })}
        cancelLabel={t('vehicleTypes.deleteDialog.cancel')}
        confirmLabel={t('vehicleTypes.deleteDialog.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
