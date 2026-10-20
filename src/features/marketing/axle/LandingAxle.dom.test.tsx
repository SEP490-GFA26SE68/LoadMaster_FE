import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LandingAxle } from '../LandingAxle'
import { RevealProvider } from '../reveal'
import { ANNOUNCE_DELAY_MS } from './useDebouncedAnnouncement'

/**
 * Mục tải trục (`#tai-truc`) trên xe mẫu VEHICLE-002 của seed: hai thanh trượt gốc có nhãn, bảng số theo `axleLoadsOf`, vượt giới hạn luôn
 * có chữ, không nhãn MOCK RESULT (trang công khai không mang nhãn này), và vùng `aria-live` chỉ đọc sau khi người xem thôi kéo. Số kỳ vọng lấy từ `axle-demo.test.ts` (đã tính
 * tay theo mô hình đòn bẩy trên trục khai của xe): trọng tâm 360 cm, 9.500 kg — trục trước 5.300 / 6.500 kg, trục sau 9.900 / 10.000 kg;
 * dời tới 370 cm — trục sau vượt 65,22 kg.
 */
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderAxle() {
  render(
    <I18nProvider>
      <RevealProvider>
        <LandingAxle />
      </RevealProvider>
    </I18nProvider>,
  )
  return screen.getByRole('region', { name: 'Tải trục trong giới hạn' })
}

function axleRow(section: HTMLElement, group: 'front' | 'rear'): HTMLElement {
  const row = section.querySelector<HTMLElement>(`[data-axle-row="${group}"]`)
  if (!row) throw new Error(`Không có dòng trục ${group}`)
  return row
}

test('two labelled native sliders start on the seed truck, and the readout says both axles are within limits', () => {
  const section = renderAxle()
  expect(section).toHaveAttribute('id', 'tai-truc')
  const center = within(section).getByRole('slider', { name: 'Trọng tâm hàng, tính từ vách trước' })
  const weight = within(section).getByRole('slider', { name: 'Khối lượng hàng' })
  expect(center).toHaveValue('360')
  expect(center).toHaveAttribute('aria-valuetext', '360 cm từ vách trước')
  expect(weight).toHaveValue('9500')
  expect(weight).toHaveAttribute('aria-valuetext', '9.500 kg')
  expect(axleRow(section, 'front')).toHaveTextContent('5.300 kg / 6.500 kg')
  expect(axleRow(section, 'rear')).toHaveTextContent('9.900 kg / 10.000 kg')
  expect(within(section).getAllByText('Trong giới hạn')).toHaveLength(2)
  expect(within(section).queryByText('MOCK RESULT')).not.toBeInTheDocument()
})

test('moving the centre of mass 10 cm towards the door overloads the rear axle, said in words and marked on the picture', () => {
  const section = renderAxle()
  fireEvent.change(within(section).getByRole('slider', { name: 'Trọng tâm hàng, tính từ vách trước' }), { target: { value: '370' } })
  expect(axleRow(section, 'rear')).toHaveTextContent('Vượt 65,22 kg')
  expect(axleRow(section, 'rear')).toHaveTextContent('10.065,22 kg / 10.000 kg')
  expect(axleRow(section, 'front')).toHaveTextContent('Trong giới hạn')
  const picture = section.querySelector('[data-axle="rear"]')?.closest('[aria-hidden="true"]')
  expect(picture).not.toBeNull()
  expect(section.querySelector('[data-axle="rear"]')).toHaveAttribute('data-over')
  expect(section.querySelector('[data-axle="front"]')).not.toHaveAttribute('data-over')
})

test('a light load pushed against the front wall overloads the front axle instead', () => {
  const section = renderAxle()
  fireEvent.change(within(section).getByRole('slider', { name: 'Trọng tâm hàng, tính từ vách trước' }), { target: { value: '120' } })
  fireEvent.change(within(section).getByRole('slider', { name: 'Khối lượng hàng' }), { target: { value: '5750' } })
  expect(axleRow(section, 'front')).toHaveTextContent('Vượt 450 kg')
  expect(axleRow(section, 'rear')).toHaveTextContent('Trong giới hạn')
})

test('the polite live region stays silent until the viewer acts, then speaks once they stop', () => {
  const section = renderAxle()
  const live = section.querySelector('[aria-live="polite"]')
  expect(live).toHaveTextContent('')
  act(() => {
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS * 2)
  })
  expect(live).toHaveTextContent('')
  const center = within(section).getByRole('slider', { name: 'Trọng tâm hàng, tính từ vách trước' })
  fireEvent.change(center, { target: { value: '365' } })
  fireEvent.change(center, { target: { value: '370' } })
  act(() => {
    vi.advanceTimersByTime(ANNOUNCE_DELAY_MS - 1)
  })
  expect(live).toHaveTextContent('')
  act(() => {
    vi.advanceTimersByTime(1)
  })
  expect(live).toHaveTextContent(
    'Trục trước 5.134,78 kg, trong giới hạn 6.500 kg. Trục sau 10.065,22 kg, vượt giới hạn 10.000 kg là 65,22 kg.',
  )
})
