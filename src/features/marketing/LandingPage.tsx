import { ContactSection } from './ContactSection'
import { LandingFacts } from './LandingFacts'
import { LandingFeatures } from './LandingFeatures'
import { LandingHero } from './LandingHero'
import { LandingSteps } from './LandingSteps'
import { PublicPage } from './PublicPage'

/**
 * Trang giới thiệu công khai `/gioi-thieu` — nơi khách chưa đăng nhập tới khi mở `/`. Phần mở đầu, tính năng chính, cách hoạt động và
 * form liên hệ (`#lien-he`); không đăng ký, không mua gói, không số liệu hay lời khen của khách hàng.
 */
export function LandingPage() {
  return (
    <PublicPage>
      {/* Khối tối liền một dải: phần mở đầu, khung 3D và dải số liệu */}
      <div className="landing-cinema">
        <LandingHero />
        <LandingFacts />
      </div>
      <LandingFeatures />
      <LandingSteps />
      <ContactSection />
    </PublicPage>
  )
}
