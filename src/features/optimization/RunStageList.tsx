import { Check, Circle, LoaderCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RUN_STAGES, type RunStage } from './run-progress'

export type StepItem = {
  readonly key: string
  readonly label: string
  readonly state: 'done' | 'current' | 'pending'
  /** Câu ngắn dưới bước đang làm. */
  readonly note?: ReactNode
}

/**
 * Các bước thật của lần chạy (giữ credit → xếp ba phương án → lưu kết quả), đọc từ `runOptimization`. Ngữ pháp chấm của V2.3: dấu kiểm
 * là đã xong, vòng quay là đang làm (azure — đang chạy), vòng rỗng là chưa tới. Bước đang làm mang `aria-current="step"`; trạng thái của
 * từng bước có chữ cho trình đọc màn hình, không chỉ dựa vào icon.
 */
export function RunStageList({ stage, className }: { stage: RunStage; className?: string }) {
  const t = useT()
  const current = RUN_STAGES.indexOf(stage)
  const items = RUN_STAGES.map((item, index): StepItem => ({
    key: item,
    label: t(`optimization.running.stages.${item}`),
    state: index < current ? 'done' : index === current ? 'current' : 'pending',
  }))
  return <StepList items={items} label={t('optimization.running.stagesLabel')} attribute="data-run-stage" className={className} />
}

/** Danh sách bước dùng chung của hộp thoại chạy tối ưu (kho mẫu và máy chủ). `attribute` là tên thuộc tính mang mã bước, cho test. */
export function StepList({ items, label, attribute, className }: {
  items: readonly StepItem[]
  label: string
  attribute: 'data-run-stage' | 'data-server-step'
  className?: string
}) {
  const t = useT()
  return (
    <ol aria-label={label} className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}>
      {items.map((item) => (
        <li
          key={item.key}
          {...{ [attribute]: item.key }}
          data-state={item.state}
          aria-current={item.state === 'current' ? 'step' : undefined}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-x-2 text-small"
        >
          <span aria-hidden className="grid size-5 place-items-center">
            {item.state === 'done' ? (
              <Check className="size-4 text-azure-700" strokeWidth={2} />
            ) : item.state === 'current' ? (
              <LoaderCircle className="size-4 animate-spin text-azure-700 motion-reduce:animate-none" strokeWidth={2} />
            ) : (
              <Circle className="size-3.5 text-n-400" strokeWidth={2} />
            )}
          </span>
          <span className={item.state === 'pending' ? 'text-ink-3' : item.state === 'current' ? 'font-medium text-ink-strong' : 'text-ink-2'}>
            {item.label}
            <span className="sr-only">: {t(`optimization.running.stageStates.${item.state}`)}</span>
          </span>
          {item.note ? <span className="col-start-2 text-pretty text-ink-2">{item.note}</span> : null}
        </li>
      ))}
    </ol>
  )
}
