import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { assistantSession } from '@/features/marketing/assistant/assistant-session'
import { PlannerAssistant } from '@/features/marketing/assistant/PlannerAssistant'
import { viewerContext } from '@/features/marketing/assistant/viewer-bridge'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { backendPlanScene } from './backend-plan-scene'
import { SceneHud } from './operations/SceneHud'
import { useOperations } from './operations/useOperations'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePlannerAssistant } from './usePlannerAssistant'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['assistant', 'trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'assistant' || feature === 'trips',
}))

const auth = vi.hoisted(() => ({
  user: { id: 'US-0002', fullName: 'Nguyễn Văn An', email: 'dieuphoi@longbinh.vn', role: 'dispatcher' as const, status: 'active' as const },
  signOut: () => {},
  refreshUser: () => {},
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

/**
 * Trợ lý trong Planner bản máy chủ (kỹ năng hỏi về phương án 3D): nút "Trợ lý AI" ở hàng góc dưới phải khung 3D; câu hỏi gửi kèm chuyến,
 * mã số phương án và kiện đang chọn; lệnh giao diện của câu trả lời vừa về chọn kiện, đổi góc nhìn, bước, chế độ màu, mở danh sách kiện —
 * đúng một lần, và không lần nào khi đang Chỉnh sửa.
 */
const ANSWER = { timeout: 4000 }

const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

const placement = (index: number): LoadPlacement => ({
  id: String(10 + index), packageId: String(300 + index), code: `PK-30${index}`, weightKg: 20, x: index * 100, y: 0, z: 0,
  lengthCm: 100, widthCm: 50, heightCm: 40, rotationType: 0, step: index, pinned: false, stopId: '91', stopSequence: null,
})

const PLAN: LoadPlan = {
  id: '41', tripId: '7', jobId: 'job-1', objective: 'MAX_VOLUME', label: 'A', algorithmName: 'EP_DBLF', runAlgorithm: 'EP_DBLF', computationMs: null,
  name: null, volumePercent: null, payloadPercent: 12.5, approved: false, approvedByName: null, centerOfGravityCm: null,
  frontAxleLoadKg: null, rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false,
  placements: [placement(1), placement(2), placement(3)], unplaced: [], stopZones: null,
}

const STOPS = [{ id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: null }]

function Planner({ editing = false, onOpenPackages = () => {} }: { editing?: boolean; onOpenPackages?: () => void }) {
  const model = useMemo(() => backendPlanScene({ tripCode: 'TRIP-0007', plan: PLAN, vehicle: VEHICLE, stops: STOPS }), [])
  const state = useLoadPlanViewer(model, { initialSelectedId: model.placements[0]?.id })
  const operations = useOperations(state)
  usePlannerAssistant({ tripCode: 'TRIP-0007', planId: PLAN.id, state, operations, editing, onOpenPackages })
  return (
    <>
      <dl>
        <dt>selected</dt><dd data-testid="selected">{state.selectedId}</dd>
        <dt>camera</dt><dd data-testid="camera">{state.cameraPreset}</dd>
        <dt>step</dt><dd data-testid="step">{state.step}</dd>
        <dt>color</dt><dd data-testid="color">{state.colorMode}</dd>
        <dt>list</dt><dd data-testid="list">{state.leftTab}</dd>
      </dl>
      <button type="button" onClick={() => state.setCameraPreset('goc-cheo')}>reset camera</button>
      <SceneHud state={state} operations={operations} onInspect={() => {}} onFocus={() => {}} assistant={<PlannerAssistant />} />
    </>
  )
}

function shell(props: { editing?: boolean; onOpenPackages?: () => void } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-0007/phuong-an']}>
          <Planner {...props} />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>
  )
}

const replyWith = (uiActions: readonly Record<string, unknown>[]) =>
  envelope({ conversationId: 'c-1', reply: 'Kiện PK-303 nằm sát cửa sau.', uiActions, links: [], handoff: { offered: false, ticketCode: null } })

async function ask(question: string) {
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  const panel = within(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER))
  await user.type(panel.getByRole('textbox', { name: 'Câu hỏi của bạn' }), `${question}{Enter}`)
  await panel.findByText('Kiện PK-303 nằm sát cửa sau.', {}, ANSWER)
  return { user, panel }
}

beforeEach(() => {
  assistantSession.reset()
})

afterEach(() => {
  cleanup()
  assistantSession.reset()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

test('the question carries the open plan; the reply selects the package, turns the camera, sets the step and colours', async () => {
  const { calls } = stubBackend({
    'POST /api/assistant/messages': {
      body: replyWith([
        { type: 'selectPackage', packageCode: 'PK-303' },
        { type: 'setCameraPreset', preset: 'tren' },
        { type: 'setStep', step: 2 },
        { type: 'approvePlan' },
        { type: 'setColorMode', mode: 'khoi-luong' },
      ]),
    },
  })
  render(shell())
  expect(screen.getByTestId('selected')).toHaveTextContent('PK-301')

  await ask('Kiện PK-303 ở đâu?')

  expect((calls[0] as FakeCall).body).toMatchObject({ viewer: { tripCode: 'TRIP-0007', loadPlanId: 41, selectedPackageCode: 'PK-301' } })
  expect(screen.getByTestId('selected')).toHaveTextContent('PK-303')
  expect(screen.getByTestId('camera')).toHaveTextContent('tren')
  expect(screen.getByTestId('step')).toHaveTextContent('2')
  expect(screen.getByTestId('color')).toHaveTextContent('khoi-luong')
})

test('commands run once, when the reply arrives — not again when the chat is closed and reopened', async () => {
  stubBackend({ 'POST /api/assistant/messages': { body: replyWith([{ type: 'setCameraPreset', preset: 'tren' }]) } })
  render(shell())
  const { user } = await ask('Nhìn từ trên xuống')
  expect(screen.getByTestId('camera')).toHaveTextContent('tren')

  await user.click(screen.getByRole('button', { name: 'reset camera' }))
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  await user.click(screen.getByRole('button', { name: 'Trợ lý AI' }))
  expect(await screen.findByRole('dialog', { name: 'Lumo' }, ANSWER)).toBeInTheDocument()
  expect(screen.getByTestId('camera')).toHaveTextContent('goc-cheo')
})

test('while editing, the reply is shown but its commands are dropped', async () => {
  stubBackend({ 'POST /api/assistant/messages': { body: replyWith([{ type: 'selectPackage', packageCode: 'PK-303' }, { type: 'setCameraPreset', preset: 'tren' }]) } })
  render(shell({ editing: true }))

  await ask('Kiện PK-303 ở đâu?')

  expect(screen.getByTestId('selected')).toHaveTextContent('PK-301')
  expect(screen.getByTestId('camera')).toHaveTextContent('goc-cheo')
})

test('"open the list" opens the package list of the details box at the asked section', async () => {
  stubBackend({ 'POST /api/assistant/messages': { body: replyWith([{ type: 'openTab', tab: 'placed' }]) } })
  const onOpenPackages = vi.fn()
  render(shell({ onOpenPackages }))

  await ask('Mở danh sách kiện đã xếp')

  expect(onOpenPackages).toHaveBeenCalledTimes(1)
  expect(screen.getByTestId('list')).toHaveTextContent('placed')
})

test('leaving the Planner unregisters it: questions no longer carry a plan', () => {
  const { unmount } = render(shell())
  expect(viewerContext()).toStrictEqual({ tripCode: 'TRIP-0007', loadPlanId: 41, selectedPackageCode: 'PK-301' })
  unmount()
  expect(viewerContext()).toBeNull()
})
