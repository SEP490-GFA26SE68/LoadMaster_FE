import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import { fetchTripLoadPlans } from '@/features/optimization/load-plans-backend-api'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { backendPlanScene } from './backend-plan-scene'
import { SelectedPackagePanel } from './panels/SelectedPackagePanel'
import type { ScenePlacement } from './scene-input'
import { createViewerDraft, patchPlacement, resolveEffectiveScene } from './viewer-draft'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * "Vì sao đặt ở đây" ở thẻ kiện đang chọn của Planner bản máy chủ: lý do theo mã và số đo của dịch vụ tối ưu, đi từ phản hồi
 * `GET /api/trips/{id}/load-plans` qua scene tới thẻ. Kiện đã dời / xoay trong bản chỉnh tay mất mục này; máy chủ không trả thì không có.
 */
const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}
const STOPS = [{ id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: null }, { id: '92', sequence: 2, name: 'Kho Biên Hoà', deadline: null }]
const BOX = { packageId: 301, weightKg: '20', posY: '0', posZ: '0', packedLength: '100', packedWidth: '50', packedHeight: '40', rotationType: 0 }

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function sceneFromServer() {
  stubBackend({
    'GET /api/trips/42/load-plans': { body: envelope({ tripId: 42, approvedPlanId: null, plans: [{
      id: 501, tripId: 42, jobUuid: 'job-1', candidateLabel: 'A', candidateProfile: 'A', approved: false, placements: [
        { ...BOX, id: 11, packageCode: 'PK-301', posX: '0', stepSequence: 1, stopId: 92, stopSequence: 2,
          reasonCodes: ['ZONE_STOP_2', 'BOTTOM_HIGH_CAPACITY', 'NEW_CODE'],
          stackPressureKgM2: '1200', topLoadCapacityKgM2: '800', supportRatio: '0.85', distanceToDoorCm: '300' },
        { ...BOX, id: 12, packageId: 302, packageCode: 'PK-302', posX: '300', stepSequence: 2, stopId: 91, stopSequence: 1,
          reasonCodes: ['HEAVY_LOW'], stackPressureKgM2: '0', topLoadCapacityKgM2: null },
        { ...BOX, id: 13, packageId: 303, packageCode: 'PK-303', posX: '100', stepSequence: 3, stopId: 91, stopSequence: 1 },
      ], unplaced: [],
    }] }) },
  })
  const { plans: [plan] } = await fetchTripLoadPlans('42')
  return backendPlanScene({ tripCode: 'TRIP-42', plan: plan!, vehicle: VEHICLE, stops: STOPS })
}

function renderCard(placement: ScenePlacement | undefined) {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SelectedPackagePanel placement={placement} placements={placement ? [placement] : []} totalSteps={3} stops={[]} tripId="TRIP-42" onFocus={() => undefined} />
      </I18nProvider>
    </MemoryRouter>,
  )
  return within(screen.getByRole('complementary', { name: 'Kiện đang chọn' }))
}

const whySection = (card: ReturnType<typeof renderCard>) => within(card.getByRole('region', { name: 'Vì sao đặt ở đây' }))

test('lý do theo mã thành câu thường, số đo theo ngôn ngữ; mã lạ bị bỏ; tỷ lệ đỡ của máy chủ thay ô "Tỷ lệ đỡ đáy"', async () => {
  const scene = await sceneFromServer()
  const card = renderCard(scene.placementById.get('PK-301'))
  const why = whySection(card)
  expect(why.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Trong vùng của điểm 2',
    'Kiện chịu tải tốt nên đặt dưới cùng',
    'Áp lực đè 1.200 kg/m² · sức chịu 800 kg/m²',
    'Được đỡ 85,0%',
    'Cách cửa 300 cm',
  ])
  expect(card.queryByText('Tỷ lệ đỡ đáy')).not.toBeInTheDocument()
})

test('σ null nói kiện không nhận tải trên mặt; số vắng thì không có dòng', async () => {
  const scene = await sceneFromServer()
  const why = whySection(renderCard(scene.placementById.get('PK-302')))
  expect(why.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Kiện nặng nên đặt thấp',
    'Áp lực đè 0 kg/m² · không nhận tải trên mặt',
  ])
})

test('máy chủ không trả lý do hay số đo: không có mục, ô "Tỷ lệ đỡ đáy" như cũ', async () => {
  const scene = await sceneFromServer()
  const card = renderCard(scene.placementById.get('PK-303'))
  expect(card.queryByText('Vì sao đặt ở đây')).not.toBeInTheDocument()
  expect(card.getByText('Tỷ lệ đỡ đáy')).toBeInTheDocument()
})

test('kiện đã dời hay xoay trong bản chỉnh tay mất mục — lý do là của vị trí cũ; chỉ ghim thì giữ', async () => {
  const scene = await sceneFromServer()
  const source = scene.placementById.get('PK-301')!
  const moved = patchPlacement(scene, createViewerDraft(), 'PK-301', { position: { ...source.position, y: 100 } })
  expect(resolveEffectiveScene(scene, moved).placementById.get('PK-301')).not.toHaveProperty('why')
  const rotated = patchPlacement(scene, createViewerDraft(), 'PK-301', { orientation: 'WLH' })
  expect(resolveEffectiveScene(scene, rotated).placementById.get('PK-301')).not.toHaveProperty('why')
  const pinned = patchPlacement(scene, createViewerDraft(), 'PK-301', { pinned: true })
  expect(resolveEffectiveScene(scene, pinned).placementById.get('PK-301')?.why).toEqual(source.why)

  renderCard(resolveEffectiveScene(scene, moved).placementById.get('PK-301'))
  expect(screen.queryByText('Vì sao đặt ở đây')).not.toBeInTheDocument()
})
