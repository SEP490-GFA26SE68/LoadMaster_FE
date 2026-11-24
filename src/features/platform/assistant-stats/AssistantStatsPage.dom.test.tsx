import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { AssistantStatsPage } from './AssistantStatsPage'

/** Kho mẫu không đếm lượt hỏi nào (D-20): mở thẳng đường dẫn thì về màn chính của vai trò, không vẽ màn rỗng. */
test('without the assistant on the server the screen sends the reader to their home screen', async () => {
  signedInAs('systemManager')
  render(
    <I18nProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={['/nen-tang/tro-ly-lumo']}>
          <Routes>
            <Route path="/nen-tang/tro-ly-lumo" element={<AssistantStatsPage />} />
            <Route path="/nen-tang/goi" element={<p>Màn chính</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    </I18nProvider>,
  )
  expect(await screen.findByText('Màn chính')).toBeInTheDocument()
})
