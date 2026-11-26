import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { BackendRunDialog } from './BackendRunDialog'

test('NO_SOLUTION liệt kê ràng buộc cụ thể, không chỉ câu chung', () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <BackendRunDialog
          open
          onOpenChange={() => undefined}
          jobId="d45ddc29-cc58-3eec-a773-8ae269c956c9"
          job={{
            jobId: 'd45ddc29-cc58-3eec-a773-8ae269c956c9',
            status: 'NO_SOLUTION',
            finished: true,
            packedPlanCount: 0,
            pinnedCount: null,
            computationMs: 3234,
            createdAt: null,
            runAlgorithm: 'EP_DBLF_GA_AI',
            dataWarnings: [],
          }}
          error={null}
          hasPlans
          compareTo="/so-sanh"
          constraintCodes={['AXLE_CONFIG_MISSING']}
        />
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByRole('alert')).toHaveTextContent('Không có phương án hợp lệ')
  expect(screen.getByText(/Loại xe chưa đủ thông số trục/)).toBeInTheDocument()
})
