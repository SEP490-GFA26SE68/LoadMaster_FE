import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { TrialRegistrationPage } from '@/features/trial-registration/TrialRegistrationPage'
import { I18nProvider } from '@/lib/i18n'
import { GuestRegistrationPage } from './GuestRegistrationPage'
import { RegistrationSuccessPage } from './RegistrationSuccessPage'

/** Kho mẫu không có hai luồng đăng ký công khai (D-20): ba route chuyển về trang giới thiệu, không vẽ form nào. */
function Landing() {
  const location = useLocation()
  return <p data-testid="landing">{`${location.pathname}${location.search}${location.hash}`}</p>
}

function renderAt(path: string) {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/dang-ky" element={<GuestRegistrationPage />} />
          <Route path="/dang-ky-trai-nghiem" element={<TrialRegistrationPage />} />
          <Route path="/dang-ky-thanh-cong" element={<RegistrationSuccessPage />} />
          <Route path="/gioi-thieu" element={<Landing />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  )
  return screen.getByTestId('landing').textContent
}

test('kho mẫu: /dang-ky chuyển về form liên hệ báo giá, giữ gói đã chọn', () => {
  expect(renderAt('/dang-ky?planId=PLAN-PRO')).toBe('/gioi-thieu?goi=PLAN-PRO&loai=bao-gia#lien-he')
})

test('kho mẫu: /dang-ky-trai-nghiem chuyển về form liên hệ "Đăng ký tài khoản dùng thử"', () => {
  expect(renderAt('/dang-ky-trai-nghiem')).toBe('/gioi-thieu?loai=xem-demo#lien-he')
})

test('kho mẫu: /dang-ky-thanh-cong chuyển về trang giới thiệu', () => {
  expect(renderAt('/dang-ky-thanh-cong?orderCode=TXN-1')).toBe('/gioi-thieu')
})
