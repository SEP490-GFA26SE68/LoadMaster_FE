import { MapPin } from 'lucide-react'
import { useEffect, useRef, type CSSProperties, type RefObject } from 'react'
import { FooterTruck, TRUCK_EXHAUST } from './FooterTruck'

/**
 * Khói của ống xả. Mỗi cụm khói sinh ra ở miệng ống tại `at` giây và đứng yên trên mặt đường trong lúc tan: cụm nằm trong khối của xe nên
 * phải lùi lại đúng quãng xe đi trong 1 giây nó sống — `k` là phần của quãng đường cả chuyến (100vw), tính sẵn theo đường cong chạy của xe
 * (ease-out bậc ba, 3,2 giây): k = e((at + 1) / 3,2) − e(at / 3,2), e(p) = 1 − (1 − p)³. Cụm cuối là lúc xe đã đỗ, máy còn nổ.
 * Cụm cuối tan hết ở giây thứ 4 — mọi chuyển động của dải dừng trước 5 giây, nên không cần nút dừng (WCAG 2.2.2).
 */
const PUFFS: readonly { at: number; k: number }[] = [
  { at: 0.15, k: 0.603 },
  { at: 0.45, k: 0.471 },
  { at: 0.8, k: 0.338 },
  { at: 1.2, k: 0.214 },
  { at: 1.7, k: 0.099 },
  { at: 2.4, k: 0.016 },
  { at: 3, k: 0 },
]

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Xe chạy vào một lần khi dải đường hiện ra: đặt `data-road` thẳng lên phần tử — không qua state của React, đổi ngôn ngữ hay vẽ lại không
 * chạy lại. Không có IntersectionObserver (jsdom, trình duyệt cũ) hoặc người dùng xin giảm chuyển động: không đặt gì, xe đứng đỗ sẵn.
 */
function useDriveIn(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const road = ref.current
    if (!road || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) return
    if (road.dataset.road === 'go') return
    road.dataset.road = 'ready'
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        road.dataset.road = 'go'
        observer.disconnect()
      },
      { threshold: 0.6 },
    )
    observer.observe(road)
    return () => observer.disconnect()
  }, [ref])
}

/**
 * Dải đường ở mép trên chân trang, chỉ để nhìn (`aria-hidden`): xe tải chạy vào dọc vạch kẻ đứt, bánh quay, khói nhả từ ống xả, rồi đỗ
 * cạnh ghim điểm giao cuối — vòng sóng dưới ghim lan ra một lần khi xe tới. Chuyển động là keyframes CSS trên `transform` / `opacity`
 * (`footer.css`), chỉ chạy khi không giảm chuyển động; mọi thứ dừng trước giây thứ 5.
 */
export function FooterRoad() {
  const ref = useRef<HTMLDivElement>(null)
  useDriveIn(ref)
  return (
    <div ref={ref} aria-hidden className="footer-road">
      <div className="footer-road-surface" />
      <svg className="footer-road-dashes" width="100%" height="2" focusable="false">
        <line x1="0" x2="100%" y1="1" y2="1" />
      </svg>
      <div className="footer-road-lane px-4 md:px-shell">
        <div className="relative h-full">
          <span className="footer-pin">
            <span className="footer-pin-ring" />
            <MapPin className="size-full" strokeWidth={1.5} />
          </span>
          <span className="footer-truck">
            <FooterTruck className="block size-full overflow-visible" />
            {PUFFS.map(({ at, k }) => (
              <span
                key={at}
                className="footer-puff"
                style={{ left: TRUCK_EXHAUST.left, top: TRUCK_EXHAUST.top, '--puff-at': `${at}s`, '--puff-k': k } as CSSProperties}
              >
                <span className="footer-puff-cloud" />
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  )
}
