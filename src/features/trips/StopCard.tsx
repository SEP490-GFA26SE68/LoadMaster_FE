import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowRight, Check, Clock, GripVertical, Navigation, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import { RequirementPriorityTag } from '@/features/requirements/requirement-look'
import type { Formatter } from '@/lib/format'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import type { RouteStopEta } from '@/lib/mock-db'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { StopRow } from './trip-summary'

/** Giờ đến của một điểm trên sơ đồ tuyến; `arrived` khi xe đã đứng ở điểm (FE-6-09). */
export type StopEta = RouteStopEta & { readonly arrived?: boolean }

/** Trạng thái giao của một điểm khi chuyến đang giao / đã hoàn thành (LM-097). */
export type StopState =
  | { kind: 'done'; at: string; issues: number }
  | { kind: 'current'; unloaded: number; issues: number }
  | { kind: 'pending'; issues: number }

/** Mức hạn của điểm theo giờ đến dự kiến (FE-4b-09, PRD v2 mục 7.3): kịp hạn xanh lá, sát hạn hổ phách, trễ hạn dự kiến đỏ — luôn kèm chữ. */
const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

const iconButton = cn(
  'grid flex-none place-items-center rounded-sm text-ink-3 transition-colors duration-(--dur-fast) ease-standard',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
)

/**
 * Một điểm giao trên sơ đồ tuyến (V2.3 `ChiTietChuyen.jpg`): mốc màu định danh kèm số, tên, địa chỉ, số kiện · khối lượng; điểm có yêu
 * cầu giao thì thêm hạn sớm nhất và ưu tiên cao nhất của các yêu cầu ở điểm đó (FE-4b-04, D-73); khi chuyến đang giao thì thêm trạng
 * thái giao. Tuyến đã tối ưu (FE-4b-09) thì thêm giờ đến dự kiến và mức hạn; điểm chưa có toạ độ mang nhãn "Chưa có toạ độ" khi chuyến
 * còn lập kế hoạch. Là một `<li>` kéo được để đổi thứ tự (LM-046, dnd-kit, cả bàn phím) khi chuyến còn sửa được;
 * bấm tên để lọc bảng kiện (nút `aria-pressed`). Dòng `sr-only` đầu tiên đọc đủ điểm theo thứ tự cho trình đọc màn hình.
 *
 * Lệch có chủ ý khỏi mục 5 AGENTS.md: thẻ đang kéo dùng bóng `--e3` — lớp đang nhấc khỏi mặt phẳng.
 */
