import { afterEach, expect, test, vi } from 'vitest'
import * as authApi from '@/features/auth/auth-api'
import * as apiClient from '@/lib/api-client'
import {
  assignCompanyPlan,
  createSupportTicket,
  getRecentCompanyChatHistory,
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

test('replyToSupportTicket appends JSON chat replies with yyyy-MM-dd HH:mm:ss timestamp and getRecentCompanyChatHistory returns only the 2 most recent active chat days for a company', async () => {
  vi.spyOn(authApi, 'isAuthenticated').mockReturnValue(true)

  const existingResolutionNote = JSON.stringify([
    {
      authorId: '5',
      authorName: 'Công ty A',
      authorRole: 'companyAdmin',
      text: 'Tin nhắn ngày 28/10',
      at: '2026-10-28 09:00:00',
    },
    {
      authorId: '3',
      authorName: 'Supporter',
      authorRole: 'systemSupporter',
      text: 'Tin nhắn ngày 29/10',
      at: '2026-10-29 14:30:00',
    },
  ])

  let savedResolutionNote: string | null = existingResolutionNote

  vi.spyOn(apiClient, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/api/support-tickets' && (!init || !init.method || init.method === 'GET')) {
      return {
        success: true,
        data: [
          {
            id: 30,
            ticketCode: 'TCK-20261028-3000',
            subject: 'Hỗ trợ kết nối API',
            description: 'Nhờ kiểm tra webhook',
            category: 'SYSTEM_BUG',
            priority: 'HIGH',
            status: 'IN_PROGRESS',
            requesterId: 5,
            requesterName: 'Công ty A',
            requesterEmail: 'admin@companya.vn',
            companyId: 1,
            companyName: 'Công ty A',
            assignedToId: 3,
            assignedToName: 'Supporter',
            resolutionNote: savedResolutionNote,
            createdAt: '2026-10-28 08:30:00',
            resolvedAt: null,
          },
        ],
      } as unknown as never
    }
    if (path === '/api/support-tickets/30' && init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body)) as { status?: string; resolutionNote?: string }
      savedResolutionNote = body.resolutionNote ?? null
      return {
        success: true,
        data: {
          id: 30,
          ticketCode: 'TCK-20261028-3000',
          subject: 'Hỗ trợ kết nối API',
          description: 'Nhờ kiểm tra webhook',
          category: 'SYSTEM_BUG',
          priority: 'HIGH',
          status: body.status ?? 'IN_PROGRESS',
          requesterId: 5,
          requesterName: 'Công ty A',
          requesterEmail: 'admin@companya.vn',
          companyId: 1,
          companyName: 'Công ty A',
          assignedToId: 3,
          assignedToName: 'Supporter',
          resolutionNote: savedResolutionNote,
          createdAt: '2026-10-28 08:30:00',
          resolvedAt: null,
        },
      } as unknown as never
    }
    throw new Error(`Unexpected path: ${path}`)
  })

  await listSupportTickets()
  const updated = await replyToSupportTicket('TCK-20261028-3000', 'Tin nhắn mới hôm nay')

  expect(savedResolutionNote).not.toBeNull()
  expect(savedResolutionNote?.trim().startsWith('[')).toBe(true)

  const parsedPayload = JSON.parse(savedResolutionNote!) as Array<{ text: string; at: string }>
  // Chỉ giữ lại 2 ngày có hoạt động gần nhất (ngày 29/10 và ngày hôm nay), tự động cắt bỏ ngày 28/10
  expect(parsedPayload).toHaveLength(2)
  expect(parsedPayload[0]?.text).toBe('Tin nhắn ngày 29/10')
  expect(parsedPayload[1]?.text).toBe('Tin nhắn mới hôm nay')
  expect(parsedPayload[1]?.at).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  expect(updated.replies).toHaveLength(2)

  // Kiểm tra getRecentCompanyChatHistory chỉ lấy đúng 2 ngày gần nhất của công ty 1, không lẫn công ty 2
  const companyHistory = getRecentCompanyChatHistory(
    [
      {
        id: 'TCK-1',
        companyId: '1',
        senderId: '5',
        senderName: 'Công ty A',
        kind: 'TECHNICAL',
        title: 'Ticket cũ',
        description: 'Mô tả ngày 25',
        status: 'CLOSED',
        createdAt: '2026-10-25 08:00:00',
        updatedAt: '2026-10-28 09:00:00',
        replies: [
          {
            authorId: '5',
            authorName: 'Công ty A',
            authorRole: 'companyAdmin',
            text: 'Chat ngày 28/10',
            at: '2026-10-28 09:00:00',
          },
        ],
      },
      {
        id: 'TCK-2',
        companyId: '1',
        senderId: '5',
        senderName: 'Công ty A',
        kind: 'BILLING',
        title: 'Ticket mới',
        description: 'Mô tả ngày 29',
        status: 'IN_PROGRESS',
        createdAt: '2026-10-29 10:00:00',
        updatedAt: '2026-10-30 15:00:00',
        replies: [
          {
            authorId: '3',
            authorName: 'Supporter',
            authorRole: 'systemSupporter',
            text: 'Chat ngày 29/10',
            at: '2026-10-29 14:30:00',
          },
          {
            authorId: '5',
            authorName: 'Công ty A',
            authorRole: 'companyAdmin',
            text: 'Chat ngày 30/10',
            at: '2026-10-30 15:00:00',
          },
        ],
      },
      {
        id: 'TCK-OTHER',
        companyId: '2',
        senderId: '9',
        senderName: 'Công ty B',
        kind: 'BILLING',
        title: 'Ticket công ty khác',
        description: 'Không được lẫn vào công ty 1',
        status: 'OPEN',
        createdAt: '2026-10-30 16:00:00',
        updatedAt: '2026-10-30 16:00:00',
        replies: [
          {
            authorId: '9',
            authorName: 'Công ty B',
            authorRole: 'companyAdmin',
            text: 'Chat của công ty B',
            at: '2026-10-30 16:05:00',
          },
        ],
      },
    ],
    '1',
  )

  expect(companyHistory.map((item) => item.text)).toEqual(['Chat ngày 29/10', 'Chat ngày 30/10'])
  expect(new Set(companyHistory.map((item) => item.date))).toEqual(new Set(['2026-10-29', '2026-10-30']))
})
