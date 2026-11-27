import type { ReactNode } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { MUTED } from '../panels/scene-ui'
import type { VehicleFacts } from './vehicle-facts'

/**
 * Bảng số của xe trên nền tối đặc (bảng thông số xe của Planner, mục "Xe của chuyến" của hộp Hiển thị trên điện thoại): lòng thùng,
 * cửa sau, khoảng hở, tải trọng, trục, vật cản — chỉ số xe đã khai; số nào không khai thì bỏ dòng hoặc ghi "Chưa khai".
 */
export function VehicleFactsList({ facts, className }: { facts: VehicleFacts; className?: string }) {
  const t = useT()
  const format = useFormat()
  const { interior, door, axles } = facts
  const limit = (kg: number | undefined) => (kg === undefined ? <Muted>{t('viewer.vehicleCard.limitMissing')}</Muted> : format.weight(kg))
  return (
    <dl className={cn('grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-body-lg xl:gap-y-1.5 xl:text-small', className)}>
      <Row label={t('viewer.vehicleCard.interior')}>
        {format.dimensions(interior.lengthCm, interior.widthCm, interior.heightCm)} · {format.volumeM3(interior.volumeCm3)}
      </Row>
      <Row label={t('viewer.vehicleCard.door')}>{format.widthByHeight(door.widthCm, door.heightCm)}</Row>
      {facts.clearanceCm === null ? null : <Row label={t('viewer.vehicleCard.clearance')}>{format.length(facts.clearanceCm)}</Row>}
      <Row label={t('viewer.vehicleCard.payload')}>{format.weight(facts.payloadKg)}</Row>
      <Row label={t('viewer.vehicleCard.axles')}>
        {axles.status === 'missing' ? <Muted>{t('viewer.vehicleCard.axlesMissing')}</Muted> : t('viewer.vehicleCard.axleCount', { count: axles.count })}
      </Row>
      {axles.status === 'computed' ? <>
        <Row label={t('viewer.vehicleCard.frontLimit')}>{limit(axles.frontLimitKg)}</Row>
        <Row label={t('viewer.vehicleCard.rearLimit')}>{limit(axles.rearLimitKg)}</Row>
      </> : null}
      {axles.status === 'unavailable' ? <dd className={cn('col-span-2 font-sans', MUTED)}>{t(`viewer.axles.unavailable.${axles.reason}`)}</dd> : null}
      <Row label={t('viewer.vehicleCard.obstacles')}>
        {facts.obstacles.length === 0 ? <Muted>{t('viewer.vehicleCard.noObstacles')}</Muted> : (
          <span className="font-sans">{format.list(facts.obstacles.map(({ type, count }) =>
            t('viewer.vehicleCard.obstacleCount', { type: t(`viewer.obstacles.types.${type}`), count: format.integer(count) })))}</span>
        )}
      </Row>
    </dl>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <>
    <dt className={MUTED}>{label}</dt>
    <dd className="font-mono text-glass-dark-text tabular-nums">{children}</dd>
  </>
}

function Muted({ children }: { children: ReactNode }) {
  return <span className={cn('font-sans', MUTED)}>{children}</span>
}
