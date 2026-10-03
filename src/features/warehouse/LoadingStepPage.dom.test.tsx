import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip } from '@/test/mock-db-samples'
import { stageAll } from '@/test/trip-flow'
import { LOAD, renderWarehouse } from './warehouse-test-utils'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Phiên của chuyến ở kho `/kho?chuyen=` (LM-086, FE-6-02, FE-6-05): kho dùng chung → `warehouse-api.ts` → hook → màn, không giả lập
 * module nào. Kỳ vọng đọc thẳng từ kho. Test theo thứ tự trên cùng một kho: chuyến chính được bắt đầu, soạn dần, rồi mở lại.
 */
const SEED_TRIP = 'TRIP-2026-0914'
/** Lớp phủ "Đã xếp" 1,2 s + ghi + đọc lại. */
const NEXT = { timeout: 5000 }

async function seedPlanOrder() {
  const plan = await getMockDb().getRevision('REV-002')
  return plan.result.placements.toSorted((a, b) => a.loadingOrder - b.loadingOrder).map((p) => p.packageInstanceId)
}

async function approvedTwoCartonTrip() {
  const db = getMockDb()
  const { trip, revision } = await optimizedTwoCartonTrip(db)
  const approved = await db.approveRevision(revision.id, [])
  return { db, trip, approved }
}

/** Chuyến hai thùng đã duyệt, kho đã bắt đầu và soạn đủ cả hai thùng bằng quét (`VF-001`, `VF-002`): mở màn là bước Xếp. */
async function stagedTwoCartonTrip() {
  const { db, trip, approved } = await approvedTwoCartonTrip()
  await db.startLoading(trip.id)
  await stageAll(db, trip.id)
  return { db, trip, approved }
}

/** Gõ một mã vào hộp đối chiếu đang mở rồi bấm "Đối chiếu mã". */
async function typeCode(value: string) {
  const dialog = screen.getByRole('dialog')
  const input = within(dialog).getByRole('textbox', { name: 'Mã QR hoặc mã bên gửi' })
  await userEvent.clear(input)
  await userEvent.type(input, value)
  await userEvent.click(within(dialog).getByRole('button', { name: 'Đối chiếu mã' }))
}

