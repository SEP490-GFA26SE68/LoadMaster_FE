import { useWatch, type Control } from 'react-hook-form'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Odometer, Reveal } from '../reveal'
import { EMPTY_CARTON, sameInput, toTryInput, type TryFormValues } from './try-form'
import type { TryOutcome } from './try-request'

const LABEL = 'text-small text-sky-text-3 pointer-coarse:text-body-lg'
const VALUE = 'm-0 font-display text-h1 leading-8 font-bold whitespace-nowrap text-sky-text tabular-nums font-stretch-106%'
const NOTE = 'm-0 text-small text-pretty text-sky-text-2 pointer-coarse:text-body-lg'

const EMPTY_TRUCK: TryFormValues['truck'] = { lengthCm: '', widthCm: '', heightCm: '', payloadKg: '' }

/** Câu báo kết quả cũ: form đã đổi sau lần tính đang hiện (so số đã đọc, không so chữ — "45,0" và "45" là một). */
function StaleNote({ control, outcome }: { control: Control<TryFormValues>; outcome: TryOutcome }) {
  const t = useT()
  const values = useWatch({ control })
  const current = toTryInput({ truck: { ...EMPTY_TRUCK, ...values.truck }, cartons: (values.cartons ?? []).map((carton) => ({ ...EMPTY_CARTON, ...carton })) })
  if (sameInput(current, outcome.input)) return null
  return <p className="m-0 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-small text-amber-200 pointer-coarse:text-body-lg">{t('landingTry.result.stale')}</p>
}

/** Chú giải màu khi có hai loại kiện: chấm màu luôn kèm chữ. */
export function TryLegend({ kinds }: { kinds: number }) {
  const t = useT()
  if (kinds < 2) return null
  return (
    <ul aria-label={t('landingTry.result.legend')} className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
      {Array.from({ length: kinds }, (_, kind) => (
        <li key={kind} className="flex items-center gap-2 text-small text-sky-text-2 pointer-coarse:text-body-lg">
          <span aria-hidden className={cn('try-swatch size-3 rounded-sm', `try-kind-${kind}`)} />
          {t('landingTry.cartons.legend', { number: kind + 1 })}
        </li>
      ))}
    </ul>
  )
}

/**
 * Số của một lần thử, mọi số từ kết quả của bộ tối ưu mô phỏng: kiện xếp được / tổng, thể tích dùng, khối lượng đã xếp trên tải trọng,
 * kiện chưa xếp theo loại kèm lý do (mã lý do dịch bằng `viewer.unplacedReasons`), thời gian tính. Ba ô số lăn một lần khi kết quả hiện ra.
 */
export function TryResult({ outcome, control }: { outcome: TryOutcome; control: Control<TryFormValues> }) {
  const t = useT()
  const format = useFormat()
  const cells = [
    { key: 'placed', label: t('landingTry.result.placed'), value: t('landingTry.result.placedValue', { placed: format.integer(outcome.placedCount), total: format.integer(outcome.totalCount) }) },
    { key: 'volume', label: t('landingTry.result.volume'), value: format.percent(outcome.volumePercent) },
    { key: 'weight', label: t('landingTry.result.weight'), value: format.weight(outcome.usedKg), note: t('landingTry.result.weightOf', { max: format.weight(outcome.maxKg) }) },
  ]
  return (
    <div className="flex flex-col gap-4">
      <Reveal group>
        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          {cells.map((cell, index) => (
            <Reveal key={cell.key} kind="pop" index={index} className="flex min-w-0 flex-col gap-0.5">
              <dt className={LABEL}>{cell.label}</dt>
              <dd className={VALUE}><Odometer value={cell.value} /></dd>
              {cell.note ? <dd className="m-0 text-small text-sky-text-3 tabular-nums pointer-coarse:text-body-lg">{cell.note}</dd> : null}
            </Reveal>
          ))}
        </dl>
      </Reveal>
      <div className="flex flex-col gap-2 border-t border-border-dark pt-3">
        {outcome.unplaced.length === 0 ? (
          <p className={NOTE}>{t('landingTry.result.allPlaced')}</p>
        ) : (
          <>
            <h4 className="m-0 text-small font-semibold text-sky-text pointer-coarse:text-body-lg">{t('landingTry.result.unplacedTitle')}</h4>
            <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
              {outcome.unplaced.map((item) => (
                <li key={`${item.kind}-${item.reason}`} className="text-small text-pretty text-sky-text-2 pointer-coarse:text-body-lg">
                  {t('landingTry.result.unplacedRow', { kind: t('landingTry.cartons.legend', { number: item.kind + 1 }), count: format.integer(item.count), reason: t(`viewer.unplacedReasons.${item.reason}`) })}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <StaleNote control={control} outcome={outcome} />
      <p className={NOTE}>
        {t('landingTry.result.runtime', { ms: format.integer(Math.max(1, Math.round(outcome.runtimeMs))) })} {t('landingTry.result.source')}
      </p>
    </div>
  )
}
