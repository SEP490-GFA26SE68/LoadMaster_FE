import { ContactSection } from './ContactSection'
import { LandingFacts } from './LandingFacts'
import { LandingFeatures } from './LandingFeatures'
import { LandingHero } from './LandingHero'
import { LandingPlans } from './LandingPlans'
import { LandingSteps } from './LandingSteps'
import { PublicPage } from './PublicPage'
import { RevealProvider } from './reveal'
import { StatementBand } from './StatementBand'
import './sections.css'

/**
 * Trang giới thiệu công khai `/gioi-thieu` — nơi khách chưa đăng nhập tới khi mở `/`. Khối tối mở đầu (tiêu đề, khung 3D của chuyến mẫu, dải số
 * liệu kiểm được), tính năng chính, dải nguyên tắc xếp hàng, cách hoạt động, gói cước, rồi dải liên hệ (`#lien-he`); không đăng ký, không mua
 * gói, không tên hay lời khen của khách hàng — số nào cũng có nguồn. Chữ và khối hiện ra một lần khi cuộn tới (`RevealProvider`); đầu trang có
 * vạch tiến độ cuộn.
 */
export function LandingPage() {
  return (
    <PublicPage progress>
      <RevealProvider>
        {/* Khối tối liền một dải: phần mở đầu, khung 3D và dải số liệu */}
        <div className="landing-cinema">
          <LandingHero />
          <LandingFacts />
        </div>
        <LandingFeatures />
        <StatementBand />
        <LandingSteps />
        <LandingPlans />
        <ContactSection />
      </RevealProvider>
    </PublicPage>
  )
}
