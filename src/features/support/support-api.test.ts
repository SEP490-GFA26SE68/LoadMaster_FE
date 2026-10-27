import { afterEach, expect, test, vi } from 'vitest'
import * as authApi from '@/features/auth/auth-api'
import * as apiClient from '@/lib/api-client'
import {
  assignCompanyPlan,
  createSupportTicket,
  getSupportCompanyPanel,
  listSupportTickets,
  replyToSupportTicket,
  setSupportTicketStatus,
} from './support-api'

afterEach(() => {
  vi.restoreAllMocks()
})

test('when authenticated with Keycloak, support-api calls Backend /api/support-tickets and /api/contracts endpoints', async () => {
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const apiFetchSpy = vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/support-tickets' && (!init || !init.method || init.method === 'GET')) {
      return {
        success: true,
        data: [
          {
            id: 10,
            ticketCode: 'TCK-20261019-1111',
            subject: 'Cần nâng cấp lên gói Pro',
            description: 'Công ty muốn nâng cấp từ Basic lên Pro.',
            category: 'BILLING',
            priority: 'MEDIUM',
            status: 'OPEN',
            requesterId: 5,
            requesterName: 'Tran Quan Tri Acme',
            requesterEmail: 'newadmin.acme@loadmaster.vn',
            companyId: 1,
            companyName: 'Acme Logistics',
            assignedToId: null,
            assignedToName: null,
            resolutionNote: null,
            createdAt: '2026-10-19T18:00:00',
            resolvedAt: null,
          },
        ],
      } as unknown as never
    }
    if (path === '/api/support-tickets' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { subject: string; description: string; category: string }
      return {
        success: true,
        data: {
          id: 11,
          ticketCode: 'TCK-20261019-2222',
          subject: body.subject,
          description: body.description,
          category: body.category,
          priority: 'MEDIUM',
          status: 'OPEN',
          requesterId: 5,
          requesterName: 'Tran Quan Tri Acme',
          requesterEmail: 'newadmin.acme@loadmaster.vn',
          companyId: 1,
          companyName: 'Acme Logistics',
          assignedToId: null,
          assignedToName: null,
          resolutionNote: null,
          createdAt: '2026-10-19T18:05:00',
          resolvedAt: null,
        },
      } as unknown as never
    }
    if (path === '/api/support-tickets/10' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { status?: string; resolutionNote?: string }
      return {
        success: true,
        data: {
          id: 10,
          ticketCode: 'TCK-20261019-1111',
          subject: 'Cần nâng cấp lên gói Pro',
          description: 'Công ty muốn nâng cấp từ Basic lên Pro.',
          category: 'BILLING',
          priority: 'MEDIUM',
          status: body.status ?? 'IN_PROGRESS',
          requesterId: 5,
          requesterName: 'Tran Quan Tri Acme',
          requesterEmail: 'newadmin.acme@loadmaster.vn',
          companyId: 1,
          companyName: 'Acme Logistics',
          assignedToId: 3,
          assignedToName: 'Quản lý Hệ thống LoadMaster',
          resolutionNote: body.resolutionNote ?? 'Đã tiếp nhận yêu cầu.',
          createdAt: '2026-10-19T18:00:00',
          resolvedAt: '2026-10-19T11:10:00Z',
        },
      } as unknown as never
    }
    if (path.startsWith('/api/contracts?companyId=1')) {
      return [
        {
          id: 2,
          companyId: 1,
          companyCode: 'ACME',
          companyName: 'Acme Logistics',
          planId: 1,
          planCode: 'BASIC_MONTHLY',
          planName: 'Basic',
          planTier: 'BASIC',
          price: 1200000,
          billingCycle: 'MONTHLY',
          status: 'ACTIVE',
          startedAt: '2026-10-19T10:00:00',
          expiresAt: '2026-11-19T10:00:00',
          autoRenew: true,
        },
      ] as unknown as never
    }
    if (path === '/api/contracts' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as { companyId: number; planId: number }
      return {
        id: 2,
        companyId: body.companyId,
        companyCode: 'ACME',
        companyName: 'Acme Logistics',
        planId: body.planId,
        planCode: 'PRO_MONTHLY',
        planName: 'Pro',
        planTier: 'PRO',
        price: 4900000,
        billingCycle: 'MONTHLY',
        status: 'ACTIVE',
        startedAt: '2026-10-19T20:00:00',
        expiresAt: '2026-11-19T20:00:00',
        autoRenew: true,
      } as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  const tickets = await listSupportTickets()
  expect(tickets).toHaveLength(1)
  expect(tickets[0]).toMatchObject({
    id: 'TCK-20261019-1111',
    title: 'Cần nâng cấp lên gói Pro',
    kind: 'BILLING',
    status: 'OPEN',
    companyId: '1',
    senderName: 'Tran Quan Tri Acme',
  })

  const created = await createSupportTicket({
    kind: 'BILLING',
    title: 'Yêu cầu nâng cấp gói',
    description: 'Muốn đổi từ Basic lên Pro',
  })
  expect(created.id).toBe('TCK-20261019-2222')
  expect(created.kind).toBe('BILLING')

  const replied = await replyToSupportTicket('TCK-20261019-1111', 'Đã duyệt nâng cấp.')
  expect(replied.replies).toHaveLength(1)
  expect(replied.replies[0]?.text).toBe('Đã duyệt nâng cấp.')

  const closed = await setSupportTicketStatus('TCK-20261019-1111', 'CLOSED')
  expect(closed.status).toBe('CLOSED')

  const panel = await getSupportCompanyPanel('1')
  expect(panel.company.name).toBe('Acme Logistics')
  expect(panel.current?.plan.name).toBe('Basic')
  expect(panel.planStatus).toBe('ACTIVE')

  const contract = await assignCompanyPlan('1', '2')
  expect(contract.planName).toBe('Pro')
  expect(apiFetchSpy).toHaveBeenCalled()
})


test('createSupportTicket maps BILLING to MEDIUM priority and TECHNICAL to HIGH priority', async () => {
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const postedPayloads: Array<{ category: string; priority: string }> = []
  vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (_path: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as {
      subject: string
      description: string
      category: string
      priority: string
    }
    postedPayloads.push({ category: body.category, priority: body.priority })
    return {
      success: true,
      data: {
        id: 20,
        ticketCode: 'TCK-20261027-9999',
        subject: body.subject,
        description: body.description,
        category: body.category,
        priority: body.priority,
        status: 'OPEN',
        requesterId: 5,
        requesterName: 'Tran Quan Tri Acme',
        requesterEmail: 'newadmin.acme@loadmaster.vn',
        companyId: 1,
        companyName: 'Acme Logistics',
        assignedToId: null,
        assignedToName: null,
        resolutionNote: null,
        createdAt: '2026-10-27 21:40:00',
        resolvedAt: null,
      },
    } as unknown as never
  })

  await createSupportTicket({
    kind: 'BILLING',
    title: 'Hỏi về gói cước',
    description: 'Cần xuất hóa đơn VAT',
  })

  await createSupportTicket({
    kind: 'TECHNICAL',
    title: 'Lỗi không hiển thị 3D',
    description: 'Màn hình 3D bị trắng',
  })

  expect(postedPayloads).toEqual([
    { category: 'BILLING', priority: 'MEDIUM' },
    { category: 'SYSTEM_BUG', priority: 'HIGH' },
  ])
})
