import { Save } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useBlocker, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { useSaveVehicleMutation } from './useVehiclesQuery'
import {
  useVehicleTypesQuery,
} from '../vehicle-types/useVehicleTypesQuery'
import {
  createVehicleFormSchema,
  toFormValues,
  toVehicleInput,
  type VehicleFormValues,
} from './vehicle-form'
import { VehicleFormSection } from './VehicleFormSection'
import { VehicleSpecFields } from './VehicleSpecFields'
import type { Vehicle } from './vehicles-api'

const FLEET_PATH = '/doi-xe'



/**
 * Form cấu hình xe (Spec 9.2, LM-041) dùng cho cả `/doi-xe/moi` và `/doi-xe/:vehicleId`.
 * `vehicle` vắng nghĩa là thêm xe mới; khi đó `id` rỗng và kho cấp mã lúc lưu. `readOnly`: người không có quyền sửa đội xe
 * (quản lý, D-41) hoặc xe đang chạy chuyến (LM-089) — xem cấu hình nhưng không có nút Lưu/Xoá và ô nhập bị khoá.
 * Ba chỗ trống cho trạng thái xe (LM-089): `status` là chip cạnh tên, `actions` trước nút Xoá, `notice` đầu thẻ form.
 */
export function VehicleForm({ vehicle, readOnly = false, status, actions, notice }: {
  vehicle?: Vehicle
  readOnly?: boolean
  status?: ReactNode
  actions?: ReactNode
  notice?: ReactNode
}) {
  const t = useT()
  const navigate = useNavigate()
  const save = useSaveVehicleMutation()
  const [done, setDone] = useState(false)

  const vehicleTypesQuery = useVehicleTypesQuery(
    0,
    100,
  )

  const vehicleTypes =
    vehicleTypesQuery.data?.data ?? []

  const schema = useMemo(
    () => createVehicleFormSchema(t),
    [t],
  )

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: toFormValues(vehicle),
  })
  const { isDirty } = form.formState

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && !done && currentLocation.pathname !== nextLocation.pathname,
  )

  useEffect(() => {
    if (done) void navigate(FLEET_PATH)
  }, [done, navigate])

  function handleSave(values: VehicleFormValues) {
    save.mutate(toVehicleInput(values), {
      onSuccess: (saved) => {
        toast.success(t(vehicle ? 'fleet.detail.saved' : 'fleet.detail.created', { name: saved.name }))
        setDone(true)
      },
      onError: () => toast.error(t('fleet.detail.saveFailed')),
    })
  }


  return (
    <form noValidate onSubmit={form.handleSubmit(handleSave)} className="flex min-w-0 flex-1 flex-col">
      {/* V2.3 (ChiTietXe.jpg, ThemXe.jpg): tiêu đề là dữ liệu (tên xe) trên dải trời; Lưu là nút chính duy nhất, nằm trong form nên là nút submit */}
      <PageHero
        overlap
        back={{ to: FLEET_PATH, label: t('fleet.detail.back') }}
        title={vehicle ? vehicle.name : t('fleet.detail.newTitle')}
        crumbs={[
          { label: t('fleet.title'), to: FLEET_PATH },
          vehicle ? { label: vehicle.id, mono: true } : { label: t('fleet.detail.newTitle') },
        ]}
        badge={status}
        description={
          vehicle
            ? `${vehicle.licensePlate} · ${vehicle.vehicleTypeName}`
            : t('fleet.detail.newDescription')
        }
      />

      <div className="sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6">
        <div className="mx-auto w-full max-w-3xl">
          <Card className="flex min-w-0 flex-col rounded-xl shadow-sm">
            {notice}

            <fieldset
              disabled={readOnly}
              className="m-0 flex min-w-0 flex-col border-0 p-0"
            >
              <VehicleFormSection
                number={1}
                title={t('fleet.detail.specTitle')}
                meta={t('fleet.detail.specHint')}
              >
                <VehicleSpecFields
                  control={form.control}
                  register={form.register}
                  vehicleTypes={vehicleTypes}
                />
              </VehicleFormSection>

              {!readOnly && (
                <div className="flex justify-end border-t border-border px-5 py-4">
                  <Button
                    type="submit"
                    variant="primary"
                    loading={save.isPending}
                  >
                    <Save strokeWidth={1.5} />
                    {t('fleet.detail.save')}
                  </Button>
                </div>
              )}

            </fieldset>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.()
        }}
        title={t('fleet.leave.title')}
        description={t('fleet.leave.description')}
        cancelLabel={t('fleet.leave.stay')}
        confirmLabel={t('fleet.leave.confirm')}
        danger
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  )
}
