import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { QrScanDialog } from './QrScanDialog'

/**
 * Hộp thoại quét QR (LM-104). jsdom không có BarcodeDetector nên đây đúng là ca trình duyệt không quét được bằng camera:
 * dòng trạng thái nói rõ, con trỏ vào ô nhập tay, nhập tay vẫn đi tiếp được. Danh sách chọn tay không còn (FE-6-03): đối chiếu kiện
 * của một chuyến dùng `PackageVerify`, chọn kiện bằng tay là mức 3 có lý do và chờ duyệt.
 */

function renderDialog(props: { error?: string | null; pending?: boolean } = {}) {
  const onScan = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <I18nProvider>
      <QrScanDialog
        open
        onOpenChange={onOpenChange}
        title="Quét mã kiện"
        description="Quét nhãn trên thùng để ghi kiện đã xếp."
        onScan={onScan}
        {...props}
      />
    </I18nProvider>,
  )
  return { onScan, onOpenChange }
}

test('without camera scanning the status says so and focus lands in the manual entry', async () => {
  renderDialog()
  expect(screen.getByRole('dialog', { name: 'Quét mã kiện' })).toHaveAccessibleDescription('Quét nhãn trên thùng để ghi kiện đã xếp.')
  expect(screen.getByRole('status')).toHaveTextContent('Trình duyệt này không quét được mã QR bằng camera')
  expect(document.querySelector('video')).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Nhập mã' })).toHaveFocus()
})

test('manual entry submits the normalized token', async () => {
  const user = userEvent.setup()
  const { onScan } = renderDialog()
  await user.type(screen.getByRole('textbox', { name: 'Nhập mã' }), '  pkg - 001 ')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  expect(onScan).toHaveBeenCalledExactlyOnceWith('PKG-001')
})

test('an empty manual entry is rejected without calling onScan', async () => {
  const user = userEvent.setup()
  const { onScan } = renderDialog()
  await user.type(screen.getByRole('textbox', { name: 'Nhập mã' }), '   ')
  await user.click(screen.getByRole('button', { name: 'Xác nhận mã' }))
  expect(await screen.findByText('Nhập mã trước khi xác nhận.')).toBeInTheDocument()
  expect(onScan).not.toHaveBeenCalled()
})

test('an error shows as an alert and pending blocks another submit', () => {
  renderDialog({ error: 'Không có kiện PKG-404 trong chuyến này.', pending: true })
  expect(screen.getByRole('alert')).toHaveTextContent('Không có kiện PKG-404 trong chuyến này.')
  // Đang gửi: nút mang spinner (tên truy cập thêm nhãn của spinner) và không bấm được.
  expect(screen.getByRole('button', { name: /Xác nhận mã/ })).toBeDisabled()
})

test('a camera the user refuses falls back to manual entry', async () => {
  const getUserMedia = vi.fn(() => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')))
  vi.stubGlobal('BarcodeDetector', class {
    detect() {
      return Promise.resolve([])
    }
  })
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  try {
    renderDialog()
    expect(await screen.findByText(/Chưa được phép dùng camera/)).toHaveAttribute('role', 'status')
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false })
    expect(document.querySelector('video')).toBeNull()
    expect(screen.getByRole('textbox', { name: 'Nhập mã' })).toHaveFocus()
  } finally {
    vi.unstubAllGlobals()
    Reflect.deleteProperty(navigator, 'mediaDevices')
  }
})

test('the close button asks to close', async () => {
  const user = userEvent.setup()
  const { onOpenChange } = renderDialog()
  await user.click(screen.getByRole('button', { name: 'Đóng' }))
  expect(onOpenChange).toHaveBeenCalledWith(false)
})
