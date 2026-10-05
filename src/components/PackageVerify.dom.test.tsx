import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { PackageVerify, type VerifyCandidate, type VerifyOutcome } from './PackageVerify'

/**
 * Hộp đối chiếu kiện ba mức (FE-6-03, D-83). jsdom không có BarcodeDetector: hộp mở thẳng ở mức 2, như trên trình duyệt không quét
 * được bằng camera. Hộp chỉ gửi mã / kiện đã chọn cho nơi gọi — kiện nào đúng là việc của kho (`verify.test.ts`).
 */
const CANDIDATES: readonly VerifyCandidate[] = [
  { packageInstanceId: 'PKG-002-01', name: 'Tủ lạnh Aqua 186 L', description: 'Dỡ thứ 1', reprintHref: '/kien-hang/nhan?kien=PK-T00012&tu=kho&phien=TRIP-011' },
  { packageInstanceId: 'PKG-002-02', name: 'Máy giặt Toshiba 9 kg', description: 'Dỡ thứ 2' },
]

function renderVerify(props: { candidates?: readonly VerifyCandidate[]; result?: VerifyOutcome | null; pending?: boolean } = {}) {
  const onVerify = vi.fn()
  const onManual = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <I18nProvider>
      <MemoryRouter>
        <PackageVerify
          open
          onOpenChange={onOpenChange}
          title="Đối chiếu kiện dỡ tại điểm 1"
          description="Quét nhãn QR của từng kiện khi đưa xuống xe, hoặc gõ mã in trên nhãn."
          onVerify={onVerify}
          onManual={onManual}
          candidates={CANDIDATES}
          {...props}
        />
      </MemoryRouter>
    </I18nProvider>,
  )
  const dialog = within(screen.getByRole('dialog', { name: 'Đối chiếu kiện dỡ tại điểm 1' }))
  return { onVerify, onManual, onOpenChange, dialog }
}

test('three levels as tabs with 56 px targets; without a camera the dialog opens on the typed code with focus in its field', async () => {
  const { dialog } = renderVerify()
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription('Quét nhãn QR của từng kiện khi đưa xuống xe, hoặc gõ mã in trên nhãn.')
  const tabs = within(dialog.getByRole('tablist', { name: 'Cách đối chiếu' })).getAllByRole('tab')
  expect(tabs.map((tab) => [tab.textContent, tab.getAttribute('aria-selected')])).toStrictEqual([['Quét QR', 'false'], ['Gõ mã', 'true'], ['Xác nhận tay', 'false']])
  for (const tab of tabs) expect(tab).toHaveClass('h-14', 'text-body-lg')
  const code = dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' })
  expect(code).toHaveFocus()
  expect(code).toHaveClass('h-14', 'text-body-lg')
  expect(dialog.getByRole('button', { name: 'Đối chiếu mã' })).toHaveClass('h-14')
  expect(dialog.getByRole('button', { name: 'Đóng' })).toHaveClass('h-14')

  // Mức 1 trên máy không quét được: nói rõ lý do, không dựng khung camera
  await userEvent.click(dialog.getByRole('tab', { name: 'Quét QR' }))
  expect(dialog.getByRole('status')).toHaveTextContent('Trình duyệt này không quét được mã QR bằng camera. Hãy gõ mã in dưới hình QR.')
  expect(document.querySelector('video')).toBeNull()
})

test('level 2: a typed code is sent as typed, marked CODE; an empty one is refused in place', async () => {
  const { dialog, onVerify } = renderVerify()
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(await dialog.findByText('Nhập mã trước khi đối chiếu.')).toBeInTheDocument()
  expect(onVerify).not.toHaveBeenCalled()

  // Mã của bên gửi giữ nguyên chữ người dùng gõ (chỉ bỏ khoảng trắng hai đầu): kho mới biết nó có duy nhất trong chuyến hay không
  await userEvent.type(dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }), '  kh-778 ')
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
  expect(onVerify).toHaveBeenCalledExactlyOnceWith({ method: 'CODE', code: 'kh-778' })
})

test('level 1: a detected QR code is sent normalized, marked QR, and not sent again while it stays in the frame', async () => {
  let detect: () => Promise<{ rawValue: string }[]> = () => Promise.resolve([])
  vi.stubGlobal('BarcodeDetector', class {
    detect() {
      return detect()
    }
  })
  const stream = { getTracks: () => [{ stop: vi.fn() }] }
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn(() => Promise.resolve(stream)) } })
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  const readyState = vi.spyOn(HTMLMediaElement.prototype, 'readyState', 'get').mockReturnValue(4)
  try {
    const { dialog, onVerify } = renderVerify()
    // Có camera: hộp mở ở mức 1, con trỏ đứng ở hộp thoại để bàn phím ảo không che khung hình
    expect(dialog.getByRole('tab', { name: 'Quét QR' })).toHaveAttribute('aria-selected', 'true')
    expect(await dialog.findByText('Camera đang quét. Đưa mã QR vào giữa khung hình.')).toHaveAttribute('role', 'status')
    detect = () => Promise.resolve([{ rawValue: 'lm-7k3f-9xq2-m4td' }])
    await vi.waitFor(() => expect(onVerify).toHaveBeenCalledWith({ method: 'QR', code: 'LM-7K3F-9XQ2-M4TD' }), { timeout: 2000 })
    await new Promise((resolve) => setTimeout(resolve, 600))
    expect(onVerify).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'mediaDevices')
    play.mockRestore()
    readyState.mockRestore()
  }
})

