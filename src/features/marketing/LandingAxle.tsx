import { Info } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { roundKg } from '@/domain/geometry'
import { useFormat, useT } from '@/lib/i18n'
import { AXLE_ANCHOR } from './anchors'
import { axleDemo, centerRange, demoTruck, initialState, weightRange, type AxleDemoGroup, type AxleDemoInput } from './axle/axle-demo'
import { AxleControls } from './axle/AxleControls'
import { AxleReadout } from './axle/AxleReadout'
import { AxleTruckFigure } from './axle/AxleTruckFigure'
import { useDebouncedAnnouncement } from './axle/useDebouncedAnnouncement'
import { Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'
import './axle/axle.css'

/** Xe mẫu đọc một lần: dữ liệu thuần của seed, không đổi trong lần mở trang. */
const TRUCK = demoTruck()
const CENTER = centerRange(TRUCK)
const WEIGHT = weightRange(TRUCK)

/** Câu đọc của một trục cho vùng `aria-live`. */
function useAxleSentence() {
  const t = useT()
  const format = useFormat()
  return (load: AxleDemoGroup) => {
    const values = {
      group: t(`landingAxle.readout.groups.${load.group}`),
      load: format.weight(roundKg(load.loadKg)),
      limit: format.weight(load.limitKg),
    }
    return load.overKg === null
      ? t('landingAxle.announce.within', values)
      : t('landingAxle.announce.over', { ...values, over: format.weight(load.overKg) })
  }
}

/**
 * "Tải trục trong giới hạn" (`#tai-truc`): người xem dời khối hàng trong thùng một xe mẫu của seed bằng hai thanh trượt gốc (trọng tâm,
 * khối lượng) và thấy tải trục trước / sau đổi theo — số của `axleLoadsOf` (mô hình đòn bẩy của domain, cùng phép tính chặn Duyệt trong
 * Planner) trên trục khai của xe, kèm MOCK RESULT và câu nguồn: vị trí và giới hạn trục là số ước lượng theo cỡ xe. Hình xe nhìn ngang vẽ
 * đúng chỗ hai trục; vượt giới hạn luôn có chữ. Trình đọc màn hình nghe kết quả qua vùng `aria-live` lịch sự sau khi người xem thôi kéo.
 * Cuộn tới thì thẻ nhô lên và khối hàng vào thùng qua cửa sau một lần; thao tác chỉ đổi `transform`.
 */
export function LandingAxle() {
  const t = useT()
  const format = useFormat()
  const sentence = useAxleSentence()
  const [input, setInput] = useState<AxleDemoInput>(() => initialState(TRUCK))
  const [touched, setTouched] = useState(false)
  const result = axleDemo(TRUCK, input)
  const announcement = useDebouncedAnnouncement(`${sentence(result.front)} ${sentence(result.rear)}`, touched)

  const handleCenter = (centerXCm: number) => {
    setTouched(true)
    setInput((current) => ({ ...current, centerXCm }))
  }
  const handleWeight = (totalKg: number) => {
    setTouched(true)
    setInput((current) => ({ ...current, totalKg }))
  }
  const source = t('landingAxle.source', {
    dimensions: format.dimensions(TRUCK.innerLengthCm, TRUCK.innerWidthCm, TRUCK.innerHeightCm),
    payload: format.weight(TRUCK.maxPayloadKg),
    front: format.length(Math.abs(result.front.positionXCm)),
    rear: format.length(result.rear.positionXCm),
  })

  return (
    <section id={AXLE_ANCHOR} aria-labelledby="landing-axle" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-axle" title={t('landingAxle.title')} lede={t('landingAxle.lede')} />
      <Reveal className="mt-10">
        <Card className="grid min-w-0 overflow-hidden lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6 p-5 sm:p-7">
            <AxleTruckFigure truck={TRUCK} centerXCm={input.centerXCm} totalKg={input.totalKg} result={result} />
            <AxleControls centerXCm={input.centerXCm} totalKg={input.totalKg} center={CENTER} weight={WEIGHT}
              onCenter={handleCenter} onWeight={handleWeight} />
          </div>
          <div className="flex min-w-0 flex-col gap-6 border-t border-line-soft bg-surface p-5 sm:p-7 lg:border-t-0 lg:border-l">
            <AxleReadout result={result} />
            <div className="mt-auto flex flex-col gap-3 border-t border-line-soft pt-5 text-body text-pretty text-ink-2 pointer-coarse:text-body-lg">
              <p className="m-0">{t('landingAxle.model')}</p>
              <p className="m-0 flex gap-2.5 text-ink-3">
                <Info aria-hidden className="mt-0.5 size-4 flex-none" strokeWidth={1.5} />
                <span>{source}</span>
              </p>
            </div>
          </div>
        </Card>
      </Reveal>
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
    </section>
  )
}
