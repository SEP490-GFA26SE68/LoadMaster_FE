import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { toast } from 'sonner'
import { expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { signedInAs } from '@/test/signed-in'
import { loadAll, stageAll } from '@/test/trip-flow'
import type { Role } from '@/types/user'
import { ManualConfirmCard } from './ManualConfirmCard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Thẻ "Xác nhận tay chờ duyệt" (FE-6-04) trên kho mock thật. Chuyến hai thùng của `mock-db-samples`: `PKG-001-01` (điểm 3) xếp trước,
 * `PKG-002-01` (điểm 1) dỡ trước. Người gửi: nhân viên kho demo Lê Văn Hải (`US-0003`), tài xế demo Phạm Quốc Dũng (`US-0004`).
 */
const SLOW = { timeout: 8000 }

/**
 * Chuyến hai thùng đã duyệt: `staging` — kho vừa bắt đầu, chưa soạn kiện nào; `loading` — kho đã soạn đủ, đang xếp; `delivering` — kho
 * đã xếp xong, tài xế đã xuất phát và đã đến điểm 1.
 */
async function twoCartons(stage: 'staging' | 'loading' | 'delivering') {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const { id } = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0004' })
  const revision = await db.addRevision({ tripId: id, request: twoCartonRequest(), result: twoCartonResult() })
  await db.approveRevision(revision.id, [])
  db.restoreSession('US-0003')
  await db.startLoading(id)
  if (stage !== 'staging') await stageAll(db, id)
  if (stage === 'delivering') {
    await loadAll(db, id)
    await db.completeLoading(id)
    db.restoreSession('US-0004')
    await db.startDelivery(id)
    await db.arriveAtStop(id, 1)
  }
  return { db, id }
}

function renderCard(tripId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ManualConfirmCard tripId={tripId} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const card = () => within(screen.getByRole('region', { name: 'Xác nhận tay chờ duyệt' }))

test('a trip with nothing waiting shows no card', async () => {
  const { db, id } = await twoCartons('loading')
  renderCard(id)
  // Chờ truy vấn về rồi mới khẳng định không có thẻ
  await waitFor(async () => expect((await db.getTrip(id)).phase).toBe('loading'))
  await new Promise((resolve) => setTimeout(resolve, 700))
  expect(screen.queryByRole('region', { name: 'Xác nhận tay chờ duyệt' })).not.toBeInTheDocument()
})

test('the dispatcher sees the package, who sent it, why and when; rejecting needs a reason and sends the package back', async () => {
  const { db, id } = await twoCartons('loading')
  await db.confirmLoadingManually(id, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED', note: 'Nhãn rách một nửa' })
  const user = renderCard(id)

  const [row] = await screen.findAllByRole('listitem', {}, SLOW)
  expect(card().getByText('1 chờ duyệt')).toBeInTheDocument()
  expect(row).toHaveTextContent('PKG-001-01')
  expect(row).toHaveTextContent('Carton A')
  expect(row).toHaveTextContent('Xếp hàng')
  expect(row).toHaveTextContent(/Lê Văn Hải gửi lúc \d\d:\d\d \d\d\/\d\d/)
  expect(row).toHaveTextContent('Lý do: Nhãn rách / mất — Nhãn rách một nửa')

  await user.click(card().getByRole('button', { name: 'Từ chối xác nhận tay PKG-001-01' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối xác nhận tay PKG-001-01?' }))
  await user.click(dialog.getByRole('button', { name: 'Từ chối xác nhận' }))
  expect(await dialog.findByText('Ghi lý do từ chối.')).toBeInTheDocument()
  expect((await db.getTrip(id)).verifications?.at(-1)?.manual?.status).toBe('MANUAL_PENDING')

  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'Ảnh chụp cho thấy sai kiện')
  await user.click(dialog.getByRole('button', { name: 'Từ chối xác nhận' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Xác nhận tay chờ duyệt' })).not.toBeInTheDocument(), SLOW)
  // Lượt ghi chỉ xong sau khi mọi truy vấn bị vô hiệu đọc lại: thẻ biến mất trước, toast tới sau
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã từ chối xác nhận tay PKG-001-01'), SLOW)
  const stored = await db.getTrip(id)
  expect(stored.verifications?.at(-1)?.manual).toMatchObject({ status: 'MANUAL_REJECTED', rejectReason: 'Ảnh chụp cho thấy sai kiện', decidedBy: 'US-0001' })
  expect(stored.loading?.steps).toStrictEqual([])
}, 30_000)

test('approving keeps the package as verified; a confirmation sent at a stop names the step and the stop', async () => {
  const { db, id } = await twoCartons('delivering')
  await db.confirmUnloadManually(id, 1, { packageInstanceId: 'PKG-002-01', reason: 'QR_UNREADABLE' })
  const user = renderCard(id)

  const [row] = await screen.findAllByRole('listitem', {}, SLOW)
  expect(row).toHaveTextContent('PKG-002-01')
  expect(row).toHaveTextContent('Dỡ hàng · điểm 1')
  expect(row).toHaveTextContent(/Phạm Quốc Dũng gửi lúc/)
  expect(row).toHaveTextContent('Lý do: QR không đọc được')

  await user.click(card().getByRole('button', { name: 'Duyệt xác nhận tay PKG-002-01' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Xác nhận tay chờ duyệt' })).not.toBeInTheDocument(), SLOW)
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã duyệt xác nhận tay PKG-002-01'), SLOW)
  const stored = await db.getTrip(id)
  expect(stored.verifications?.at(-1)?.manual).toMatchObject({ status: 'MANUAL_APPROVED', decidedBy: 'US-0001' })
  expect(stored.delivery?.stops[0]?.unloadedIds).toStrictEqual(['PKG-002-01'])
}, 30_000)

test('a manual confirmation sent while staging names that step; approved, the package becomes staged (FE-6-02)', async () => {
  const { db, id } = await twoCartons('staging')
  await db.confirmStagingManually(id, { packageInstanceId: 'PKG-002-01', reason: 'LABEL_DAMAGED' })
  const poolId = (await db.listTripLabels(id)).find((label) => label.packageInstanceId === 'PKG-002-01')?.poolPackageId ?? ''
  expect((await db.getPackage(poolId)).status).toBe('ASSIGNED')
  const user = renderCard(id)

  const [row] = await screen.findAllByRole('listitem', {}, SLOW)
  expect(row).toHaveTextContent('PKG-002-01')
  expect(row).toHaveTextContent('Soạn hàng')
  await user.click(card().getByRole('button', { name: 'Duyệt xác nhận tay PKG-002-01' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Xác nhận tay chờ duyệt' })).not.toBeInTheDocument(), SLOW)
  expect((await db.getPackage(poolId)).status).toBe('STAGED')
}, 30_000)

test('the company manager reads the list but cannot decide: no buttons, one line saying who can', async () => {
  const { db, id } = await twoCartons('loading')
  await db.confirmLoadingManually(id, { packageInstanceId: 'PKG-001-01', reason: 'OTHER', note: 'Nhãn dính dầu' })
  renderCard(id, 'companyManager')
  expect(await screen.findByText('Lý do: Khác', { exact: false }, SLOW)).toBeInTheDocument()
  expect(card().queryByRole('button')).not.toBeInTheDocument()
  expect(card().getByText('Chỉ điều phối viên duyệt hoặc từ chối được xác nhận tay.')).toBeInTheDocument()
}, 30_000)
