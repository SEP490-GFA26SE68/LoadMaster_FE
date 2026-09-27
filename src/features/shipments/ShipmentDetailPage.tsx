import { Pencil, Printer, Send, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/features/auth/AuthProvider'
import { useCan } from '@/features/auth/useCan'
import { labelsPath } from '@/features/packages-source/packages-list'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { shipmentPackageColumns, type ShipmentPackageRow } from './shipment-package-columns'
import { ShipmentStatusBadge } from './shipment-look'
import { ShipmentFormDialog } from './ShipmentFormDialog'
import { ShipmentInfoCard } from './ShipmentInfoCard'
import { useDeleteShipmentMutation, useHandOverShipmentMutation, useShipmentQuery } from './useShipmentsQuery'

type Dialog = 'edit' | 'handOver' | 'delete' | null

/**
 * Chi tiết lô `/lo-hang/:shipmentId` (luồng 1, LM-104): dải trời có mã lô, chip trạng thái, số kiện đã nhận; thẻ kiện trong lô (trạng
 * thái nhận từng kiện) cạnh thẻ thông tin có thước đo nhận hàng. Lô nháp: sửa, xoá, và "Bàn giao cho logistics" là hành động chính;
 * đã bàn giao thì chỉ theo dõi. Mọi thao tác hỏi xác nhận, lỗi của kho hiện trong hộp thoại.
 */
export function ShipmentDetailPage() {
  const t = useT()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canManage = useCan()('shipments.manage')
  const { shipmentId = '' } = useParams()
  const query = useShipmentQuery(shipmentId)
  const handOver = useHandOverShipmentMutation()
  const remove = useDeleteShipmentMutation()
  const [dialog, setDialog] = useState<Dialog>(null)
  const columns = useMemo(() => shipmentPackageColumns(t), [t])

  const detail = query.data
  const rows = useMemo<ShipmentPackageRow[]>(() => {
    if (!detail) return []
    const receipts = new Map(detail.shipment.receipts.map((receipt) => [receipt.packageId, receipt]))
    return detail.packages.map((item) => ({ ...item, receipt: receipts.get(item.package.id) }))
  }, [detail])

  const draft = detail?.shipment.status === 'draft'
  const count = detail?.shipment.packageIds.length ?? 0
  const company = detail?.logistics?.name ?? detail?.shipment.logisticsCompanyId ?? ''

  function closeDialog() {
    if (handOver.isPending || remove.isPending) return
    setDialog(null)
    handOver.reset()
    remove.reset()
  }

  function handleHandOver() {
    handOver.mutate(shipmentId, {
      onSuccess: () => {
        toast.success(t('sourcing.shipments.detail.handedOver', { id: shipmentId, company }))
        setDialog(null)
      },
    })
  }

  function handleDelete() {
    remove.mutate(shipmentId, {
      onSuccess: () => {
        toast.success(t('sourcing.shipments.detail.deleted', { id: shipmentId }))
        void navigate('/lo-hang')
      },
    })
  }

  const printLink = count > 0 ? (
    <Button variant="glass" asChild>
      <Link to={labelsPath(detail?.shipment.packageIds ?? [])}>
        <Printer strokeWidth={1.5} />
        {t('sourcing.shipments.detail.printLabels')}
      </Link>
    </Button>
  ) : null

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={Boolean(detail) || query.isPending}
        title={t('titles.shipment', { id: shipmentId })}
        crumbs={[{ label: t('sourcing.shipments.title'), to: '/lo-hang' }, { label: shipmentId, mono: true }]}
        badge={detail ? <ShipmentStatusBadge status={detail.shipment.status} /> : undefined}
        meta={detail ? t('sourcing.shipments.detailCount', { count, received: detail.receivedCount }) : undefined}
        description={t('pageHero.shipment')}
        actions={detail ? (
          <>
            {printLink}
            {draft && canManage ? (
              <>
                <Button variant="glass" onClick={() => setDialog('edit')}><Pencil strokeWidth={1.5} />{t('sourcing.shipments.detail.edit')}</Button>
                <Button variant="glass" onClick={() => setDialog('delete')}><Trash2 strokeWidth={1.5} />{t('sourcing.shipments.detail.delete')}</Button>
                <Button variant="primary" onClick={() => setDialog('handOver')}><Send strokeWidth={1.5} />{t('sourcing.shipments.detail.handOver')}</Button>
              </>
            ) : null}
          </>
        ) : null}
      />
      <main className={detail || query.isPending ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div className="flex justify-center rounded-lg border border-border bg-bg py-16 shadow-card"><Spinner /></div>
        ) : query.error || !detail ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)_340px] items-start gap-4 max-lg:grid-cols-1">
            <Card className="relative flex-none overflow-hidden">
              <CardHeader>
                <CardTitle as="h2">{t('sourcing.shipments.detail.packagesTitle')}</CardTitle>
                <CardMeta>{t('sourcing.shipments.detail.receivedOf', { count, received: detail.receivedCount })}</CardMeta>
              </CardHeader>
              <div className="relative overflow-x-auto">
                <div className="min-w-200">
                  <DataTable data={rows} columns={columns} getRowId={(row) => row.package.id} density="roomy" appearance="paper" />
                </div>
              </div>
            </Card>
            <ShipmentInfoCard detail={detail} />
          </div>
        )}
      </main>

      {dialog === 'edit' && detail ? (
        <ShipmentFormDialog
          shipment={detail.shipment}
          current={detail.packages.map((item) => item.package)}
          needManufacturer={user?.role !== 'manufacturer'}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            toast.success(t('sourcing.shipments.detail.saved', { id: saved.id }))
            setDialog(null)
          }}
        />
      ) : null}
      <ConfirmDialog
        open={dialog === 'handOver'}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        title={t('sourcing.shipments.detail.handOverDialog.title', { id: shipmentId })}
        description={handOver.error ? dataErrorMessage(handOver.error, t) : t('sourcing.shipments.detail.handOverDialog.description', { count, company })}
        cancelLabel={t('sourcing.shipments.detail.handOverDialog.cancel')}
        confirmLabel={t('sourcing.shipments.detail.handOverDialog.confirm')}
        pending={handOver.isPending}
        onConfirm={handleHandOver}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onOpenChange={(open) => (open ? undefined : closeDialog())}
        title={t('sourcing.shipments.detail.deleteDialog.title', { id: shipmentId })}
        description={remove.error ? dataErrorMessage(remove.error, t) : t('sourcing.shipments.detail.deleteDialog.description', { count })}
        cancelLabel={t('sourcing.shipments.detail.deleteDialog.cancel')}
        confirmLabel={t('sourcing.shipments.detail.deleteDialog.confirm')}
        danger
        pending={remove.isPending}
        onConfirm={handleDelete}
      />
    </div>
  )
}