test('opening an approved trip starts it at the Staging step: every package of the plan is listed, none staged; exit goes back to the list', async () => {
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)

  expect(await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (132)' }, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Đã soạn/)).toHaveTextContent('Đã soạn 0 / 132')
  expect(within(screen.getByRole('list', { name: 'Kiện chưa soạn' })).getAllByRole('listitem')).toHaveLength(132)
  expect(screen.getByText('MOCK RESULT')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Thoát phiên xếp hàng' })).toHaveAttribute('href', '/kho')
  const trip = await getMockDb().getTrip(SEED_TRIP)
  expect([trip.phase, trip.loading?.revisionId, trip.loading?.startedBy, trip.loading?.stagedIds, trip.loading?.steps]).toStrictEqual(['loading', 'REV-002', 'US-0003', [], []])
}, 15_000)

test('staging (FE-6-02): a verified package leaves the list in any order, a re-scan only says it is staged, a foreign code writes nothing; reopening keeps the progress', async () => {
  const order = await seedPlanOrder()
  // Kiện xếp cuối cùng được soạn trước: soạn không cần thứ tự
  const last = order.at(-1) ?? ''
  const view = renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (132)' }, LOAD)

  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const dialog = screen.getByRole('dialog', { name: 'Đối chiếu kiện vào khu chờ' })
  expect(dialog).toHaveTextContent('Đã soạn 0 / 132 kiện.')
  await typeCode(last.toLowerCase())
  expect(await within(dialog).findByText(new RegExp(`^Đã soạn ${last} · `), {}, LOAD)).toBeInTheDocument()
  // Hộp đối chiếu đang mở che phần còn lại của màn với trình đọc màn hình
  expect(await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (131)', hidden: true }, LOAD)).toBeInTheDocument()

  await typeCode(last)
  expect(await within(dialog).findByText(new RegExp(`^Kiện ${last} · .+ đã soạn rồi, không ghi lại\\.$`), {}, LOAD)).toBeInTheDocument()
  await typeCode('LM-0000-0000-0000')
  expect(await within(dialog).findByRole('alert', {}, LOAD)).toHaveTextContent(`Mã LM-0000-0000-0000 không thuộc chuyến ${SEED_TRIP}.`)
  const stored = await getMockDb().getTrip(SEED_TRIP)
  expect([stored.loading?.stagedIds, stored.verifications?.map((entry) => [entry.context, entry.packageInstanceId, entry.method])]).toStrictEqual([[last], [['STAGING', last, 'CODE']]])

  view.unmount()
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (131)' }, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Đã soạn/)).toHaveTextContent('Đã soạn 1 / 132')
}, 20_000)

test('"Báo thiếu" asks first, then flags the package as waiting for the dispatcher; the warehouse keeps staging', async () => {
  const [first] = await seedPlanOrder()
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (131)' }, LOAD)
  const row = () => within(screen.getByRole('list', { name: 'Kiện chưa soạn' })).getAllByRole('listitem')[0] as HTMLElement
  expect(row()).toHaveTextContent(first ?? '')

  await userEvent.click(within(row()).getByRole('button', { name: 'Báo thiếu' }))
  const dialog = screen.getByRole('dialog', { name: `Báo thiếu ${first}?` })
  await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect((await getMockDb().getTrip(SEED_TRIP)).loading?.shortages).toBeUndefined()

  await userEvent.click(within(row()).getByRole('button', { name: 'Báo thiếu' }))
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Báo thiếu' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), LOAD)
  expect(await within(row()).findByText('Đã báo thiếu — chờ điều phối', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Thiếu 1 kiện — chờ điều phối viên quyết. Soạn tiếp các kiện còn lại.')).toHaveAttribute('role', 'status')
  expect(toast.warning).toHaveBeenCalledWith(`Đã báo thiếu ${first}`, { description: 'Điều phối viên được báo. Soạn tiếp các kiện khác.' })
  expect((await getMockDb().getTrip(SEED_TRIP)).loading?.shortages?.map((item) => [item.packageInstanceId, item.by])).toStrictEqual([[first, 'US-0003']])
}, 15_000)

test('two-carton trip: staging both cartons opens the Loading step with the cm measures of step 1; a damaged last package is left out and loading finishes', async () => {
  const { db, trip, approved } = await approvedTwoCartonTrip()
  const first = approved.result.placements.find((placement) => placement.loadingOrder === 1)
  renderWarehouse(`/kho?chuyen=${trip.id}`)

  // Soạn: hộp ở lại sau kiện đầu, tự đóng khi soạn xong kiện cuối — màn sang bước Xếp
  await screen.findByRole('heading', { level: 1, name: 'Kiện chưa soạn (2)' }, LOAD)
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  await typeCode('pkg-002-01')
  expect(await within(screen.getByRole('dialog')).findByText('Đã soạn PKG-002-01 · Carton A.', {}, LOAD)).toBeInTheDocument()
  await typeCode('pkg-001-01')

  const heading = await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  const card = within(heading.closest('div.overflow-y-auto') as HTMLElement)
  expect(screen.getByText(/^Bước/)).toHaveTextContent('Bước 1 / 2')
  // Truck 6m dài 600 cm, Carton A 120 × 60 × 45 cm, 30 kg, hướng LWH, đặt trên sàn tại y = 0, x = 120 — chạm hốc bánh xe OBS-001 (x 0–120)
  expect(first).toMatchObject({ packageInstanceId: 'PKG-001-01', xCm: 120 })
  expect(card.getByText('Cách cửa sau').nextSibling).toHaveTextContent('360 cm')
  expect(card.getByText('Cách vách trước').nextSibling).toHaveTextContent('120 cm')
  expect(card.getByText('Cách vách phải').nextSibling).toHaveTextContent('180 cm')
  expect(card.getByText('Lớp 1 · Cách cửa 360 cm')).toBeInTheDocument()
  expect(card.getByText('Hướng đặt').nextSibling).toHaveTextContent('LWH · Đứng thẳng · cạnh dài dọc thùng')
  expect(card.getByText('30 kg')).toBeInTheDocument()
  expect(card.getByText('120 × 60 × 45 cm')).toBeInTheDocument()
  expect(card.getByRole('img', { name: /^Minh hoạ hướng đặt LWH/ })).toBeInTheDocument()
  expect(card.getByText('Hốc bánh xe OBS-001 · khe 0 cm')).toBeInTheDocument()
  // Mỗi kiện phải đối chiếu: không có nút xác nhận không đối chiếu, không báo thiếu ở bước xếp (FE-6-05)
  expect(screen.queryByRole('button', { name: 'Xác nhận đã xếp' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /thiếu|không có ở kho/i })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  await typeCode('pkg-001-01')
  // Bước 2 (PKG-002-01, x = 240) cách hốc bánh xe 120 cm: không nhắc vật cản
  await screen.findByRole('heading', { level: 1, name: 'PKG-002-01' }, NEXT)
  expect(screen.queryByText('Vật cản gần nhất')).not.toBeInTheDocument()

  // Kiện hỏng: hai thùng nằm cạnh nhau trên sàn, không kiện nào tựa lên PKG-002-01 — bỏ kiện, xếp xong
  await waitFor(() => expect(screen.getByRole('button', { name: 'Kiện hỏng' })).toBeEnabled(), NEXT)
  await userEvent.click(screen.getByRole('button', { name: 'Kiện hỏng' }))
  const dialog = screen.getByRole('dialog', { name: 'Ghi PKG-002-01 là kiện hỏng?' })
  expect(dialog).toHaveTextContent('Trong phương án không kiện nào tựa lên nó: kho xếp tiếp các kiện còn lại.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Ghi kiện hỏng' }))
  expect(await screen.findByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${trip.id}` }, NEXT)).toBeInTheDocument()
  expect(toast.warning).toHaveBeenCalledWith('Đã bỏ lại kiện hỏng PKG-002-01', { description: 'Kiện không lên xe. Xếp tiếp kiện kế tiếp.' })
  expect(screen.getByText('Đã xếp 1 / 2 kiện')).toBeInTheDocument()
  expect(screen.getByText('Xếp xong — chờ xuất phát. Đóng cửa thùng và bàn giao cho tài xế.')).toBeInTheDocument()
  const damaged = screen.getByRole('region', { name: 'Kiện hỏng, bỏ lại kho (1)' })
  expect(within(damaged).getByText('PKG-002-01')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  const stored = await db.getTrip(trip.id)
  expect([stored.phase, stored.loading?.steps.map((step) => [step.packageInstanceId, step.outcome])]).toStrictEqual(['loaded', [['PKG-001-01', 'loaded'], ['PKG-002-01', 'damaged']]])
}, 30_000)

test('verification by label (LM-104, FE-6-03): a wrong package is explained and not recorded; the right ones load; the seal is recorded when finished', async () => {
  const { db, trip } = await stagedTwoCartonTrip()
  const token = Object.fromEntries((await db.listTripLabels(trip.id)).map((label) => [label.packageInstanceId, label.qrToken]))
  renderWarehouse(`/kho?chuyen=${trip.id}`)
  await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)

  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  expect(screen.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' })).toHaveTextContent('Bước này cần kiện PKG-001-01 · Carton A')
  await typeCode(token['PKG-002-01'] ?? '')
  expect(await within(screen.getByRole('dialog')).findByRole('alert', {}, LOAD)).toHaveTextContent(
    'Sai kiện hoặc sai thứ tự: vừa đưa PKG-002-01 (Carton A), bước này cần PKG-001-01 (Carton A). Chưa ghi gì — để kiện này sang bên và đối chiếu đúng kiện.',
  )
  expect((await db.getTrip(trip.id)).loading?.steps).toStrictEqual([])

  await typeCode(token['PKG-001-01'] ?? '')
  expect(await screen.findByText('Đã xếp PKG-001-01', {}, LOAD)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { level: 1, name: 'PKG-002-01' }, NEXT)).toBeInTheDocument()

  // Lớp phủ "Đã xếp" giữ các nút tới khi hết 1,2 giây
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đối chiếu kiện' })).toBeEnabled(), NEXT)
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  // Kiện thêm trong chuyến mang mã của bên gửi bằng mã instance, duy nhất trong chuyến: gõ mã đó cũng đối chiếu được
  await typeCode('pkg-002-01')
  expect(await screen.findByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${trip.id}` }, NEXT)).toBeInTheDocument()
  expect(screen.getByText('Đã đối chiếu bằng nhãn 2 kiện')).toBeInTheDocument()
  // Chưa ghi seal: nút ghi seal là nút chính, lối về danh sách là nút phụ
  await userEvent.click(screen.getByRole('button', { name: 'Ghi số seal' }))
  expect(screen.getByText('Nhập số seal trước khi ghi.')).toBeInTheDocument()
  await userEvent.type(screen.getByRole('textbox', { name: 'Số seal' }), 'SEAL-0915')
  await userEvent.click(screen.getByRole('button', { name: 'Ghi số seal' }))
  expect(await screen.findByText(/^Số seal SEAL-0915 · ghi lúc/, {}, LOAD)).toBeInTheDocument()
  const stored = await db.getTrip(trip.id)
  expect([stored.phase, stored.loading?.seal?.number, stored.loading?.steps.map((step) => step.via)]).toStrictEqual(['loaded', 'SEAL-0915', ['qr', 'qr']])
  // Mỗi lần đối chiếu ghi bước, cách, người: soạn bằng quét, xếp bằng gõ mã, do nhân viên kho demo làm
  expect(stored.verifications?.map((entry) => [entry.context, entry.packageInstanceId, entry.method, entry.by])).toStrictEqual([
    ['STAGING', 'PKG-001-01', 'QR', 'US-0003'], ['STAGING', 'PKG-002-01', 'QR', 'US-0003'],
    ['LOADING', 'PKG-001-01', 'CODE', 'US-0003'], ['LOADING', 'PKG-002-01', 'CODE', 'US-0003'],
  ])
}, 20_000)

test('manual confirmation (FE-6-03, FE-6-04): recorded with a reason, loading cannot finish until the dispatcher decides; a rejection brings the package back', async () => {
  const { db, trip } = await stagedTwoCartonTrip()
  const [label] = await db.listTripLabels(trip.id)
  const view = renderWarehouse(`/kho?chuyen=${trip.id}`)
  await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)

  // Mức 3: kiện của bước hiện tại được chọn sẵn; kho in lại được nhãn của nó và quay về đúng phiên xếp
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const dialog = within(screen.getByRole('dialog', { name: 'Đối chiếu kiện bước 1' }))
  await userEvent.click(dialog.getByRole('tab', { name: 'Xác nhận tay' }))
  expect(dialog.getByRole('radio', { name: /PKG-001-01/ })).toBeChecked()
  expect(await dialog.findByRole('link', { name: 'In lại nhãn PKG-001-01' }, LOAD)).toHaveAttribute('href', `/kien-hang/nhan?kien=${label?.poolPackageId}&tu=kho&phien=${trip.id}`)
  await userEvent.click(dialog.getByRole('radio', { name: 'Nhãn rách / mất' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Gửi xác nhận tay' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'PKG-002-01' }, NEXT)).toBeInTheDocument()
  expect(toast.warning).toHaveBeenCalledWith('Đã ghi xác nhận tay PKG-001-01', { description: 'Chờ điều phối viên duyệt trước khi xong xếp.' })
  expect(screen.getByText('Còn 1 xác nhận tay chờ điều phối viên duyệt.')).toHaveAttribute('role', 'status')

  // Kiện cuối có kết quả, nhưng còn xác nhận tay chờ duyệt: không tự hoàn tất, nút mờ kèm lý do tại chỗ
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đối chiếu kiện' })).toBeEnabled(), NEXT)
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  await typeCode('pkg-002-01')
  expect(await screen.findByText('Chờ điều phối viên duyệt xác nhận tay rồi mới hoàn tất xếp hàng.', {}, LOAD)).toBeInTheDocument()
  const complete = await screen.findByRole('button', { name: 'Hoàn tất xếp hàng' }, NEXT)
  expect(complete).toBeDisabled()
  expect(complete).toHaveAccessibleDescription('Mọi kiện đã có kết quả, nhưng còn 1 xác nhận tay chờ điều phối viên duyệt nên chưa hoàn tất xếp hàng được.')
  expect((await db.getTrip(trip.id)).phase).toBe('loading')
  view.unmount()

  // Điều phối viên từ chối (hai lần soạn là VF-001, VF-002; xác nhận tay là VF-003): kiện quay về bước hiện tại, kèm lý do
  db.restoreSession('US-0001')
  await db.rejectManualConfirmation(trip.id, 'VF-003', 'Ảnh chụp cho thấy sai kiện')
  const rejected = renderWarehouse(`/kho?chuyen=${trip.id}`)
  expect(await screen.findByRole('heading', { level: 1, name: 'PKG-001-01' }, LOAD)).toBeInTheDocument()
  const notice = screen.getByRole('alert')
  expect(notice).toHaveTextContent('Điều phối viên từ chối xác nhận tay kiện PKG-001-01. Kiểm lại kiện này rồi đối chiếu lại.')
  expect(notice).toHaveTextContent('Lý do: Ảnh chụp cho thấy sai kiện')

  // Gửi lại, lần này được duyệt: kho hoàn tất xếp được
  await userEvent.click(screen.getByRole('button', { name: 'Đối chiếu kiện' }))
  const again = within(screen.getByRole('dialog'))
  await userEvent.click(again.getByRole('tab', { name: 'Xác nhận tay' }))
  await userEvent.click(again.getByRole('radio', { name: 'QR không đọc được' }))
  await userEvent.click(again.getByRole('button', { name: 'Gửi xác nhận tay' }))
  expect(await screen.findByRole('button', { name: 'Hoàn tất xếp hàng' }, NEXT)).toBeDisabled()
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  rejected.unmount()
  db.restoreSession('US-0001')
  await db.approveManualConfirmation(trip.id, 'VF-005')

  renderWarehouse(`/kho?chuyen=${trip.id}`)
  const ready = await screen.findByRole('button', { name: 'Hoàn tất xếp hàng' }, LOAD)
  expect(ready).toBeEnabled()
  await userEvent.click(ready)
  expect(await screen.findByRole('heading', { level: 1, name: `Đã xếp xong chuyến ${trip.id}` }, NEXT)).toBeInTheDocument()
  expect((await db.getTrip(trip.id)).phase).toBe('loaded')
}, 40_000)

test('a stale approved plan does not start: the worker waits for the dispatcher to approve again', async () => {
  renderWarehouse('/kho?chuyen=TRIP-013')
  expect(await screen.findByText('Chờ tối ưu và duyệt lại', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(/^Phương án đã duyệt của chuyến TRIP-013 lỗi thời/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đối chiếu kiện' })).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  expect((await getMockDb().getTrip('TRIP-013')).phase).toBe('planning')
})

test('a trip sent back to planning says why: a dropped shortage keeps the staged packages; a damaged package under others means unloading (FE-6-02, FE-6-05)', async () => {
  const db = getMockDb()
  // Chuyến chính: kho đã soạn một kiện và báo thiếu kiện đầu; điều phối viên bỏ kiện đó khỏi chuyến
  const [first] = await seedPlanOrder()
  db.restoreSession('US-0001')
  await db.resolveStagingShortage(SEED_TRIP, first ?? '', 'DROP')
  renderWarehouse(`/kho?chuyen=${SEED_TRIP}`)
  expect(await screen.findByText('Chờ điều phối tối ưu lại', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(`Điều phối viên đã bỏ kiện thiếu khỏi chuyến ${SEED_TRIP}. Kiện đã soạn giữ nguyên ở khu chờ; kho làm tiếp khi phương án mới được duyệt.`)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  expect((await db.getTrip(SEED_TRIP)).phase).toBe('planning')
})

test('no approved plan, a cancelled trip or an unknown trip: say why, with the way back to the list', async () => {
  const db = getMockDb()
  const { trip } = await optimizedTwoCartonTrip(db)
  const view = renderWarehouse(`/kho?chuyen=${trip.id}`)
  expect(await screen.findByText('Chưa có phương án đã duyệt', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(`Chuyến ${trip.id} chưa có phương án đã duyệt. Điều phối viên cần duyệt phương án trước khi kho xếp.`)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về danh sách chuyến' })).toHaveAttribute('href', '/kho')
  view.unmount()

  await db.cancelTrip(trip.id, 'Khách hoãn nhận hàng')
  const cancelled = renderWarehouse(`/kho?chuyen=${trip.id}`)
  expect(await screen.findByText('Chuyến đã huỷ', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText(`Chuyến ${trip.id} đã huỷ: Khách hoãn nhận hàng`)).toBeInTheDocument()
  cancelled.unmount()

  renderWarehouse('/kho?chuyen=TRIP-KHONG-CO')
  expect(await screen.findByText('Không tải được chuyến', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Không tìm thấy TRIP-KHONG-CO.')).toBeInTheDocument()
}, 15_000)

test('a warehouse worker continuing a trip a colleague started resumes at its first package without a result, with the zone of the package; exit goes to the trip list', async () => {
  // TRIP-011 (seed): Đỗ Thị Hạnh đã soạn đủ và xếp 110 / 280 kiện; nhân viên kho demo Lê Văn Hải mở tiếp
  renderWarehouse('/kho?chuyen=TRIP-011')
  expect(await screen.findByText(/^Bước/, {}, LOAD)).toHaveTextContent('Bước 111 / 280')
  expect(screen.getByRole('link', { name: 'Thoát phiên xếp hàng' })).toHaveAttribute('href', '/kho')
  // Kiện của bước 111 nằm ở vùng của điểm giao Lotte Mart Quận 7, một vùng giữa thùng (không sát cửa, không sát vách trước)
  expect(document.querySelector('[data-part="zone"]')).toHaveTextContent('Vùng Lotte Mart Quận 7 — giữa thùng')
})

test('a trip cancelled while it was being loaded tells the warehouse to unload what is on the truck (FE-6-07)', async () => {
  const db = getMockDb()
  // TRIP-011 (seed): kho đã xếp 110 / 280 kiện
  db.restoreSession('US-0001')
  await db.cancelTrip('TRIP-011', 'Xe hỏng máy lạnh')
  renderWarehouse('/kho?chuyen=TRIP-011')
  expect(await screen.findByText('Chuyến đã huỷ', {}, LOAD)).toBeInTheDocument()
  expect(screen.getByText('Chuyến TRIP-011 đã huỷ: Xe hỏng máy lạnh Dỡ 110 kiện đã xếp khỏi xe.')).toBeInTheDocument()
})
