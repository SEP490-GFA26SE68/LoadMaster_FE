import { TriangleAlert } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { HowComputed, type HowEntry } from '../how/HowComputed'
import { axleRanges, axleSampleVehicle, axleTry, type AxleGauge, type AxleRange, type AxleTry } from './try-axle'
import { TryAxleTruck } from './TryAxleTruck'
import { TRY_LEGEND, TRY_NOTE } from './TryNumberInput'

/** Một thanh kéo gốc của trình duyệt (phím mũi tên, Home / End), 56 px trên máy cảm ứng; số đang chọn nằm cạnh nhãn và ở `aria-valuetext`. */
function AxleSlider({ label, hint, range, value, text, onChange }: {
  label: string
  hint?: string
  range: AxleRange
  value: number
  text: string
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <label htmlFor={id} className="text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{label}</label>
        <output htmlFor={id} className="font-mono text-body-lg font-semibold whitespace-nowrap text-ink-strong tabular-nums">{text}</output>
      </div>
      <input
        id={id}
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        aria-valuetext={text}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-full min-w-0 cursor-pointer accent-primary pointer-coarse:h-14"
      />
      {hint ? <p id={`${id}-hint`} className={TRY_NOTE}>{hint}</p> : null}
    </div>
  )
}

/** Tải một nhóm trục so với giới hạn: số, thước đo và — khi vượt — chữ "Vượt … kg" kèm biểu tượng (không chỉ đổi màu). */
function GaugeRow({ gauge }: { gauge: AxleGauge }) {
  const t = useT()
  const format = useFormat()
  const over = gauge.overKg > 0
  return (
    <div className="flex flex-col gap-1.5" data-axle-group={gauge.group} data-axle-over={over ? '' : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <dt className="text-small font-semibold text-ink-2 pointer-coarse:text-body-lg">{t(`landingTry.axle.groups.${gauge.group}`)}</dt>
        <dd className="m-0 font-mono text-body whitespace-nowrap text-ink-strong tabular-nums pointer-coarse:text-body-lg">
          {t('landingTry.axle.loadOfLimit', { load: format.weight(Math.round(gauge.loadKg)), limit: format.weight(gauge.limitKg) })}
        </dd>
      </div>
      <dd className="m-0 flex flex-col gap-1.5">
        <span aria-hidden className="block h-2.5 overflow-hidden rounded-full bg-n-100">
          <span className={cn('block h-full rounded-full', over ? 'bg-red-500' : 'bg-(image:--meter-fill)')} style={{ width: `${Math.max(0, Math.min(100, gauge.percent))}%` }} />
        </span>
        <span className={cn('flex flex-wrap items-center gap-x-2 text-small pointer-coarse:text-body-lg', over ? 'font-semibold text-danger' : 'text-ink-3')}>
          {over ? <TriangleAlert aria-hidden strokeWidth={1.5} className="size-4 flex-none" /> : null}
          <span>{t('landingTry.axle.percent', { value: format.percent(gauge.percent) })}</span>
          {over ? <span>· {t('landingTry.axle.over', { over: format.weight(Math.round(gauge.overKg)) })}</span> : null}
        </span>
      </dd>
    </div>
  )
}

/** Câu tóm tắt: trục nào vượt và nên làm gì, hoặc cả hai còn trong giới hạn. */
function useVerdict(result: AxleTry): string {
  const t = useT()
  const format = useFormat()
  const front = result.front.overKg > 0
  const rear = result.rear.overKg > 0
  if (front && rear) return t('landingTry.axle.overBoth')
  if (front) return t('landingTry.axle.overFront', { over: format.weight(Math.round(result.front.overKg)) })
  if (rear) return t('landingTry.axle.overRear', { over: format.weight(Math.round(result.rear.overKg)) })
  return t('landingTry.axle.within')
}

/** Các dòng của "Tính thế nào?": phần hàng chia cho hai trục rồi tải từng trục, thay đúng số đang kéo. */
function useAxleHow(result: AxleTry): HowEntry[] {
  const t = useT()
  const format = useFormat()
  return useMemo(() => {
    const kg = (value: number) => format.weight(Math.round(value))
    const load = (gauge: AxleGauge) => t('landingHow.axle.load', {
      empty: kg(gauge.emptyLoadKg), cargo: kg(gauge.cargoLoadKg), value: kg(gauge.loadKg), limit: kg(gauge.limitKg),
    })
    const lifted = result.front.cargoLoadKg < 0
    return [
      {
        key: 'share',
        label: t('landingHow.axle.shareLabel'),
        text: t(lifted ? 'landingHow.axle.shareLift' : 'landingHow.axle.share', {
          mass: kg(result.massKg), arm: format.length(result.armCm), wheelbase: format.length(result.wheelbaseCm),
          rear: kg(result.rear.cargoLoadKg), front: kg(Math.abs(result.front.cargoLoadKg)),
        }),
      },
      { key: 'front', label: t('landingHow.axle.frontLabel'), text: load(result.front) },
      { key: 'rear', label: t('landingHow.axle.rearLabel'), text: load(result.rear) },
    ]
  }, [result, t, format])
}

function AxleOutcome({ result }: { result: AxleTry }) {
  const t = useT()
  const verdict = useVerdict(result)
  const how = useAxleHow(result)
  const over = result.front.overKg > 0 || result.rear.overKg > 0
  return (
    <>
      <dl className="m-0 grid gap-4 sm:grid-cols-2">
        <GaugeRow gauge={result.front} />
        <GaugeRow gauge={result.rear} />
      </dl>
      <p aria-live="polite" className={cn('m-0 text-body-lg font-semibold text-pretty', over ? 'text-danger' : 'text-ink-strong')}>{verdict}</p>
      <p className={TRY_NOTE}>{t('landingTry.axle.source')}</p>
      <HowComputed entries={how} subject={t('landingTry.axle.howSubject')} className="-my-2" />
    </>
  )
}

/**
 * Tab "Tải trục" của "Thử với hàng của bạn": hai thanh kéo — khối lượng hàng (kg, tới tải trọng xe) và vị trí trọng tâm hàng dọc thùng
 * (cm từ vách trước) — trên xe mẫu đã khai hai trục; bên cạnh là xe nhìn ngang có khối hàng và dấu trọng tâm chạy theo, rồi tải nhóm trục
 * trước / sau so giới hạn. Mọi số là kết quả `axleLoadsOf` của ứng dụng trên đúng hai giá trị đang kéo (`try-axle.ts`); không gọi bộ tối
 * ưu, không máy chủ. Từ 1.280 px thanh kéo trái, kết quả phải; hẹp hơn xếp chồng.
 */
export function TryAxleTab() {
  const t = useT()
  const format = useFormat()
  const vehicle = axleSampleVehicle()
  const ranges = useMemo(() => axleRanges(vehicle), [vehicle])
  const [massKg, setMassKg] = useState(ranges.massKg.initial)
  const [centerXCm, setCenterXCm] = useState(ranges.centerXCm.initial)
  const result = useMemo(() => axleTry(vehicle, massKg, centerXCm), [vehicle, massKg, centerXCm])
  // Xe mẫu của seed luôn đủ trục và giới hạn; thiếu thì không có số nào để hiện
  if (!result) return null
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
      <Card className="flex flex-col gap-5 p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <h3 className={TRY_LEGEND}>{t('landingTry.axle.title')}</h3>
          <p className={TRY_NOTE}>
            {t('landingTry.axle.vehicle', {
              length: format.length(vehicle.innerLengthCm), payload: format.weight(vehicle.maxPayloadKg),
              frontAxle: format.length(Math.abs(result.front.positionXCm)), rearAxle: format.length(result.rear.positionXCm),
            })}
          </p>
        </div>
        <AxleSlider label={t('landingTry.axle.mass')} range={ranges.massKg} value={massKg} text={format.weight(massKg)} onChange={setMassKg} />
        <AxleSlider
          label={t('landingTry.axle.center')}
          hint={t('landingTry.axle.centerHint')}
          range={ranges.centerXCm}
          value={centerXCm}
          text={format.length(centerXCm)}
          onChange={setCenterXCm}
        />
      </Card>
      <Card className="flex flex-col gap-4 p-4 sm:p-5">
        <h3 className={TRY_LEGEND}>{t('landingTry.axle.resultTitle')}</h3>
        <TryAxleTruck vehicle={vehicle} result={result} className="mx-auto max-w-xl" />
        <AxleOutcome result={result} />
      </Card>
    </div>
  )
}
