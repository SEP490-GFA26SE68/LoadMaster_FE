import { AlertTriangle, CheckCircle2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { GlassChip, MUTED, StopMark } from '../panels/scene-ui'
import type { LifoBlockage } from './unloading'

type BlockerProps = {
  target?: ScenePlacement; lifo: LifoBlockage; onSelect: (placement: ScenePlacement) => void
  /** Planner: bút chì cạnh kiện chắn — chọn kiện đó rồi vào Chỉnh sửa. Vắng khi người xem không được chỉnh. */
  onEdit?: (placement: ScenePlacement) => void
  /** `dark`: kính tối của Planner (V2.3 `.bk`); mặc định nền sáng của màn tài xế (đợt 6 đổi). */
  tone?: 'light' | 'dark'
}

/** Kiểm LIFO của domain cho kiện đang xem: che kín hoặc che một phần lối dỡ, kèm kiện chắn gần kiện đó trước. */
export function BlockerPanel({ tone = 'light', ...props }: BlockerProps) {
  return tone === 'dark' ? <DarkBlockerPanel {...props} /> : <LightBlockerPanel {...props} />
}

function useSummary(lifo: LifoBlockage) {
  const t = useT()
  const format = useFormat()
  const count = lifo?.blockers.length ?? 0
  return !lifo ? t('viewer.operations.blockers.clear')
    : lifo.code === 'LIFO_BLOCKED' ? t('viewer.operations.blockers.blocked', { count })
      : t('viewer.operations.blockers.partial', { count, coverage: format.percent(lifo.coverage * 100) })
}

function LightBlockerPanel({ target, lifo, onSelect }: Omit<BlockerProps, 'tone'>) {
  const t = useT()
  const summary = useSummary(lifo)
  return <section aria-label={t('viewer.operations.blockers.title')} className="flex flex-col gap-2 text-body-lg xl:text-body">
    <h3 className="font-medium">{target?.id ?? t('viewer.operations.blockers.pick')}</h3>
    {target ? <>
      <p>{summary}</p>
      <ul className="max-h-56 overflow-auto">
        {(lifo?.blockers ?? []).map((p) => <li key={p.id}><Button variant="ghost" className="h-14 w-full justify-start px-2 font-mono text-body-lg xl:h-11 xl:text-body" onClick={() => onSelect(p)}>
          {t('common.packageAtStop', { id: p.id, stop: p.stop })}
        </Button></li>)}
      </ul>
    </> : null}
    <p className="text-text-2">{t('viewer.operations.blockers.scope')}</p>
  </section>
}

/** Kính tối: kiện đang xét (không bấm được), câu tóm tắt, từng kiện chắn là một dòng bấm để xem (mã · điểm, tên, kích thước). */
function DarkBlockerPanel({ target, lifo, onSelect, onEdit }: Omit<BlockerProps, 'tone'>) {
  const t = useT()
  const format = useFormat()
  const summary = useSummary(lifo)
  return <section aria-label={t('viewer.operations.blockers.title')}
    className={cn('flex flex-col gap-2 rounded-lg border bg-canvas-2/45 p-3 text-body-lg xl:text-small', lifo ? 'border-amber-500/35' : 'border-glass-dark-border')}>
    <div className="flex items-center justify-between gap-2">
      <h3 className="font-semibold text-sky-text xl:text-lede">{t('viewer.operations.blockers.title')}</h3>
      <GlassChip tone="warn" size="tag">{t('viewer.operations.blockers.lifoCheck')}</GlassChip>
    </div>
    {target ? <>
      <p className="flex min-w-0 items-center gap-2">
        <StopMark stop={target.stop} className="size-5" />
        <span className="flex-none font-mono text-sky-text">{target.id}</span>
        <span className={cn('min-w-0', MUTED)}>{target.name}</span>
      </p>
      <p className={cn('flex items-start gap-2', lifo ? 'text-amber-200' : 'text-cyan-100')}>
        {lifo ? <AlertTriangle className="mt-0.5 size-4 flex-none text-amber-500" strokeWidth={1.5} aria-hidden />
          : <CheckCircle2 className="mt-0.5 size-4 flex-none text-green-500" strokeWidth={1.5} aria-hidden />}
        {summary}
      </p>
      {lifo?.blockers.length ? <ul className="m-0 flex max-h-56 list-none flex-col gap-1.5 overflow-auto p-0">
        {lifo.blockers.map((p) => <li key={p.id} className="flex items-center gap-1.5 rounded-md bg-sky-glass p-1 inset-ring-[1.5px] inset-ring-glass-dark-text/55">
          <StopMark stop={p.stop} decorative className="ml-1" />
          <button type="button" onClick={() => onSelect(p)}
            className="flex min-h-14 min-w-0 flex-1 items-center rounded-sm px-1.5 text-left hover:bg-sky-glass focus-visible:outline-2 focus-visible:outline-primary xl:min-h-0 xl:py-1">
            <span className="min-w-0">
              <span className="block font-mono text-sky-text">{t('common.packageAtStop', { id: p.id, stop: p.stop })}</span>
              <span className={cn('block text-body xl:text-caption', MUTED)}>{p.name}</span>
              <span className={cn('block text-body xl:text-caption', MUTED)}>{format.dimensions(p.lengthCm, p.widthCm, p.heightCm)} · {format.weight(p.weightKg)}</span>
            </span>
          </button>
          {onEdit ? <Button variant="glass" className="size-14 flex-none p-0 xl:size-8" aria-label={t('viewer.operations.blockers.edit', { id: p.id })} onClick={() => onEdit(p)}>
            <Pencil strokeWidth={1.5} />
          </Button> : null}
        </li>)}
      </ul> : null}
    </> : <p className={MUTED}>{t('viewer.operations.blockers.pick')}</p>}
    <p className={cn('text-body xl:text-caption', MUTED)}>{t('viewer.operations.blockers.scope')}</p>
  </section>
}
