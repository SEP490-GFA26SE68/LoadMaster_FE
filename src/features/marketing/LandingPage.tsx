import { useT } from '@/lib/i18n'
import { ContactSection } from './ContactSection'
import { LandingAxle } from './LandingAxle'
import { LandingCompare } from './LandingCompare'
import { LandingFacts } from './LandingFacts'
import { LandingFaq } from './LandingFaq'
import { LandingFeatures } from './LandingFeatures'
import { LandingHero } from './LandingHero'
import { LandingPlans } from './LandingPlans'
import { LandingSteps } from './LandingSteps'
import { PublicPage } from './PublicPage'
import { RevealProvider, TextRibbon } from './reveal'
import { StatementBand } from './StatementBand'
import { LandingTry } from './try/LandingTry'
import './sections.css'

/**
 * Năm lợi ích của lưới Tính năng (tiêu đề của ô) và tên tính năng (dòng nhãn của ô), theo thứ tự của lưới. Hàng tên bỏ ô xếp hàng — tên
 * của nó có "3D", dải chữ không mang chữ số — và lấy ô vai trò thay vào.
 */
const BENEFITS = ['loading', 'plans', 'verify', 'route', 'pickup'] as const
const KICKERS = ['plans', 'verify', 'route', 'pickup', 'roles'] as const

/**
 * Dải nhắc lại trước Gói cước: hàng trên là lợi ích (tiêu đề các ô của Tính năng), hàng dưới là tên tính năng, trôi ngược chiều nhau theo
 * cuộn (`TextRibbon` — chỉ chạy khi người xem cuộn, không tự chạy). Chỉ để nhìn (`aria-hidden`): mọi cụm đã có nguyên văn ở phần Tính năng,
 * trình đọc màn hình không phải nghe lại. Không chữ số.
 */
function BenefitRibbon() {
  const t = useT()
  const rows = [
    BENEFITS.map((key) => t(`landing.features.${key}.title`)),
    KICKERS.map((key) => t(`landing.features.${key}.kicker`)),
  ]
  return (
    <div aria-hidden className="border-y border-border bg-bg">
      <TextRibbon
        className="py-6 [--ribbon-bg:var(--bg)] lg:py-8"
        rows={rows}
        label={t('landing.features.title')}
        travel={0.35}
        rowClassNames={[
          'font-display text-section font-bold tracking-[-0.02em] text-ink-strong font-stretch-112%',
          'mt-3 text-h2 font-medium text-primary [--ribbon-mark:var(--primary)]',
        ]}
      />
    </div>
  )
}

/**
 * Trang giới thiệu công khai `/gioi-thieu` — nơi khách chưa đăng nhập tới khi mở `/`. Khối tối mở đầu (tiêu đề, khung 3D của chuyến mẫu, dải số
 * liệu kiểm được), tính năng chính, tải trục, dải nguyên tắc xếp hàng, cách hoạt động, thử với xe của bạn, so với cách làm hiện tại, dải nhắc
 * lại lợi ích, gói cước, hỏi đáp, rồi dải liên hệ (`#lien-he`); không đăng ký, không mua gói, không tên hay lời khen của khách hàng — số nào
 * cũng có nguồn. Đầu trang có vạch tiến độ cuộn.
 *
 * Một ngôn ngữ chuyển động cho cả trang (`RevealProvider` bọc cả khung, kể cả chân trang): chữ hiện ra một lần khi cuộn tới — tiêu đề phần
 * chảy từng chữ theo sóng (`FlowHeading`), tiêu đề thẻ lên khỏi mặt nạ (`LineRise`), đoạn văn đậm dần (`RevealWords ink`); hai dải chữ trôi
 * theo cuộn (`TextRibbon`); ba chiếc xe cùng một kiểu khói (`--n-200`, ba múi, tan dần): xe 3D của phần mở đầu xếp xong rồi rời kho, xe của
 * dải nguyên tắc đóng cửa rồi chạy đi, xe của chân trang chạy vào đỗ. Giảm chuyển động, jsdom: trạng thái cuối, không bản sao nào.
 */
export function LandingPage() {
  return (
    <RevealProvider>
      <PublicPage progress>
        {/* Khối tối liền một dải: phần mở đầu, khung 3D và dải số liệu */}
        <div className="landing-cinema">
          <LandingHero />
          <LandingFacts />
        </div>
        <LandingFeatures />
        <LandingAxle />
        <StatementBand />
        <LandingSteps />
        <LandingTry />
        <LandingCompare />
        <BenefitRibbon />
        <LandingPlans />
        <LandingFaq />
        <ContactSection />
      </PublicPage>
    </RevealProvider>
  )
}
