import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { unloadStop } from '@/test/trip-flow'
import { LOAD, renderDriver } from './driver-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Tài xế ở điểm nhận hàng dọc đường (FE-7-05) trên `TRIP-009` của tài xế `US-0006`: điều phối viên đã duyệt một yêu cầu hai kiện (điểm giao
 * dùng lại điểm 3 nên thành điểm 4), tài xế xong điểm 2 và tới điểm nhận (điểm 3). Luật của kho (nhận, giao, chặn khi còn xác nhận tay)
 * kiểm ở `pickup-progress.test.ts`; chỗ xếp của kiện nhận trong khung 3D kiểm ở `driver-pickups.test.ts` (jsdom không dựng WebGL). Ở đây
 * kiểm màn nói đúng và nối đúng kho. Hai bài theo thứ tự: bài đầu đưa chuyến sang điểm 4.
 */
const TRIP = 'TRIP-009'
const WRITE = { timeout: 5000 }

async function approvedPickup() {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const request = await db.createPickupRequest(TRIP, {
    pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An', lat: 10.928, lng: 106.712 },
    delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
    packages: [
      { packageCode: 'HG-0601', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' },
      { packageCode: 'HG-0602', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 14.5, handlingClass: 'STANDARD' },
    ],
  })
  const { packages } = await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'Khách quen, xe còn chỗ' })
  db.restoreSession('US-0006')
  await unloadStop(db, TRIP, 2)
  await db.completeStop(TRIP, 2)
  return { db, packages }
}

/** Gõ một mã vào hộp đối chiếu đang mở rồi bấm "Đối chiếu mã". */
async function typeCode(value: string) {
  const dialog = within(screen.getByRole('dialog'))
  await userEvent.type(dialog.getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }), value)
  await userEvent.click(dialog.getByRole('button', { name: 'Đối chiếu mã' }))
}

