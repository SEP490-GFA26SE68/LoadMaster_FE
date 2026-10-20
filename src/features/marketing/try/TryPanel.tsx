import { TriangleAlert } from 'lucide-react'
import { useWatch, type Control } from 'react-hook-form'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { previewTruck, type TryFormValues } from './try-form'
import { tryErrorLines } from './try-messages'
import { TryPreview } from './TryPreview'
import { TryLegend, TryResult } from './TryResult'
import { isAbort, type useTryRun } from './useTryRun'

type TryRun = ReturnType<typeof useTryRun>

const PREVIEW = 'h-56 sm:h-64 lg:h-72'
const NOTE = 'm-0 text-small text-pretty text-sky-text-2 pointer-coarse:text-body-lg'

/** Lòng thùng theo số đang nhập, trước lần tính đầu và trong lúc tính. Chỉ phần này theo dõi các ô của xe. */
function LivePreview({ control, dim }: { control: Control<TryFormValues>; dim: boolean }) {
  const truck = previewTruck(useWatch({ control, name: 'truck' }))
  return (
    <TryPreview
      lengthCm={truck.lengthCm}
      widthCm={truck.widthCm}
      heightCm={truck.heightCm}
      className={cn(PREVIEW, 'transition-opacity duration-(--dur-md)', dim && 'opacity-60')}
    />
  )
}

/** Thanh tiến độ của lần tính: chỉ đổi `transform`, số "Đã xét n / tổng" lấy từ bộ xếp. */
function TryProgress({ progress }: { progress: TryRun['progress'] }) {
  const t = useT()
  const format = useFormat()
  const ratio = progress && progress.total > 0 ? progress.placed / progress.total : 0
  const percent = Math.round(ratio * 100)
  return (
    <div className="flex flex-col gap-2">
      <div
        role="progressbar"
        aria-label={t('landingTry.result.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-border-dark"
      >
        <div className="try-meter h-full w-full rounded-full bg-cyan-400" style={{ transform: `scaleX(${ratio})` }} />
      </div>
      {progress ? (
        <p className={cn(NOTE, 'tabular-nums')}>
          {t('landingTry.result.progress', { placed: format.integer(progress.placed), total: format.integer(progress.total) })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * Cột kết quả, nền tối đặc như thẻ xem trước 3D: hình đẳng cự, rồi tiến độ, lỗi hoặc số của lần tính. Một vùng `status`
 * luôn có mặt (ẩn, cho trình đọc màn hình) nói đang tính, đã tính xong với số chính, hay vì sao không ra kết quả.
 */
export function TryPanel({ control, run }: { control: Control<TryFormValues>; run: TryRun }) {
  const t = useT()
  const format = useFormat()
  const { mutation, progress } = run
  const outcome = mutation.isSuccess ? mutation.data : undefined
  const errorLines = mutation.isError ? tryErrorLines(mutation.error, t, format) : []
  const cancelled = mutation.isError && isAbort(mutation.error)
  let announcement = ''
  if (mutation.isPending) announcement = t('landingTry.announce.running')
  else if (outcome) {
    announcement = t('landingTry.announce.done', {
      placed: format.integer(outcome.placedCount),
      total: format.integer(outcome.totalCount),
      volume: format.percent(outcome.volumePercent),
    })
  } else if (errorLines.length > 0) announcement = errorLines.join(' ')

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border-dark bg-panel-dark p-4 text-sky-text sm:p-6">
      <h3 className="m-0 flex min-h-7 items-center font-display text-h3 leading-5.5 font-[650] text-sky-text font-stretch-106%">{t('landingTry.result.title')}</h3>
      {outcome ? (
        <TryPreview
          key={mutation.submittedAt}
          lengthCm={outcome.container.lengthCm}
          widthCm={outcome.container.widthCm}
          heightCm={outcome.container.heightCm}
          boxes={outcome.boxes}
          className={PREVIEW}
        />
      ) : (
        <LivePreview control={control} dim={mutation.isPending} />
      )}
      {outcome ? <TryLegend kinds={outcome.input.cartons.length} /> : null}
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      {mutation.isPending ? <TryProgress progress={progress} /> : null}
      {errorLines.length > 0 ? (
        <div className={cn('flex gap-2 rounded-md border px-3 py-2.5', cancelled ? 'border-border-dark' : 'border-red-500/60 bg-red-500/10')}>
          {cancelled ? null : <TriangleAlert aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 flex-none text-red-200" />}
          <div className="flex flex-col gap-1">
            {errorLines.map((line, index) => (
              <p key={index} className={cn(NOTE, !cancelled && 'text-red-200')}>{line}</p>
            ))}
          </div>
        </div>
      ) : null}
      {outcome ? <TryResult outcome={outcome} control={control} /> : null}
      {mutation.isIdle ? <p className={NOTE}>{t('landingTry.result.idle')}</p> : null}
    </div>
  )
}
