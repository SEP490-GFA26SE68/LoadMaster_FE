import { ContactSection } from './ContactSection'
import { LandingFacts } from './LandingFacts'
import { LandingFeatures } from './LandingFeatures'
import { LandingHero } from './LandingHero'
import { LandingPlans } from './LandingPlans'
import { LandingSteps } from './LandingSteps'
import { PublicPage } from './PublicPage'

/**
 * Trang giới thiệu công khai `/gioi-thieu` — nơi khách chưa đăng nhập tới khi mở `/`. Khối tối mở đầu (tiêu đề, khung 3D của chuyến mẫu, dải số
 * liệu kiểm được), tính năng chính, cách hoạt động, gói cước, rồi dải liên hệ (`#lien-he`); không đăng ký, không mua gói, không tên hay
 * lời khen của khách hàng — số nào cũng có nguồn.
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
      <LandingPlans />
      <ContactSection />
    </PublicPage>
  )
}