test('the pickup stop is named in the stop list with its own icon and words, the packages are listed apart from the plan, a package of another stop is refused, and the stop completes once both are checked', async () => {
  const { db, packages } = await approvedPickup()
  const tokens = new Map((await db.listTripLabels(TRIP)).map((label) => [label.packageInstanceId, label.qrToken]))
  const planLabel = (await db.listTripLabels(TRIP)).find((label) => label.deliveryStop === 4 && label.packageInstanceId.startsWith('PKG-'))
  const { container } = renderDriver(`/tai-xe/diem-giao?chuyen=${TRIP}`, 'US-0006')
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 3 / 4' }, LOAD)).toBeInTheDocument()

  // Danh sách điểm: điểm nhận có chữ và biểu tượng riêng; điểm giao có chữ khác
  const kinds = [...container.querySelectorAll('[data-stop-kind]')].map((item) => [item.getAttribute('data-stop-kind'), item.textContent])
  expect(kinds.map(([kind]) => kind)).toStrictEqual(['DELIVERY', 'DELIVERY', 'PICKUP', 'DELIVERY'])
  expect(kinds[2]?.[1]).toContain('Điểm nhận hàng')
  expect(kinds[3]?.[1]).toContain('Điểm giao hàng')
  expect(screen.getByText('Điểm nhận hàng dọc đường: nhận 2 kiện từ Xưởng may Hoàng Gia. Đối chiếu từng kiện lên xe rồi mới hoàn tất điểm nhận.')).toBeInTheDocument()

  // Kiện nhận ở danh sách riêng, không có thứ tự dỡ, vùng hay lớp; chỗ xếp của chúng nằm trong khung 3D
  const list = within(screen.getByRole('region', { name: 'Kiện nhận dọc đường' }))
  expect(list.getAllByRole('listitem').map((row) => row.getAttribute('data-package-id'))).toStrictEqual(packages.map((pkg) => pkg.id))
  expect(list.getAllByText('Chưa nhận')).toHaveLength(2)
  await userEvent.click(await screen.findByRole('button', { name: 'Đã đến điểm 3' }, WRITE))
  const complete = await screen.findByRole('button', { name: 'Hoàn tất điểm nhận' }, WRITE)
  expect(complete).toBeDisabled()
  expect(screen.getByText('Còn 2 kiện chưa đối chiếu')).toBeInTheDocument()

  // Kiện của điểm giao quét ở điểm nhận: nói điểm đúng, không ghi gì
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện nhận' }))
  expect(screen.getByRole('dialog', { name: 'Đối chiếu kiện nhận tại điểm 3' })).toBeInTheDocument()
  await typeCode(planLabel?.qrToken ?? '')
  expect(await screen.findByText(/thuộc điểm 4 · Bếp ăn công nghiệp KCN Sóng Thần, không phải điểm này/, {}, WRITE)).toBeInTheDocument()

  // Đối chiếu bằng mã gõ: hộp ở lại cho kiện kế tiếp, kiện cuối thì hộp tự đóng
  const first = packages[0]!
  await userEvent.clear(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }))
  await typeCode(tokens.get(first.id) ?? '')
  expect(await screen.findByText(`Vừa nhận ${first.id} · HG-0601.`, {}, WRITE)).toBeInTheDocument()
  expect(toast.success).toHaveBeenCalledWith(`Đã nhận ${first.id}`)
  await userEvent.clear(within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' }))
  await typeCode(tokens.get(packages[1]!.id) ?? '')
  await screen.findByText('Mọi kiện của điểm nhận này đã đối chiếu.', {}, WRITE)
  expect(list.getAllByText('Đã nhận · gõ mã')).toHaveLength(2)
  expect((await db.getPackage(first.id)).status).toBe('LOADED')

  await userEvent.click(screen.getByRole('button', { name: 'Hoàn tất điểm nhận' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 4 / 4' }, LOAD)).toBeInTheDocument()
  expect(toast.success).toHaveBeenCalledWith('Đã hoàn tất điểm nhận 3', expect.anything())
  expect((await db.getPackage(first.id)).status).toBe('IN_TRANSIT')
  expect(await db.getPickupRequest(TRIP, 'PKR-002')).toMatchObject({ status: 'LOADED' })
}, 30_000)

test('at the delivery stop the pickup packages come with the stop and are unloaded by the same check, apart from the packages of the plan', async () => {
  const db = getMockDb()
  const request = (await db.listPickupRequests(TRIP)).find((item) => item.status === 'LOADED')
  const tokens = new Map((await db.listTripLabels(TRIP)).map((label) => [label.packageInstanceId, label.qrToken]))
  renderDriver(`/tai-xe/diem-giao?chuyen=${TRIP}`, 'US-0006')
  expect(await screen.findByRole('heading', { level: 1, name: 'Điểm 4 / 4' }, LOAD)).toBeInTheDocument()
  const list = within(screen.getByRole('region', { name: 'Kiện nhận dọc đường' }))
  const ids = request?.packageIds ?? []
  expect(list.getAllByRole('listitem').map((row) => row.getAttribute('data-package-id'))).toStrictEqual(ids)
  expect(list.getAllByText('Chưa dỡ')).toHaveLength(2)
  // Kiện của phương án vẫn nằm ở danh sách riêng của điểm giao, có thứ tự dỡ
  expect(screen.getByRole('list', { name: 'Bếp ăn công nghiệp KCN Sóng Thần' })).toBeInTheDocument()

  await userEvent.click(await screen.findByRole('button', { name: 'Đã đến điểm 4' }, WRITE))
  await userEvent.click(await screen.findByRole('button', { name: 'Đối chiếu kiện dỡ' }, WRITE))
  await typeCode(tokens.get(ids[0] ?? '') ?? '')
  expect(await screen.findByText(`Vừa dỡ ${ids[0]} · HG-0601.`, {}, WRITE)).toBeInTheDocument()
  expect(list.getByText('Đã dỡ · gõ mã')).toBeInTheDocument()
}, 30_000)
