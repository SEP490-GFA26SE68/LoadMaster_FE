import { Check, Circle, LoaderCircle } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { RUN_STAGES, type RunStage } from './run-progress'

/**
 * Các bước thật của lần chạy (giữ credit → xếp ba phương án → lưu kết quả), đọc từ `runOptimization`. Ngữ pháp chấm của V2.3: dấu kiểm
 * là đã xong, vòng quay là đang làm (azure — đang chạy), vòng rỗng là chưa tới. Bước đang làm mang `aria-current="step"`; trạng thái của
 * từng bước có chữ cho trình đọc màn hình, không chỉ dựa vào icon.
 */
export function RunStageList({ stage, className }: { stage: RunStage; className?: string }) {
  const t = useT()
  const current = RUN_STAGES.indexOf(stage)
  return (
    <ol aria-label={t('optimization.running.stagesLabel')} className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}>
      {RUN_STAGES.map((item, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'pending'
        return (
          <li
            key={item}
            data-run-stage={item}
            data-state={state}
            aria-current={state === 'current' ? 'step' : undefined}
            className="flex items-center gap-2 text-small"
          >
            <span aria-hidden className="grid size-5 flex-none place-items-center">
              {state === 'done' ? (
                <Check className="size-4 text-azure-700" strokeWidth={2} />
              ) : state === 'current' ? (
                <LoaderCircle className="size-4 animate-spin text-azure-700 motion-reduce:animate-none" strokeWidth={2} />
              ) : (
                <Circle className="size-3.5 text-n-400" strokeWidth={2} />
              )}
            </span>
            <span className={state === 'pending' ? 'text-ink-3' : state === 'current' ? 'font-medium text-ink-strong' : 'text-ink-2'}>
              {t(`optimization.running.stages.${item}`)}
            </span>
            <span className="sr-only">: {t(`optimization.running.stageStates.${state}`)}</span>
          </li>
        )
      })}
    </ol>
  )
}
