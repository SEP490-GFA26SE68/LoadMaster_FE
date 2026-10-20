import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { LandingFacts } from './LandingFacts'
import { RevealProvider } from './reveal'

/**
 * Dải "Con số kiểm được" của trang giới thiệu (AGENTS mục 1, "Số trên trang giới thiệu"): sáu con số người mua quan tâm, mỗi số một câu
 * nguồn. Giá trị kỳ vọng viết tay (3 mục tiêu, 1 credit, cổng bench 1.000 kiện < 1 giây, 10 luật, 3 cách đối chiếu, 5 vai trò công ty) —
 * đổi hằng số trong code mà quên câu trên trang là test đỏ. jsdom không có IntersectionObserver nên số đứng yên, đọc đúng chuỗi đã format.
 */
const LOCALE_KEY = 'loadmaster.ngon-ngu'

let media: MatchMediaControl | null = null

afterEach(() => {
  cleanup()
  media?.restore()
  media = null
  sessionStorage.clear()
})

function renderFacts(locale: 'vi' | 'en') {
  sessionStorage.setItem(LOCALE_KEY, locale)
  media = installMatchMedia({})
  render(
    <I18nProvider>
      <RevealProvider>
        <LandingFacts />
      </RevealProvider>
    </I18nProvider>,
  )
}

/** Mỗi ô một nhãn (`dt`) và hai định nghĩa: số rồi câu nguồn. */
function readFacts(regionName: string) {
  const facts = within(screen.getByRole('region', { name: regionName }))
  const definitions = facts.getAllByRole('definition').map((definition) => definition.textContent)
  return {
    terms: facts.getAllByRole('term').map((term) => term.textContent),
    values: definitions.filter((_, index) => index % 2 === 0),
    sources: definitions.filter((_, index) => index % 2 === 1),
  }
}

test('six buyer-relevant numbers, each read from code and followed by its source', () => {
  renderFacts('vi')
  const { terms, values, sources } = readFacts('Con số kiểm được')
  expect(terms).toStrictEqual([
    'phương án cho mỗi lần chạy tối ưu',
    'cho một lần chạy tối ưu 3D',
    'để xếp 1.000 kiện thành đủ ba phương án',
    'luật kiểm trước khi nhận hàng dọc đường',
    'cách đối chiếu một kiện',
    'vai trò trong công ty của bạn',
  ])
  expect(values).toStrictEqual(['3', '1 credit', '< 1 giây', '10', '3', '5'])
  expect(sources).toHaveLength(6)
  for (const source of sources) expect(source?.trim()).not.toBe('')
  // Câu nguồn của số vai trò kể đúng năm vai trò của công ty, nối theo ngôn ngữ
  expect(sources[5]).toBe('Quản trị công ty, quản lý công ty, điều phối viên, nhân viên kho và tài xế — mỗi người chỉ thấy việc của mình.')
  // Số đo hiệu năng nói rõ là ngưỡng của bài đo, không phải lời hứa trên mọi máy
  expect(sources[2]).toMatch(/^Ngưỡng của bài đo hiệu năng tự động/)
})

test('the English band reads naturally: plural credits, US list commas, the same numbers', () => {
  renderFacts('en')
  const { terms, values, sources } = readFacts('Numbers you can check')
  expect(terms).toStrictEqual([
    'plans from every optimization run',
    'per 3D optimization run',
    'to place 1,000 packages into all three plans',
    'rules checked before an en-route pickup',
    'ways to verify a package',
    'roles in your company',
  ])
  expect(values).toStrictEqual(['3', '1 credit', '< 1 s', '10', '3', '5'])
  expect(sources[5]).toBe('Company administrator, company manager, dispatcher, warehouse staff, and driver — each sees only their own work.')
})
