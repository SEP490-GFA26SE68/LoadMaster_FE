import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import { sendGuestContact, toGuestContact, type ContactOfGuestResponse } from './contact-api'

vi.mock('@/lib/api-client', () => ({
  api: vi.fn(),
}))

describe('contact-api', () => {
  const mockResponse: ContactOfGuestResponse = {
    id: 101,
    fullName: 'Trần Văn Nam',
    email: 'nam.tran@example.com',
    phoneNumber: '0901234567',
    companyName: 'Logistics ABC',
    interestedPlanId: 2,
    interestedPlanName: 'Gói Pro',
    assignedToId: null,
    assignedToName: null,
    message: 'Cần tư vấn thêm về thuật toán xếp hàng',
    requestType: 'DEMO_REQUEST',
    status: 'NEW',
    note: null,
    createdAt: '2026-10-19T10:00:00Z',
    resolvedAt: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps backend ContactOfGuestResponse to frontend GuestContact', () => {
    const contact = toGuestContact(mockResponse)
    expect(contact.id).toBe('101')
    expect(contact.fullName).toBe('Trần Văn Nam')
    expect(contact.email).toBe('nam.tran@example.com')
    expect(contact.phoneNumber).toBe('0901234567')
    expect(contact.companyName).toBe('Logistics ABC')
    expect(contact.interestedPlanId).toBe('2')
    expect(contact.message).toBe('Cần tư vấn thêm về thuật toán xếp hàng')
    expect(contact.requestType).toBe('DEMO_REQUEST')
    expect(contact.status).toBe('NEW')
    expect(contact.createdAt).toBe('2026-10-19T10:00:00Z')
    expect(contact.resolvedAt).toBeUndefined()
  })

  it('calls POST /api/contact-guests with numeric interestedPlanId and trimmed fields', async () => {
    const mockPost = vi.fn().mockResolvedValue(mockResponse)
    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: mockPost,
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })

    const result = await sendGuestContact({
      fullName: '  Trần Văn Nam  ',
      email: '  nam.tran@example.com  ',
      phoneNumber: ' 0901234567 ',
      companyName: ' Logistics ABC ',
      interestedPlanId: '2',
      message: ' Cần tư vấn thêm ',
      requestType: 'DEMO_REQUEST',
    })

    expect(mockPost).toHaveBeenCalledWith('/api/contact-guests', {
      body: {
        fullName: 'Trần Văn Nam',
        email: 'nam.tran@example.com',
        phoneNumber: '0901234567',
        companyName: 'Logistics ABC',
        interestedPlanId: 2,
        message: 'Cần tư vấn thêm',
        requestType: 'DEMO_REQUEST',
      },
    })
    expect(result.id).toBe('101')
  })

  it('sends null interestedPlanId when not provided or empty', async () => {
    const mockPost = vi.fn().mockResolvedValue({
      ...mockResponse,
      interestedPlanId: null,
      interestedPlanName: null,
    })
    vi.mocked(api).mockReturnValue({
      get: vi.fn(),
      post: mockPost,
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })

    await sendGuestContact({
      fullName: 'Nguyễn Văn A',
      email: 'a@example.com',
      requestType: 'INQUIRY',
    })

    expect(mockPost).toHaveBeenCalledWith('/api/contact-guests', {
      body: {
        fullName: 'Nguyễn Văn A',
        email: 'a@example.com',
        phoneNumber: undefined,
        companyName: undefined,
        interestedPlanId: null,
        message: undefined,
        requestType: 'INQUIRY',
      },
    })
  })
})
