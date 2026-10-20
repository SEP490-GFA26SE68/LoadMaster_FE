import { useT } from '@/lib/i18n'
import { COMPARE_ANCHOR } from './anchors'
import { CompareFit } from './compare/CompareFit'
import { CompareTable } from './compare/CompareTable'
import { SectionHeading } from './SectionHeading'

/**
 * "So với cách làm hiện tại" (`#so-sanh`): sáu việc của một chuyến hàng, mỗi việc so cách làm bằng bảng tính và ước lượng bằng mắt với điều
 * LoadMaster làm thật (luật ở AGENTS.md; không số nào ngoài số lấy từ code), rồi phù hợp với ai, cần chuẩn bị gì và điều ứng dụng chưa có.
 */
export function LandingCompare() {
  const t = useT()
  return (
    <section id={COMPARE_ANCHOR} aria-labelledby="landing-compare" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-compare" title={t('landingCompare.title')} lede={t('landingCompare.lede')} />
      <div className="mt-10">
        <CompareTable />
      </div>
      <CompareFit />
    </section>
  )
}
