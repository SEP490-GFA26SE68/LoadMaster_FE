import { ScanLine } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Banner } from '@/components/Banner'
import { EmptyState } from '@/components/EmptyState'
import { PageHero } from '@/components/PageHero'
import { QrScanDialog, type QrScanOption } from '@/components/QrScanDialog'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import type { ReceiptResult } from '@/lib/mock-db'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { IncomingShipmentCard } from './IncomingShipmentCard'
import { ReceiveConfirmDialog } from './ReceiveConfirmDialog'
import { RecentReceipts } from './RecentReceipts'
import { useIncomingShipmentsQuery, useReceivePackageMutation } from './useReceivingQuery'
import { pendingByToken, pendingCount, type IncomingMatch } from './receiving-view'

/**
 * Nhận hàng `/nhan-hang` (luồng 1, LM-104) — màn chính của công ty logistics, dùng được trên máy tính bảng ở kho (nút 56 px khi cảm
 * ứng). Nút chính mở hộp thoại quét QR (camera, nhập mã hoặc chọn kiện đang chờ); mã khớp kiện đang chờ thì hiện thông tin đăng ký để
 * đối chiếu rồi xác nhận nhận; mã không khớp gửi thẳng cho kho để kho trả đúng lỗi (mã lạ, lô của công ty khác, kiện đã nhận). Nhận
 * xong quay lại quét kiện tiếp. Dưới dải trời: các lô đang về (đã nhận x / y) và cột "Vừa nhận".
 */
export function ReceivingPage() {
  const t = useT()
  const format = useFormat()
  const query = useIncomingShipmentsQuery()
  const receive = useReceivePackageMutation()
  const [scanning, setScanning] = useState(false)
  const [candidate, setCandidate] = useState<IncomingMatch | null>(null)
  const [lastReceived, setLastReceived] = useState<string | null>(null)
  const rows = query.data ?? []
  const waiting = pendingCount(rows)
  const errorText = receive.isError ? dataErrorMessage(receive.error, t) : null

  const options: QrScanOption[] = rows.flatMap((row) =>
    row.pending.map(({ package: pkg, type }) => ({
      token: pkg.qrToken,
      label: t('sourcing.receiving.option', { id: pkg.id, type: type?.name ?? t('sourcing.receiving.unknownType') }),
      description: t('sourcing.receiving.optionMeta', { shipment: row.shipment.id, manufacturer: row.manufacturer?.name ?? row.shipment.manufacturerId }),
    })),
  )

  function handleReceived(result: ReceiptResult) {
    const { package: pkg, shipment } = result
    toast.success(t('sourcing.receiving.confirm.done', {
      id: pkg.id,
      shipment: shipment.id,
      received: format.integer(shipment.receipts.length),
      total: format.integer(shipment.packageIds.length),
    }))
    setLastReceived(pkg.id)
  }

  function openScanner() {
    receive.reset()
    setScanning(true)
  }

  function handleScan(token: string) {
    receive.reset()
    const match = pendingByToken(rows, token)
    if (match) {
      setScanning(false)
      setCandidate(match)
      return
    }
    receive.mutate(token, { onSuccess: handleReceived })
  }

  function handleConfirm() {
    if (!candidate) return
    receive.mutate(candidate.item.package.qrToken, {
      onSuccess: (result) => {
        handleReceived(result)
        setCandidate(null)
        // Còn kiện chờ thì mở lại máy quét cho kiện kế tiếp; kiện cuối thì dừng ở màn
        if (waiting > 1) setScanning(true)
      },
    })
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={rows.length > 0}
        title={t('sourcing.receiving.title')}
        meta={query.isSuccess ? (waiting === 0 ? t('sourcing.receiving.empty') : t('sourcing.receiving.count', { count: waiting })) : undefined}
        description={t('pageHero.receiving')}
        actions={
          <Button onClick={openScanner} disabled={!query.isSuccess} className="pointer-coarse:h-14 pointer-coarse:px-5 pointer-coarse:text-body-lg">
            <ScanLine strokeWidth={1.5} />
            {t('sourcing.receiving.scan')}
          </Button>
        }
      />

      <main className={rows.length > 0 ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6 max-sm:px-4' : 'min-h-0 flex-1 overflow-auto px-shell py-6 max-sm:px-4'}>
        {query.isPending ? (
          <div role="status" aria-label={t('sourcing.receiving.loading')} className="flex justify-center py-16"><Spinner /></div>
        ) : query.isError ? (
          <Banner tone="danger">{dataErrorMessage(query.error, t)}</Banner>
        ) : rows.length === 0 ? (
          <EmptyState mascot="warehouseWaiting" title={t('sourcing.receiving.noShipments')} description={t('sourcing.receiving.noShipmentsDescription')} />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <section aria-label={t('sourcing.receiving.shipments')} className="flex min-w-0 flex-col gap-4">
              {rows.map((row) => <IncomingShipmentCard key={row.shipment.id} row={row} />)}
            </section>
            <RecentReceipts rows={rows} />
          </div>
        )}
      </main>

      <QrScanDialog
        open={scanning}
        onOpenChange={setScanning}
        title={t('sourcing.receiving.scanTitle')}
        description={lastReceived ? t('sourcing.receiving.scanNext', { id: lastReceived }) : t('sourcing.receiving.scanDescription')}
        onScan={handleScan}
        options={options}
        error={scanning ? errorText : null}
        pending={receive.isPending}
      />
      <ReceiveConfirmDialog
        match={candidate}
        pending={receive.isPending}
        error={candidate ? errorText : null}
        onConfirm={handleConfirm}
        onBack={() => { setCandidate(null); openScanner() }}
        onClose={() => { setCandidate(null); receive.reset() }}
      />
    </div>
  )
}
