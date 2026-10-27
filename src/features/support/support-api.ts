import { isAuthenticated } from '@/features/auth/auth-api'
import { apiFetch } from '@/lib/api-client'
import {
  getMockDb,
  type AlgorithmTier,
  type NewSupportTicket,
  type PlanTier,
  type SubscriptionStatus,
  type SupportCompanyPanel,
  type SupportTicket,
  type TicketKind,
  type TicketReply,
  type TicketStatus,
} from '@/lib/mock-db'

type ApiResponse<T> = {
  success: boolean
  message?: string
  data: T
}

type SupportTicketApi = {
  id: number
  ticketCode: string | null
  subject: string
  description: string | null
  category: 'BILLING' | 'ALGORITHM_ERROR' | 'SYSTEM_BUG'
  priority: 'MEDIUM' | 'HIGH'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  requesterId: number | null
  requesterName: string | null
  requesterEmail: string | null
  companyId: number | null
  companyName: string | null
  assignedToId: number | null
  assignedToName: string | null
  resolutionNote: string | null
  createdAt: string | number[] | null
  resolvedAt: string | number | number[] | null
}

type ContractApi = {
  id: number
  companyId: number
  companyCode: string | null
  companyName: string | null
  planId: number | null
  planCode: string | null
  planName: string | null
  planTier: PlanTier | null
  price: number | null
  billingCycle: 'MONTHLY' | 'YEARLY' | null
  status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' | null
  startedAt: string | number[] | null
  expiresAt: string | number[] | null
  autoRenew: boolean | null
}

const ticketDbIdByCode = new Map<string, number>()
const ticketCacheByCode = new Map<string, SupportTicket>()

function toIsoString(val: string | number | number[] | null | undefined): string {
  if (!val) return new Date().toISOString()
  if (typeof val === 'number') {
    const ms = val < 10_000_000_000 ? val * 1000 : val
    return new Date(ms).toISOString()
  }
  if (Array.isArray(val)) {
    const [y = 2026, m = 1, d = 1, hh = 0, mm = 0, ss = 0] = val
    return new Date(y, m - 1, d, hh, mm, ss).toISOString()
  }
  const parsed = new Date(val)
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString()
}

function parseReplies(item: SupportTicketApi): TicketReply[] {
  const note = item.resolutionNote?.trim()
  if (!note) return []
  if (note.startsWith('[')) {
    try {
      const parsed = JSON.parse(note) as TicketReply[]
      if (Array.isArray(parsed)) return parsed
    } catch {
      // fallback to single reply
    }
  }
  return [
    {
      authorId: String(item.assignedToId ?? '3'),
      authorName: item.assignedToName ?? 'Quản lý Hệ thống',
      authorRole: 'systemSupporter',
      text: note,
      at: toIsoString(item.resolvedAt ?? item.createdAt),
    },
  ]
}

function mapTicketApi(item: SupportTicketApi): SupportTicket {
  const code = item.ticketCode ?? `TCK-${item.id}`
  ticketDbIdByCode.set(code, item.id)

  const kind: TicketKind = item.category === 'BILLING' ? 'BILLING' : 'TECHNICAL'
  const status: TicketStatus =
    item.status === 'RESOLVED' || item.status === 'CLOSED'
      ? 'CLOSED'
      : item.status === 'IN_PROGRESS'
        ? 'IN_PROGRESS'
        : 'OPEN'
  const createdAt = toIsoString(item.createdAt)
  const replies = parseReplies(item)
  const updatedAt = replies.at(-1)?.at ?? (item.resolvedAt ? toIsoString(item.resolvedAt) : createdAt)

  const mapped: SupportTicket = {
    id: code,
    companyId: String(item.companyId ?? '1'),
    senderId: String(item.requesterId ?? '1'),
    senderName: item.requesterName ?? item.requesterEmail ?? 'Người dùng công ty',
    kind,
    title: item.subject,
    description: item.description ?? '',
    status,
    replies,
    createdAt,
    updatedAt,
  }
  ticketCacheByCode.set(code, mapped)
  return mapped
}

