import { PackageCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { useFormat, useT } from '@/lib/i18n'
import type { IncomingMatch } from './receiving-view'

const TOUCH = 'pointer-coarse:h-14 pointer-coarse:px-5 pointer-coarse:text-body-lg'

/**
 * Bước đối chiếu sau khi quét (LM-104): hiện thông tin nhà sản xuất đã đăng ký cho kiện vừa quét — mã, loại, kích thước D × R × C,
 * khối lượng, mức dễ vỡ, nhà sản xuất, lô — để người nhận so với kiện thật rồi mới xác nhận. Kho từ chối thì câu lỗi hiện ngay trong
 * hộp thoại. Nút cao 56 px khi dùng cảm ứng (máy tính bảng ở kho).
 */
export function ReceiveConfirmDialog({ match, pending, error, onConfirm, onBack, onClose }: {
  match: IncomingMatch | null
  pending: boolean
  error: string | null
  onConfirm: () => void
  onBack: () => void
  onClose: () => void
}) {
  const t = useT()
  const format = useFormat()
  const pkg = match?.item.package
  const type = match?.item.type

  return (
    <Dialog open={match !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="w-140">
        {match && pkg ? (
          <>
            <DialogHeader
              icon={PackageCheck}
              title={t('sourcing.receiving.confirm.title', { id: pkg.id })}
              description={t('sourcing.receiving.confirm.description')}
            />
            <div className="flex flex-col gap-4 px-7 py-5">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 text-body pointer-coarse:text-body-lg">
                <Field label={t('sourcing.receiving.confirm.type')}>{type?.name ?? t('sourcing.receiving.unknownType')}</Field>
                {type ? (
                  <>
                    <Field label={t('sourcing.receiving.confirm.dimensions')} mono>
                      {format.dimensions(type.lengthCm, type.widthCm, type.heightCm)}
                    </Field>
                    <Field label={t('sourcing.receiving.confirm.weight')} mono>{format.weight(type.weightKg)}</Field>
                    <Field label={t('sourcing.receiving.confirm.fragility')}>{t(`trips.form.fragilityLevels.${type.fragilityLevel}`)}</Field>
                  </>
                ) : null}
                <Field label={t('sourcing.receiving.confirm.manufacturer')}>{match.row.manufacturer?.name ?? pkg.ownerCompanyId}</Field>
                <Field label={t('sourcing.receiving.confirm.shipment')} mono>{match.row.shipment.id}</Field>
                {pkg.reference ? <Field label={t('sourcing.receiving.confirm.reference')} mono>{pkg.reference}</Field> : null}
                <Field label={t('sourcing.receiving.confirm.qr')} mono>{pkg.qrToken}</Field>
              </dl>
              {error ? <p role="alert" className="text-fine text-danger">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" className={TOUCH} onClick={onBack} disabled={pending}>
                {t('sourcing.receiving.confirm.back')}
              </Button>
              <Button type="button" className={TOUCH} loading={pending} onClick={onConfirm}>
                {t('sourcing.receiving.confirm.submit')}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className={mono ? 'font-mono text-ink-strong tabular-nums' : 'font-medium text-ink-strong'}>{children}</dd>
    </>
  )
}