test('level 3: pick a package and a reason; "Khác" needs a note; the warehouse can reprint the label of the picked package', async () => {
  const { dialog, onManual } = renderVerify()
  await userEvent.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  expect(dialog.getByText(/^Dùng khi nhãn rách, mất hoặc không đọc được\. Điều phối viên phải duyệt/)).toBeInTheDocument()
  const packages = within(dialog.getByRole('group', { name: 'Kiện' }))
  expect(packages.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent)).toStrictEqual([
    'PKG-002-01Tủ lạnh Aqua 186 L · Dỡ thứ 1', 'PKG-002-02Máy giặt Toshiba 9 kg · Dỡ thứ 2',
  ])
  const reasons = within(dialog.getByRole('group', { name: 'Lý do' })).getAllByRole('radio')
  expect(reasons.map((radio) => radio.closest('label')?.textContent)).toStrictEqual(['Nhãn rách / mất', 'QR không đọc được', 'Khác'])
  for (const option of [...packages.getAllByRole('radio'), ...reasons]) expect(option.closest('label')).toHaveClass('min-h-14')

  // Chưa chọn gì: lỗi tại chỗ, không gửi
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  expect(await dialog.findByText('Chọn kiện cần xác nhận.')).toBeInTheDocument()
  expect(dialog.getByText('Chọn lý do.')).toBeInTheDocument()
  expect(onManual).not.toHaveBeenCalled()

  // Nút in lại nhãn theo kiện đang chọn — chỉ kiện có đường dẫn in (kho)
  expect(dialog.queryByRole('link', { name: /^In lại nhãn/ })).not.toBeInTheDocument()
  await userEvent.click(packages.getByRole('radio', { name: /PKG-002-01/ }))
  expect(dialog.getByRole('link', { name: 'In lại nhãn PKG-002-01' })).toHaveAttribute('href', '/kien-hang/nhan?kien=PK-T00012&tu=kho&phien=TRIP-011')
  await userEvent.click(packages.getByRole('radio', { name: /PKG-002-02/ }))
  expect(dialog.queryByRole('link', { name: /^In lại nhãn/ })).not.toBeInTheDocument()

  await userEvent.click(dialog.getByRole('radio', { name: 'Khác' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  expect(await dialog.findByText('Chọn Khác thì cần ghi chú.')).toBeInTheDocument()
  expect(onManual).not.toHaveBeenCalled()
  await userEvent.type(dialog.getByRole('textbox', { name: 'Ghi chú' }), ' Nhãn dính nước ')
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  expect(onManual).toHaveBeenCalledExactlyOnceWith({ packageInstanceId: 'PKG-002-02', reason: 'OTHER', note: 'Nhãn dính nước' })
})

test('level 3 with a single candidate has it picked; a reason without a note is sent without one', async () => {
  const { dialog, onManual } = renderVerify({ candidates: CANDIDATES.slice(0, 1) })
  await userEvent.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  expect(dialog.getByRole('radio', { name: /PKG-002-01/ })).toBeChecked()
  await userEvent.click(dialog.getByRole('radio', { name: 'Nhãn rách / mất' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  await vi.waitFor(() => expect(onManual).toHaveBeenCalledExactlyOnceWith({ packageInstanceId: 'PKG-002-01', reason: 'LABEL_DAMAGED' }))
})

test('the result is announced: an error as an alert, a recorded package as a status; pending blocks another submit', () => {
  const failed = renderVerify({ result: { tone: 'error', message: 'Mã KH-778 trùng 2 kiện trong chuyến — gõ mã QR in dưới hình QR của kiện.' }, pending: true })
  expect(failed.dialog.getByRole('alert')).toHaveTextContent('Mã KH-778 trùng 2 kiện trong chuyến — gõ mã QR in dưới hình QR của kiện.')
  expect(failed.dialog.getByRole('alert')).toHaveClass('text-body-lg')
  expect(failed.dialog.getByRole('button', { name: /Đối chiếu mã/ })).toBeDisabled()
})

test('a recorded package is a polite status; with nothing left to confirm the manual level says so; Close asks to close', async () => {
  const { dialog, onOpenChange } = renderVerify({ candidates: [], result: { tone: 'success', message: 'Vừa dỡ PKG-002-01 · Tủ lạnh Aqua 186 L.' } })
  expect(dialog.getByRole('status')).toHaveTextContent('Vừa dỡ PKG-002-01 · Tủ lạnh Aqua 186 L.')
  await userEvent.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  expect(dialog.getByText('Không có kiện nào để xác nhận tay ở bước này.')).toBeInTheDocument()
  await userEvent.click(dialog.getByRole('button', { name: 'Đóng' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
