import { useT } from '@/lib/i18n'
import { FooterBottom } from './footer/FooterBottom'
import { FooterBrand } from './footer/FooterBrand'
import { FooterColumns } from './footer/FooterColumns'
import { FooterRoad } from './footer/FooterRoad'
import { Reveal } from './reveal'
import './footer/footer.css'

/**
 * Chân trang của các trang công khai (giới thiệu, bảng giá, chính sách bảo mật): nền tối đặc `--panel-dark` nối liền dải liên hệ phía
 * trên, dải đường có xe tải chạy vào đỗ cạnh ghim điểm giao cuối (chỉ để nhìn), rồi khối thương hiệu và bốn cột liên kết — một cột ở
 * 360 px, hai cột từ 640 px, thương hiệu cạnh bốn cột từ 1.024 px — và hàng cuối (bản quyền, câu nói thật về bản demo, "Lên đầu trang").
 * Liên hệ chỉ lấy từ `SITE_INFO`; không mạng xã hội, logo khách hàng hay số liệu sử dụng: chưa có nguồn nào cho chúng. Trên trang giới
 * thiệu (trong `RevealProvider`) khối thương hiệu và bốn cột là một cổng: câu mô tả đậm dần, tiêu đề cột lên khỏi mặt nạ so le 70 ms — cùng
 * ngôn ngữ chữ chuyển động với các phần phía trên; trang khác và giảm chuyển động: tĩnh.
 */
export function PublicFooter() {
  const t = useT()
  return (
    <footer aria-label={t('landingFooter.label')} data-reveal-tone="dark" className="public-footer flex-none">
      <FooterRoad />
      <div className="flex flex-col gap-12 px-4 pt-8 pb-8 md:px-shell lg:pt-10">
        <Reveal group className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))] lg:gap-x-10">
          <FooterBrand className="sm:col-span-2 lg:col-span-1 lg:pr-6" />
          <FooterColumns />
        </Reveal>
        <FooterBottom />
      </div>
    </footer>
  )
}
