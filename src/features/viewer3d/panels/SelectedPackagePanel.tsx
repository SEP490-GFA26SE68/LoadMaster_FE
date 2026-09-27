import { AlertCircle, CheckCircle2, Focus, Pencil, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import type { ConstraintIssue } from '@/domain/constraints'
import { effectiveOrientations, type OrientationRules } from '@/domain/geometry'
import { formatIssue, useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { SceneStop, ScenePlacement } from '@/features/viewer3d/scene-input'
import { findAbove, findBelow, layerOf } from './placement-relations'
import { DARK_SUBCARD, GlassChip, GlassValue, MUTED, StopMark } from './scene-ui'

export type SelectedPackageProps = {
  placement: ScenePlacement | undefined
  placements: readonly ScenePlacement[]
  /** Luật xoay của kiện gốc (LM-032); vắng thì chỉ hiện hướng hiện tại. */
  orientationRules?: OrientationRules
  totalSteps: number
  stops: readonly SceneStop[]
  tripId: string
  /** Lỗi/cảnh báo ràng buộc của phương án; thẻ lọc theo kiện đang chọn (LM-049) */
  issues?: readonly ConstraintIssue[]
  /** Hộp thông tin: nút bỏ chọn */
  onClose?: () => void
  /** Thẻ nổi trên khung 3D: mã kiện là nút mở hộp thông tin ở tab Kiện (tên truy cập "Chọn kiện") */
  onPick?: () => void
  onEdit?: () => void
  onFocus: () => void
  className?: string
}

/**
 * Thẻ kiện đang chọn trên kính tối (V2.3 `.insp`): mã, tên, điểm giao, rồi các ô số — kích thước, khối lượng, kiện gốc, thứ tự
 * xếp/dỡ, hướng xoay, tỷ lệ đỡ đáy (%), vị trí — và lỗi ràng buộc của riêng kiện. Dùng hai nơi: nổi bên phải khung 3D từ 1.280 px
 * và trong tab Kiện của hộp thông tin.
 */
export function SelectedPackagePanel({ placement, onClose, onPick, className, ...props }: SelectedPackageProps) {
  const t = useT()
  return (
    <aside aria-label={t('viewer.selected.label')} className={cn('flex min-h-0 flex-col text-body-lg xl:text-body', className)}>
      {placement ? <PackageDetails placement={placement} onClose={onClose} onPick={onPick} {...props} /> : (
        <div className="flex flex-col items-start gap-3 p-4">
          <p className={MUTED}>{t('viewer.selected.empty')}</p>
          {onPick ? <Button variant="glass" size="sm" onClick={onPick}>{t('viewer.hud.selectPackage')}</Button> : null}
        </div>
      )}
    </aside>
  )
}

function PackageDetails({ placement, placements, orientationRules, totalSteps, stops, tripId, issues = [], onClose, onPick, onEdit, onFocus }:
  Omit<SelectedPackageProps, 'placement' | 'className'> & { placement: ScenePlacement }) {
  const format = useFormat()
  const t = useT()
  const cm = format.lengthValue
  const stopName = stops.find((s) => s.number === placement.stop)?.name ?? ''
  const layer = layerOf(placement, placements)
  const below = findBelow(placement, placements)
  const above = findAbove(placement, placements)
  const ownIssues = issues.filter((issue) => issue.packageInstanceId === placement.id || issue.relatedIds?.includes(placement.id))

  return (
    <>
      <div className="flex-none border-b border-glass-dark-border px-4 pt-4 pb-3">
        <div className="flex items-start gap-2">
          {onPick ? (
            <button type="button" aria-label={t('viewer.hud.selectPackage')} onClick={onPick}
              className="-mx-1 rounded-sm px-1 font-mono text-cyan-200 hover:bg-sky-glass focus-visible:outline-2 focus-visible:outline-primary">
              {placement.id}
            </button>
          ) : <h2 className="font-mono text-cyan-200">{placement.id}</h2>}
          {placement.fragile ? <GlassChip tone="warn" size="tag"><AlertCircle strokeWidth={1.5} aria-hidden />{t('viewer.selected.fragile')}</GlassChip> : null}
          {onClose ? (
            <Button variant="skyGhost" className="-mt-2 -mr-2 ml-auto size-14 p-0 xl:size-9" aria-label={t('viewer.selected.deselect')} onClick={onClose}>
              <X strokeWidth={1.5} aria-hidden />
            </Button>
          ) : null}
        </div>
        <p className="mt-1.5 font-display text-h3 leading-snug font-[650] text-sky-text">{placement.name}</p>
        <p className="mt-1.5 flex items-center gap-2 text-glass-dark-text/85 xl:text-small">
          <StopMark stop={placement.stop} />{stopName}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <dl className="m-0 grid grid-cols-2 gap-2.5 px-4 py-3">
          <Cell label={t('viewer.selected.size')} wide>
            <GlassValue value={`${cm(placement.lengthCm)} × ${cm(placement.widthCm)} × ${cm(placement.heightCm)}`} unit="cm" mono />
          </Cell>
          <Cell label={t('viewer.selected.weight')}><GlassValue value={format.weight(placement.weightKg)} mono /></Cell>
          <Cell label={t('viewer.selected.sourcePackage')}>
            <Link to={`/chuyen/${tripId}?kien=${encodeURIComponent(placement.packageId)}`}
              className="font-mono text-body text-cyan-200 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary">
              {placement.packageId}
            </Link>
          </Cell>
          <Cell label={t('viewer.operations.loadingOrder')}><GlassValue value={format.integer(placement.step)} unit={`/ ${format.integer(totalSteps)}`} /></Cell>
          {/* Spec 7.11: thứ tự dỡ riêng; phương án cũ không có `unloadingOrder` thì không hiện số */}
          <Cell label={t('viewer.operations.unloadingOrder')}>
            {placement.unloadingOrder > 0
              ? <GlassValue value={format.integer(placement.unloadingOrder)} unit={`/ ${format.integer(placements.length)}`} />
              : <GlassValue value="—" />}
          </Cell>
          <Cell label={t('viewer.selected.orientation')}>
            <GlassValue mono value={placement.orientation} unit={orientationRules?.keepUpright ? `· ${t('viewer.orientation.keepUpright')}` : undefined} />
          </Cell>
          <Cell label={t('viewer.plan.detail.supportRatio')}>
            <GlassValue value={format.percent(placement.supportRatio * 100)} />
          </Cell>
          <Cell label={t('viewer.selected.position')} wide>
            <GlassValue value={`${cm(placement.position.x)} · ${cm(placement.position.y)} · ${cm(placement.position.z)}`} unit="cm" mono />
            <span className={cn('mt-1 block text-body xl:text-caption', MUTED)}>
              {below ? t('viewer.selected.layerOn', { layer, id: below.id }) : t('viewer.selected.layerOnFloor', { layer })}
              {above ? ` · ${t('viewer.selected.above', { id: above.id, weight: `${format.decimal(above.weightKg)} kg` })}` : ''}
            </span>
          </Cell>
        </dl>

        <section className="flex flex-col gap-1.5 px-4 pb-2" aria-label={t('viewer.plan.detail.issues')}>
          {ownIssues.length === 0 ? (
            <span className="flex items-center gap-2 text-cyan-100 xl:text-small">
              <CheckCircle2 className="size-4.5 flex-none text-green-500" strokeWidth={1.5} aria-hidden />{t('viewer.plan.detail.noIssues')}
            </span>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {ownIssues.map((issue, index) => (
                <li key={`${issue.code}-${index}`} className={cn('flex items-start gap-2 xl:text-small', issue.severity === 'error' ? 'text-red-200' : 'text-amber-200')}>
                  <AlertCircle className={cn('mt-0.5 size-4 flex-none', issue.severity === 'error' ? 'text-red-500' : 'text-amber-500')} strokeWidth={1.5} aria-hidden />
                  {formatIssue(issue, t, format)}
                </li>
              ))}
            </ul>
          )}
          <span className={cn('text-body xl:text-caption', MUTED)}>
            {t(placement.pinned ? 'viewer.selected.pinned' : 'viewer.selected.notPinned')}
            {orientationRules && onClose ? ` · ${t('viewer.orientation.allowed', { codes: format.list(effectiveOrientations(orientationRules)) })}` : ''}
          </span>
        </section>
      </div>

      <div className="flex flex-none flex-wrap gap-2 px-4 pt-2 pb-4">
        <Button variant="glass" className="h-14 flex-auto gap-1.5 px-2.5 text-body-lg xl:h-9 xl:text-small" onClick={onFocus}><Focus strokeWidth={1.5} />{t('viewer.hud.focus')}</Button>
        {onEdit ? <Button variant="glass" className="h-14 flex-auto gap-1.5 px-2.5 text-body-lg xl:h-9 xl:text-small" onClick={onEdit}><Pencil strokeWidth={1.5} />{t('viewer.hud.edit')}</Button> : null}
      </div>
    </>
  )
}

function Cell({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 px-3 py-2.5', DARK_SUBCARD, 'bg-sky-glass/70', wide && 'col-span-2')}>
      <dt className={cn('text-body xl:text-note', MUTED)}>{label}</dt>
      <dd className="m-0 text-h3 leading-tight">{children}</dd>
    </div>
  )
}
