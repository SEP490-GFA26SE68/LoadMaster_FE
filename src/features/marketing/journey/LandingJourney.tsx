import type { ReactNode } from 'react'
import { ClipboardCheck, Flag, MapPin, Truck, Warehouse, type LucideIcon } from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'
import { useT } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { SectionHeading } from '../SectionHeading'
import { CHAPTERS, type ChapterKey } from './journey-model'
import { JourneyPayslip, JourneyStop } from './JourneyCards'
import { JourneyPlans } from './JourneyPlans'
import { JourneyTruck } from './JourneyTruck'
import { RouteVisual, VerifyVisual } from './JourneyVisuals'
import { useJourneyProgress } from './useJourneyProgress'
import { useJourneySample, type JourneySample } from './useJourneySample'
import './journey.css'

/** Mỗi chặng: vai trò làm chính (tên từ nhánh `roles`) và biểu tượng của mốc trên đường dọc. */
const CHAPTER_SPEC: Readonly<Record<ChapterKey, { role: Role; icon: LucideIcon }>> = {
  plan: { role: 'dispatcher', icon: ClipboardCheck },
  load: { role: 'warehouse', icon: Warehouse },
  road: { role: 'dispatcher', icon: Truck },
  stop: { role: 'driver', icon: MapPin },
  done: { role: 'companyManager', icon: Flag },
}

function chapterVisual(key: ChapterKey, sample: JourneySample): ReactNode {
  switch (key) {
    case 'plan': return <JourneyPlans sample={sample} />
    case 'load': return <VerifyVisual />
    case 'road': return <RouteVisual />
    case 'stop': return <JourneyStop sample={sample} />
    case 'done': return <JourneyPayslip />
  }
}

/**
 * "Một chuyến hàng trên LoadMaster" (`#cach-hoat-dong`): năm chặng của một chuyến — lập chuyến và chọn phương án, soạn và xếp ở kho, trên
 * đường, tại điểm giao, giao xong — mỗi chặng một vai trò, một đoạn chữ và một hình của chính ứng dụng (bảng so ba phương án của lần chạy
 * mẫu, ba cách đối chiếu, sơ đồ tuyến và mức hạn, số của điểm 1, phiếu lương). Cạnh danh sách (trên điện thoại: dải dính dưới đầu trang)
 * là hình thùng xe dính theo cuộn: kiện lên xe ở chặng kho, xuống xe ở chặng điểm giao, chip trạng thái theo chặng đang xem
 * (`useJourneyProgress` ghi thẳng vào DOM). Mốc của chặng đã tới đổi sang cyan. Không có IntersectionObserver hay giảm chuyển động:
 * hình đứng ở trạng thái mặc định hoặc đổi theo từng chặng; chữ không bao giờ bị ẩn chờ cuộn.
 */
export function LandingJourney() {
  const t = useT()
  const progressRef = useJourneyProgress<HTMLElement>()
  const [sampleRef, sample] = useJourneySample<HTMLOListElement>()
  return (
    <section ref={progressRef} id="cach-hoat-dong" aria-labelledby="landing-journey" className="journey scroll-mt-24 px-4 py-12 md:px-shell lg:py-16">
      <SectionHeading id="landing-journey" title={t('landingJourney.title')} lede={t('landingJourney.lede')} />
      <div className="mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        {/* Dải dính: con trực tiếp của khối chứa cả danh sách chặng, nên điện thoại dính suốt năm chặng; từ 1.024 px là cột phải */}
        <div className="sticky top-16 z-10 -mx-4 border-b border-border bg-app px-4 py-3 md:-mx-6 md:px-6 pointer-coarse:top-20 lg:col-start-2 lg:row-start-1 lg:mx-0 lg:self-start lg:border-0 lg:bg-transparent lg:px-0 lg:pt-6 lg:[top:calc(50vh-11rem)]">
          <JourneyTruck className="mx-auto max-w-140 lg:max-w-none" />
        </div>
        <ol ref={sampleRef} aria-label={t('landingJourney.chaptersLabel')} className="m-0 mt-8 list-none p-0 lg:col-start-1 lg:row-start-1 lg:mt-0">
          {CHAPTERS.map((key, index) => {
            const { role, icon: Icon } = CHAPTER_SPEC[key]
            const last = index === CHAPTERS.length - 1
            return (
              <li key={key} data-chapter-index={index}
                className="group relative pb-10 pl-14 last:pb-0 lg:min-h-[40vh] lg:pb-10 lg:last:min-h-0">
                {last ? null : <span aria-hidden className="absolute top-12 bottom-2 left-5 w-px bg-border" />}
                <span aria-hidden className="absolute top-0 left-0 grid size-10 place-items-center rounded-full border border-border bg-bg text-ink-3 transition-colors duration-(--dur-md) ease-standard group-data-[reached]:border-primary group-data-[reached]:bg-primary-bg group-data-[reached]:text-primary">
                  <Icon className="size-5" strokeWidth={1.5} />
                </span>
                <div className="flex min-w-0 flex-col gap-3">
                  <div><RoleBadge role={role} size="md" /></div>
                  <h3 className="m-0 font-display text-h1 font-bold tracking-[-0.01em] text-balance text-ink-strong font-stretch-108%">
                    {t(`landingJourney.chapters.${key}.title`)}
                  </h3>
                  <p className="m-0 max-w-[36em] text-body-lg text-pretty text-ink-2">{t(`landingJourney.chapters.${key}.text`)}</p>
                  <div className="mt-2">{chapterVisual(key, sample)}</div>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
