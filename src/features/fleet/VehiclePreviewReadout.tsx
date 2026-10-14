import type { ReactNode } from 'react'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { passableOpening, type PreviewFacts } from './vehicle-preview'

/**
 * Bảng số dưới mô hình ở form xe: đúng những số mô hình đang vẽ (xe hợp lệ gần nhất), cộng tải trọng và khoảng hở — hai số không
 * có hình. Là chữ thật nên nét ở mọi độ phân giải, và là nội dung tương đương của mô hình cho trình đọc màn hình.
 */
export function VehiclePreviewReadout({ vehicle, facts }: { vehicle: VehicleConfig; facts: PreviewFacts }) {
  const t = useT()
  const format = useFormat()
  const volumeCm3 = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  const passable = passableOpening(vehicle, facts.clearanceCm)
  const axles = [...(vehicle.axles ?? [])].sort((a, b) => a.positionXCm - b.positionXCm)

  return (
    <dl aria-label={t('fleet.preview.readout.label')} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-small">
      <Row label={t('fleet.preview.readout.cargoSpace')}>
        {format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm)} · {format.volumeM3(volumeCm3)}
      </Row>
      <Row label={t('fleet.preview.readout.door')}>
        {format.widthByHeight(vehicle.doorWidthCm, vehicle.doorHeightCm)}
        {passable ? (
          <span className="font-sans text-glass-dark-muted">
            {' · '}{t('fleet.preview.readout.passable', { size: format.widthByHeight(passable.widthCm, passable.heightCm) })}
          </span>
        ) : null}
      </Row>
      <Row label={t('fleet.preview.readout.payload')} muted={facts.payloadKg === null}>
        {facts.payloadKg === null ? t('fleet.preview.readout.payloadMissing') : format.weight(facts.payloadKg)}
      </Row>
      <Row label={t('fleet.preview.readout.obstacles')}>{format.integer(vehicle.obstacles.length)}</Row>
      <Row label={t('fleet.preview.readout.axles')} muted={axles.length === 0}>
        {axles.length === 0
          ? t('fleet.preview.readout.axlesMissing')
          : format.list(axles.map((axle, index) => t('fleet.preview.readout.axle', {
              name: axle.name || t('fleet.preview.readout.axleUnnamed', { index: format.integer(index + 1) }),
              position: format.length(axle.positionXCm),
            })))}
      </Row>
    </dl>
  )
}

function Row({ label, muted = false, children }: { label: string; muted?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-glass-dark-muted">{label}</dt>
      <dd className={muted ? 'text-glass-dark-muted' : 'font-mono text-glass-dark-text tabular-nums'}>{children}</dd>
    </>
  )
}
