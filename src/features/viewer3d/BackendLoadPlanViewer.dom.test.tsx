import { render, screen } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { BackendLoadPlanViewer } from './BackendLoadPlanViewer'
import type { ViewerSceneModel } from './scene-input'

window.matchMedia ??= (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: () => {},
  removeEventListener: () => {},
  addListener: () => {},
  removeListener: () => {},
  dispatchEvent: () => false,
})

vi.mock('./scene/SceneCanvas', () => ({
  SceneCanvas: () => <div data-testid="scene-canvas" />,
}))

const mockModel: ViewerSceneModel = {
  tripId: '1',
  vehicle: {
    id: 'v1',
    name: 'Truck 5T',
    innerLengthCm: 600,
    innerWidthCm: 240,
    innerHeightCm: 240,
    maxPayloadKg: 5000,
  },
  placements: [
    {
      id: 'p1',
      packageId: 'pkg1',
      step: 1,
      order: 1,
      x: 0,
      y: 0,
      z: 0,
      width: 50,
      length: 50,
      height: 50,
      weightKg: 20,
    },
    {
      id: 'p2',
      packageId: 'pkg2',
      step: 2,
      order: 2,
      x: 50,
      y: 0,
      z: 0,
      width: 50,
      length: 50,
      height: 50,
      weightKg: 20,
    },
  ],
} as unknown as ViewerSceneModel

beforeEach(() => {
  window.sessionStorage.clear()
})

test('BackendLoadPlanViewer uses localized aria-labels for previous and next step buttons in VI', () => {
  window.sessionStorage.setItem('loadmaster.ngon-ngu', 'vi')
  render(
    <I18nProvider>
      <BackendLoadPlanViewer model={mockModel} />
    </I18nProvider>,
  )

  expect(screen.getByRole('button', { name: 'Bước xếp trước' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Bước xếp kế tiếp' })).toBeInTheDocument()
})

test('BackendLoadPlanViewer uses localized aria-labels for previous and next step buttons in EN', () => {
  window.sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  render(
    <I18nProvider>
      <BackendLoadPlanViewer model={mockModel} />
    </I18nProvider>,
  )

  expect(screen.getByRole('button', { name: 'Previous loading step' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Next loading step' })).toBeInTheDocument()
})