async function resolveDbId(ticketId: string): Promise<number> {
  const cached = ticketDbIdByCode.get(ticketId)
  if (cached !== undefined) return cached
  const numeric = Number(ticketId)
  if (!Number.isNaN(numeric) && numeric > 0) return numeric
  await listSupportTickets()
  return ticketDbIdByCode.get(ticketId) ?? 1
}

// GET /api/support-tickets
export async function listSupportTickets(): Promise<SupportTicket[]> {
  if (!isAuthenticated()) {
    return getMockDb().listSupportTickets()
  }

  const body = await apiFetch<ApiResponse<SupportTicketApi[]>>('/api/support-tickets')
  return (body.data ?? []).map(mapTicketApi)
}

// POST /api/support-tickets
export async function createSupportTicket(input: NewSupportTicket): Promise<SupportTicket> {
  if (!isAuthenticated()) {
    return getMockDb().createSupportTicket(input)
  }

  const body = await apiFetch<ApiResponse<SupportTicketApi>>('/api/support-tickets', {
    method: 'POST',
    body: JSON.stringify({
      subject: input.title,
      description: input.description,
      category: input.kind === 'BILLING' ? 'BILLING' : 'SYSTEM_BUG',
      priority: input.kind === 'BILLING' ? 'MEDIUM' : 'HIGH',
    }),
  })
  return mapTicketApi(body.data)
}

// PATCH /api/support-tickets/:id
export async function replyToSupportTicket(ticketId: string, text: string): Promise<SupportTicket> {
  if (!isAuthenticated()) {
    return getMockDb().replyToSupportTicket(ticketId, text)
  }

  const dbId = await resolveDbId(ticketId)
  const existing = ticketCacheByCode.get(ticketId)
  const nextStatus = existing?.status === 'OPEN' ? 'IN_PROGRESS' : existing?.status ?? 'IN_PROGRESS'

  const body = await apiFetch<ApiResponse<SupportTicketApi>>(`/api/support-tickets/${dbId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: nextStatus,
      resolutionNote: text,
    }),
  })
  return mapTicketApi(body.data)
}

// PATCH /api/support-tickets/:id
export async function setSupportTicketStatus(ticketId: string, status: TicketStatus): Promise<SupportTicket> {
  if (!isAuthenticated()) {
    return getMockDb().setSupportTicketStatus(ticketId, status)
  }

  const dbId = await resolveDbId(ticketId)
  const body = await apiFetch<ApiResponse<SupportTicketApi>>(`/api/support-tickets/${dbId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
    }),
  })
  return mapTicketApi(body.data)
}

const TIER_ALGORITHM: Record<PlanTier, AlgorithmTier> = {
  BASIC: 'EP_DBLF',
  PRO: 'EP_DBLF_GA',
  ULTIMATE: 'EP_DBLF_GA_AI',
}

type CreditBalanceSupportApi = {
  companyId: number
  balance: number
  isUnlimited: boolean
}

type CreditTransactionSupportApi = {
  id: number
  amount: number
  type: 'MONTHLY_GRANT' | 'PURCHASE' | 'USAGE' | 'REFUND'
  reference: string | null
  createdAt: string | number[]
}

