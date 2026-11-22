import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useT } from '@/lib/i18n'

import type { WarehousePayrollRate } from './warehouse-payroll-api'
import type {
  useCalculateWarehousePayrollPeriodMutation,
  useDeleteDraftWarehousePayrollPeriodMutation,
  useLockWarehousePayrollPeriodMutation,
  useUnlockWarehousePayrollPeriodMutation,
} from './useWarehousePayrollQueries'

/** Việc đang chờ người dùng xác nhận ở tab Kho: xoá / chốt bản nháp của kỳ đang xem, chốt / mở chốt một phiên bản đã lưu. */
export type WarehouseConfirm = {
  readonly kind: 'delete' | 'lock' | 'lockVersion' | 'unlockVersion'
  readonly period: string
}

type Mutations = {
  readonly calculate: ReturnType<typeof useCalculateWarehousePayrollPeriodMutation>
  readonly lock: ReturnType<typeof useLockWarehousePayrollPeriodMutation>
  readonly unlock: ReturnType<typeof useUnlockWarehousePayrollPeriodMutation>
  readonly deleteDraft: ReturnType<typeof useDeleteDraftWarehousePayrollPeriodMutation>
}

/** Bốn hộp xác nhận của tab Kho — cùng chữ và cùng luồng với hai tab Tài xế, Điều phối. */
export function WarehousePayrollConfirmDialogs({ confirm, rates, mutations, onClose, onDone }: {
  confirm: WarehouseConfirm | null
  rates: readonly WarehousePayrollRate[]
  mutations: Mutations
  onClose: () => void
  onDone: (done: WarehouseConfirm) => void
}) {
  const t = useT()
  const { calculate, lock, unlock, deleteDraft } = mutations
  const period = confirm?.period ?? ''
  const openFor = (kind: WarehouseConfirm['kind']) => confirm?.kind === kind
  const onOpenChange = (open: boolean) => { if (!open) onClose() }

  function finish(message: string) {
    if (!confirm) return
    toast.success(message)
    onDone(confirm)
    onClose()
  }

  function lockVersion() {
    const rate = rates.find((item) => item.effectiveFrom.startsWith(period))
    // Phiên bản chưa có bảng lương thì tính trước rồi mới chốt
    const run = rate?.periodStatus === 'DRAFT' || rate?.periodStatus === 'LOCKED' ? Promise.resolve() : calculate.mutateAsync(period)
    void run
      .then(() => lock.mutateAsync(period))
      .then(() => finish(t('payroll.locked')))
      // Lỗi đã hiện ở dòng báo lỗi của tab (trạng thái lỗi của mutation)
      .catch(() => undefined)
  }

  return (
    <>
      <ConfirmDialog
        open={openFor('delete')}
        onOpenChange={onOpenChange}
        title={t('payroll.deleteConfirmTitle', { period })}
        description={t('payroll.deleteConfirmDescription')}
        danger
        pending={deleteDraft.isPending}
        confirmLabel={t('payroll.deleteDraft')}
        cancelLabel={t('payroll.cancel')}
        onConfirm={() => deleteDraft.mutate(period, { onSuccess: () => finish(t('payroll.deleted')) })}
      />
      <ConfirmDialog
        open={openFor('lock')}
        onOpenChange={onOpenChange}
        title={t('payroll.lockConfirmTitle', { period })}
        description={t('payroll.lockConfirmDescription')}
        danger
        pending={lock.isPending}
        confirmLabel={t('payroll.lockPeriod')}
        cancelLabel={t('payroll.cancel')}
        onConfirm={() => lock.mutate(period, { onSuccess: () => finish(t('payroll.locked')) })}
      />
      <ConfirmDialog
        open={openFor('lockVersion')}
        onOpenChange={onOpenChange}
        title={t('payroll.lockVersionConfirmTitle', { period })}
        description={t('payroll.lockVersionConfirmDescription')}
        pending={calculate.isPending || lock.isPending}
        confirmLabel={t('payroll.rate.lockVersion')}
        cancelLabel={t('payroll.cancel')}
        onConfirm={lockVersion}
      />
      <ConfirmDialog
        open={openFor('unlockVersion')}
        onOpenChange={onOpenChange}
        title={t('payroll.unlockVersionConfirmTitle', { period })}
        description={t('payroll.unlockVersionConfirmDescription')}
        danger
        pending={unlock.isPending}
        confirmLabel={t('payroll.rate.unlockVersion')}
        cancelLabel={t('payroll.cancel')}
        onConfirm={() => unlock.mutate(period, { onSuccess: () => finish(t('payroll.unlocked')) })}
      />
    </>
  )
}