export function StopCard({ stop, total, lead, state, eta, missingCoordinates = false, readOnly = true, selected = false, onSelect, onRemove, wide = false }: {
  stop: StopRow
  total: number
  /** Mũi tên hoặc đoạn đường tới điểm này, nằm trong `<li>` để danh sách chỉ có kho và các điểm. */
  lead?: ReactNode
  state?: StopState
  /** Giờ đến dự kiến và mức hạn của điểm: của tuyến đã tối ưu, hoặc tính từ vị trí xe khi chuyến đang chạy (`arrived`: xe đã tới). */
  eta?: StopEta
  /** Điểm chưa có toạ độ nên chưa tối ưu tuyến được. */
  missingCoordinates?: boolean
  /** Không kéo, không xoá: người chỉ xem hoặc chuyến đã khoá (D-41, D-45). */
  readOnly?: boolean
  selected?: boolean
  onSelect?: () => void
  onRemove?: () => void
  /** Quá 6 điểm: mỗi điểm rộng cố định, khung cuộn ngang. */
  wide?: boolean
}) {
  const t = useT()
  const format = useFormat()
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: stop.id, disabled: readOnly })
  const packages = t('common.packageCount', { count: stop.packageCount })
  const weight = format.weight(stop.weightKg)
  const body = <StopBody stop={stop} packages={packages} weight={weight} state={state} eta={eta} missingCoordinates={missingCoordinates} />

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition: transition ?? undefined }}
      className={cn('relative flex min-w-0 items-stretch', wide ? 'w-64 flex-none' : 'flex-1', isDragging ? 'z-2' : 'z-1')}
    >
      <span className="sr-only">
        {t('trips.route.stop', { number: stop.number, total, name: stop.name, packages, weight })}
        {stop.deadline ? `, ${t('trips.route.deadlineA11y', { time: format.time(stop.deadline), date: format.date(stop.deadline) })}` : null}
        {stop.priority ? `, ${t('trips.route.priorityA11y', { priority: t(`requirements.priority.${stop.priority}`) })}` : null}
        {eta ? `, ${t(eta.arrived ? 'trips.routePlan.arrivedA11y' : 'trips.routePlan.etaA11y', { time: format.time(eta.eta), date: format.date(eta.eta) })}` : null}
        {eta?.deadlineStatus ? `, ${t(`common.deadlineStatuses.${eta.deadlineStatus}`)}` : null}
        {missingCoordinates ? `, ${t('trips.routePlan.missingCoordinates')}` : null}
        {state ? `, ${stateLabel(state, t, format)}` : null}
      </span>
      {lead}
      <div
        className={cn(
          'group relative flex min-w-0 items-start gap-1 rounded-md border py-2.5 pr-2.5 pl-2',
          // Đang giao: điểm rộng theo nội dung (tối đa 340 px), đoạn đường giãn phần còn lại (`ChiTietChuyenDangGiao.jpg`)
          state ? 'max-w-85 flex-[0_1_auto]' : 'flex-1',
          isDragging ? 'border-primary bg-bg shadow-e3' : selected ? 'border-cyan-200 bg-cyan-50' : 'border-transparent',
        )}
      >
        {readOnly ? null : (
          <button
            ref={setActivatorNodeRef}
            type="button"
            aria-label={t('trips.stops.dragHandle', { name: stop.name })}
            title={t('trips.stops.hint')}
            className={cn(iconButton, 'mt-1 h-6 w-4 text-text-disabled', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        {onSelect ? (
          <button
            type="button"
            aria-pressed={selected}
            aria-label={t('trips.stops.filter', { number: stop.number, name: stop.name })}
            onClick={onSelect}
            className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 rounded-sm text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {body}
          </button>
        ) : (
          <div aria-hidden className="flex min-w-0 flex-1 items-start gap-2.5">{body}</div>
        )}
        {readOnly || !onRemove ? null : (
          // Nút xoá nổi ở góc, hiện khi rê chuột hoặc có tiêu điểm trong thẻ (màn điều phối chỉ hỗ trợ desktop; màn cảm ứng luôn hiện)
          <button
            type="button"
            aria-label={t('trips.stops.remove', { name: stop.name })}
            onClick={onRemove}
            className={cn(
              iconButton,
              'absolute top-1.5 right-1.5 size-7 bg-surface shadow-e1 hover:bg-n-100',
              'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100',
            )}
          >
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}

/** Mũi tên giữa hai điểm khi chưa giao. */
export function StopArrow() {
  return <ArrowRight aria-hidden className="mx-1 size-4 flex-none self-center text-n-600" strokeWidth={1.75} />
}

/** Đoạn đường tới một điểm khi đang giao: tới điểm đã giao liền xanh lá, tới điểm đang giao chuyển sang xanh lam, còn lại nét đứt. */
export function StopLeg({ state }: { state: StopState }) {
  return (
    <span
      aria-hidden
      className={cn(
        'mx-4 mt-6 h-0.75 min-w-12 flex-1 rounded-full',
        state.kind === 'done' && 'bg-green-500',
        state.kind === 'current' && 'bg-linear-to-r from-green-500 to-azure-500',
        state.kind === 'pending' && 'bg-[repeating-linear-gradient(90deg,var(--n-400)_0_5px,transparent_5px_10px)]',
      )}
    />
  )
}

function StopBody({ stop, packages, weight, state, eta, missingCoordinates }: {
  stop: StopRow; packages: string; weight: string; state?: StopState; eta?: StopEta; missingCoordinates: boolean
}) {
  const t = useT()
  const format = useFormat()
  return (
    <>
      <span
        data-stop-marker={stop.number}
        className={cn(
          'relative grid size-6.5 flex-none place-items-center rounded-sm font-mono text-small font-semibold',
          state?.kind === 'current' && 'shadow-[0_0_0_3px_var(--bg),0_0_0_5px_var(--azure-500)]',
        )}
        style={{ background: stopColor(stop.number), color: stopForeground(stop.number) }}
      >
        {stop.number}
        {state?.kind === 'done' ? (
          <span className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full bg-green-500 text-white ring-2 ring-bg">
            <Check className="size-2.5" strokeWidth={3.5} />
          </span>
        ) : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="line-clamp-2 text-body font-semibold text-ink-strong">{stop.name}</span>
        {stop.address ? <span className="mt-0.5 line-clamp-2 text-fine text-ink-3">{stop.address}</span> : null}
        <span className={cn('mt-1 text-small tabular-nums', stop.packageCount === 0 ? 'text-ink-3' : 'font-medium text-ink-2')}>
          {packages} · {weight}
        </span>
        {stop.deadline ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-ink-2">
            <Clock aria-hidden className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} />
            <span className="tabular-nums">{t('trips.route.deadline', { time: format.time(stop.deadline), date: format.dayMonth(stop.deadline) })}</span>
            {stop.priority ? <RequirementPriorityTag priority={stop.priority} /> : null}
          </span>
        ) : null}
        {eta ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-small text-ink-2">
            <Navigation aria-hidden className="size-3.5 flex-none text-ink-3" strokeWidth={1.75} />
            <span className="tabular-nums">{t(eta.arrived ? 'trips.routePlan.arrived' : 'trips.routePlan.eta', { time: format.time(eta.eta), date: format.dayMonth(eta.eta) })}</span>
            {eta.deadlineStatus ? <Badge shape="tag" tone={DEADLINE_TONE[eta.deadlineStatus]}>{t(`common.deadlineStatuses.${eta.deadlineStatus}`)}</Badge> : null}
          </span>
        ) : null}
        {/* Chữ thường xuống dòng được — thẻ điểm hẹp khi chuyến nhiều điểm */}
        {missingCoordinates ? <span className="mt-1 text-small font-semibold text-amber-700">{t('trips.routePlan.missingCoordinates')}</span> : null}
        {state ? <StateLine state={state} total={stop.packageCount} /> : null}
      </span>
    </>
  )
}

function StateLine({ state, total }: { state: StopState; total: number }) {
  const t = useT()
  const format = useFormat()
  const issues = state.issues > 0 ? (
    <span className="ml-1 inline-flex h-5 items-center rounded-sm bg-amber-50 px-1.5 text-note font-semibold text-amber-700">
      {t('trips.route.issueTag', { count: state.issues })}
    </span>
  ) : null
  if (state.kind === 'done') {
    return (
      <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-small font-semibold text-green-700">
        {t('trips.route.state.done', { time: format.time(state.at) })}
        {issues}
      </span>
    )
  }
  if (state.kind === 'current') {
    return (
      <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-small">
        <span className="size-1.75 flex-none rounded-full bg-azure-500 shadow-[0_0_0_3px_color-mix(in_srgb,var(--azure-500)_22%,transparent)]" />
        <span className="font-semibold text-azure-700">{t('trips.route.state.current')}</span>
        <span className="text-ink-2">· {t('trips.route.unloaded', { done: format.integer(state.unloaded), total: format.integer(total) })}</span>
        {issues}
      </span>
    )
  }
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-small text-ink-3">
      <span className="size-1.75 flex-none rounded-full shadow-[inset_0_0_0_1.5px_var(--n-500)]" />
      {t('trips.route.state.pending')}
      {issues}
    </span>
  )
}

function stateLabel(state: StopState, t: TFunction, format: Formatter): string {
  if (state.kind === 'done') return t('trips.route.stateA11y.done', { time: format.time(state.at) })
  return state.kind === 'current' ? t('trips.route.stateA11y.current') : t('trips.route.stateA11y.pending')
}