// GET /api/contracts?companyId=... + /api/credits/balance?companyId=... + /api/credits/transactions?companyId=...
export async function getSupportCompanyPanel(companyId: string): Promise<SupportCompanyPanel> {
  if (!isAuthenticated()) {
    return getMockDb().getSupportCompanyPanel(companyId)
  }

  try {
    const encodedId = encodeURIComponent(companyId)
    const [contracts, balanceRes, txRes] = await Promise.all([
      apiFetch<ContractApi[]>(`/api/contracts?companyId=${encodedId}`),
      apiFetch<ApiResponse<CreditBalanceSupportApi>>(`/api/credits/balance?companyId=${encodedId}`).catch(() => null),
      apiFetch<ApiResponse<{ content: CreditTransactionSupportApi[] }>>(
        `/api/credits/transactions?companyId=${encodedId}&size=20`,
      ).catch(() => null),
    ])

    const contract = contracts?.[0]
    const realBalance = balanceRes?.data?.balance
    const realTransactions = (txRes?.data?.content ?? []).map((tx) => ({
      id: String(tx.id),
      companyId: String(companyId),
      amount: Number(tx.amount),
      type: tx.type,
      reference: tx.reference,
      createdAt: toIsoString(tx.createdAt),
    }))

    if (!contract) {
      return {
        company: {
          id: companyId,
          name: `Công ty #${companyId}`,
          taxCode: '',
          address: '',
          contactEmail: '',
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        },
        current: null,
        planStatus: null,
        credit: { balance: realBalance ?? 0, unlimited: false },
        transactions: realTransactions,
      }
    }

    const tier: PlanTier = contract.planTier ?? 'BASIC'
    const status: SubscriptionStatus =
      contract.status === 'TRIAL' || contract.status == null ? 'ACTIVE' : contract.status
    const monthlyCredits = tier === 'ULTIMATE' ? 30000 : tier === 'PRO' ? 10000 : 3000

    return {
      company: {
        id: String(contract.companyId),
        name: contract.companyName ?? `Công ty #${contract.companyId}`,
        taxCode: contract.companyCode ?? '',
        address: '',
        contactEmail: '',
        status: 'ACTIVE',
        createdAt: toIsoString(contract.startedAt),
      },
      current: contract.planId
        ? {
            subscription: {
              id: String(contract.id),
              companyId: String(contract.companyId),
              planId: String(contract.planId),
              status,
              startedAt: toIsoString(contract.startedAt),
              expiresAt: toIsoString(contract.expiresAt),
              autoRenew: Boolean(contract.autoRenew ?? true),
            },
            plan: {
              id: String(contract.planId),
              name: contract.planName ?? tier,
              tier,
              priceVnd: Number(contract.price ?? 0),
              monthlyCredits,
              algorithmTier: TIER_ALGORITHM[tier],
              features: [],
              active: true,
              provisional: false,
            },
          }
        : null,
      planStatus: status,
      credit: {
        balance: realBalance !== undefined ? realBalance : status === 'ACTIVE' ? monthlyCredits : 0,
        unlimited: Boolean(balanceRes?.data?.isUnlimited ?? false),
      },
      transactions: realTransactions,
    }
  } catch {
    return {
      company: {
        id: companyId,
        name: `Công ty #${companyId}`,
        taxCode: '',
        address: '',
        contactEmail: '',
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
      },
      current: null,
      planStatus: null,
      credit: { balance: 0, unlimited: false },
      transactions: [],
    }
  }
}

export type CompanyContractSummary = {
  id: number
  companyId: number
  companyName: string | null
  planId: number | null
  planName: string | null
  planTier: PlanTier | null
  price: number | null
  status: SubscriptionStatus | 'TRIAL' | null
  expiresAt: string | null
}

// GET /api/contracts
export async function listAllCompanyContracts(): Promise<CompanyContractSummary[]> {
  if (!isAuthenticated()) return []
  return apiFetch<CompanyContractSummary[]>('/api/contracts')
}

// POST /api/contracts — SystemSupporter đổi/kích hoạt gói cho công ty khách hàng ngay lập tức
export async function assignCompanyPlan(companyId: string, planId: string): Promise<CompanyContractSummary> {
  return apiFetch<CompanyContractSummary>('/api/contracts', {
    method: 'POST',
    body: JSON.stringify({
      companyId: Number(companyId),
      planId: Number(planId),
      autoRenew: true,
    }),
  })
}
