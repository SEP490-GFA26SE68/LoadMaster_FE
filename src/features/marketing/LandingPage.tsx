import { ContactSection } from './ContactSection'
import { LandingHero } from './LandingHero'
import { LandingPlans } from './LandingPlans'
import { LandingProblems } from './LandingProblems'
import { LandingJourney } from './journey/LandingJourney'
import { PublicPage } from './PublicPage'
import { RevealProvider } from './reveal'
import { LandingTry } from './try/LandingTry'
import './sections.css'

/**
 * Trang giới thiệu công khai `/gioi-thieu` — nơi khách chưa đăng nhập tới khi mở `/`. Khối tối mở đầu (tiêu đề, khung 3D của chuyến mẫu,
 * ba chuyện quen thuộc của một chuyến hàng), "Một chuyến hàng trên LoadMaster" (`#cach-hoat-dong`, năm chặng cạnh thùng xe dính theo
 * cuộn), "Thử với hàng của bạn" (`#thu-ngay`, ba phương án tính trên trình duyệt với xe và kiện khách nhập), gói cước, rồi dải liên hệ
 * (`#lien-he`); không tên hay lời khen của khách hàng — số nào cũng có câu nguồn, không nhãn MOCK
 * RESULT. `RevealProvider` bọc cả trang (kể cả chân trang): chữ và thẻ hiện ra **một lần** khi cuộn tới; không có `IntersectionObserver`
 * hoặc người xem chọn giảm chuyển động thì mọi thứ đứng sẵn, DOM như không có hệ chuyển động. `progress` bật vạch tiến độ cuộn của đầu
 * trang.
 */
export function LandingPage() {
  return (
    <RevealProvider>
      <PublicPage progress>
        {/* Khối tối liền một dải: phần mở đầu, khung 3D và ba chuyện quen thuộc */}
        <div className="landing-cinema">
          <LandingHero />
          <LandingProblems />
        </div>
        <LandingJourney />
        <LandingTry />
        <LandingPlans />
        <ContactSection />
      </PublicPage>
    </RevealProvider>
  )
}
