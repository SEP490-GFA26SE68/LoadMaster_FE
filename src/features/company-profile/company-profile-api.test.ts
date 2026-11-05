import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { COMPANY_PROFILE_SOURCE, fetchCompanyProfile, saveCompanyProfile } from './company-profile-api'

/**
 * Thông tin công ty khi chưa nối backend: màn đọc và ghi công ty **của phiên** trong kho mẫu, không gọi mạng. Kho dùng chung của file,
 * test chạy theo thứ tự.
 */

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('Chưa nối backend thì không được gọi mạng')
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

test('without the backend the screen reads the company of the session from the mock store', async () => {
  expect(COMPANY_PROFILE_SOURCE).toBe('mock')
  const db = getMockDb()
  db.restoreSession('US-LB-01')
  expect(await fetchCompanyProfile()).toMatchObject({
    source: 'mock',
    company: { id: 'LOG-001', name: 'Công ty TNHH Vận tải Long Bình', phone: '0251 383 6120', depot: { name: 'Kho Long Bình' } },
  })
  db.restoreSession('US-PN-01')
  expect(await fetchCompanyProfile()).toMatchObject({ source: 'mock', company: { id: 'LOG-002', name: 'Công ty CP Giao nhận Phương Nam' } })
})

test('saving writes name, address and phone of the session company, trimmed, and the next read sees it', async () => {
  const db = getMockDb()
  db.restoreSession('US-PN-01')
  const saved = await saveCompanyProfile({
    source: 'mock',
    name: '  QA Giao nhận Phương Nam ',
    address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh',
    phone: ' 028 3773 9054 ',
  })
  expect(saved).toMatchObject({
    source: 'mock',
    company: { id: 'LOG-002', name: 'QA Giao nhận Phương Nam', address: '102 Nguyễn Văn Quỳ, P. Phú Thuận, Q.7, TP. Hồ Chí Minh', phone: '028 3773 9054' },
  })
  expect((await fetchCompanyProfile()).company.name).toBe('QA Giao nhận Phương Nam')
  // Công ty khác không đổi
  db.restoreSession('US-LB-01')
  expect((await fetchCompanyProfile()).company.name).toBe('Công ty TNHH Vận tải Long Bình')
})

test('the store refuses a company manager: only the company administrator edits company details', async () => {
  const db = getMockDb()
  db.restoreSession('US-0002')
  await expect(saveCompanyProfile({ source: 'mock', name: 'QA Long Bình', address: 'Biên Hoà', phone: '0251 383 6120' })).rejects.toMatchObject({ code: 'ROLE_NOT_ALLOWED' })
})
