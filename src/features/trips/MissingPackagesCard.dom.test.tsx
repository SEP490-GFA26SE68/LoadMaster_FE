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
import type { Role } from '@/types/user'
import { MissingPackagesCard } from './MissingPackagesCard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/**
 * Thẻ "Kiện kho báo thiếu" (FE-6-02, D-82) trên kho mock thật. Chuyến hai thùng của `mock-db-samples`; nhân viên kho demo Lê Văn Hải
 * (`US-0003`) soạn `PKG-002-01` và báo thiếu `PKG-001-01`.
 */
const SLOW = { timeout: 8000 }

async function shortageTrip() {
  const db = getMockDb()
  db.restoreSession('US-0001')
  const { id } = await db.createTrip(twoCartonTrip())
  const revision = await db.addRevision({ tripId: id, request: twoCartonRequest(), result: twoCartonResult() })
  await db.approveRevision(revision.id, [])
  db.restoreSession('US-0003')
  await db.startLoading(id)
  const labels = await db.listTripLabels(id)
  await db.confirmStagingByQr(id, labels.find((label) => label.packageInstanceId === 'PKG-002-01')?.qrToken ?? '')
  await db.reportStagingShortage(id, 'PKG-001-01')
  const poolId = (packageInstanceId: string) => labels.find((label) => label.packageInstanceId === packageInstanceId)?.poolPackageId ?? ''
  return { db, id, poolId }
}

function renderCard(tripId: string, role: Role = 'dispatcher') {
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MissingPackagesCard tripId={tripId} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const card = () => within(screen.getByRole('region', { name: 'Kiện kho báo thiếu' }))

test('"Tìm tiếp" closes the report: the trip stays at the warehouse and the package can still be staged', async () => {
  const { db, id } = await shortageTrip()
  const user = renderCard(id)

  const [row] = await screen.findAllByRole('listitem', {}, SLOW)
  expect(card().getByText('1 chờ quyết')).toBeInTheDocument()
  expect(row).toHaveTextContent('PKG-001-01')
  expect(row).toHaveTextContent('Carton A')
  expect(row).toHaveTextContent('Điểm 3')
  expect(row).toHaveTextContent(/Lê Văn Hải báo lúc \d\d:\d\d \d\d\/\d\d/)

  await user.click(card().getByRole('button', { name: 'Tìm tiếp kiện PKG-001-01' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Kiện kho báo thiếu' })).not.toBeInTheDocument(), SLOW)
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Kho tìm tiếp kiện PKG-001-01'), SLOW)
  const stored = await db.getTrip(id)
  expect([stored.phase, stored.loading?.shortages, stored.loading?.stagedIds]).toStrictEqual(['loading', undefined, ['PKG-002-01']])
}, 30_000)

test('"Bỏ kiện khỏi chuyến" asks first, then flags the package and sends the trip back to planning with a stale plan; staged packages stay staged', async () => {
  const { db, id, poolId } = await shortageTrip()
  const user = renderCard(id)
  await screen.findAllByRole('listitem', {}, SLOW)

  await user.click(card().getByRole('button', { name: 'Bỏ kiện PKG-001-01 khỏi chuyến' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Bỏ kiện PKG-001-01 khỏi chuyến?' }))
  expect(screen.getByRole('dialog')).toHaveTextContent('Chuyến quay về Đã lập kế hoạch và phương án lỗi thời')
  await user.click(dialog.getByRole('button', { name: 'Quay lại' }))
  expect((await db.getTrip(id)).phase).toBe('loading')

  await user.click(card().getByRole('button', { name: 'Bỏ kiện PKG-001-01 khỏi chuyến' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bỏ kiện' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Kiện kho báo thiếu' })).not.toBeInTheDocument(), SLOW)
  await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã bỏ kiện PKG-001-01 khỏi chuyến', {
    description: 'Chuyến về Đã lập kế hoạch, phương án lỗi thời: tối ưu lại và duyệt lại để kho làm tiếp.',
  }), SLOW)
  const stored = await db.getTrip(id)
  expect([stored.phase, stored.replan?.reason, stored.packages.map((line) => line.id)]).toStrictEqual(['planning', 'SHORTAGE', ['PKG-002']])
  expect(await db.getPackage(poolId('PKG-001-01'))).toMatchObject({ status: 'IMPORTED', flags: ['NOT_FOUND'] })
  expect((await db.getPackage(poolId('PKG-002-01'))).status).toBe('STAGED')
}, 30_000)

test('the company manager reads the list but cannot decide: no buttons, one line saying who can', async () => {
  const { id } = await shortageTrip()
  renderCard(id, 'manager')
  await screen.findAllByRole('listitem', {}, SLOW)
  expect(card().queryByRole('button')).not.toBeInTheDocument()
  expect(card().getByText('Chỉ điều phối viên quyết được kiện kho báo thiếu.')).toBeInTheDocument()
}, 30_000)
