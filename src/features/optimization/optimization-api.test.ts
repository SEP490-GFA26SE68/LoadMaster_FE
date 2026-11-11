import { expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { OptimizationServiceError } from '@/services/optimization'
import { buildOptimizationRequest, DEFAULT_SETUP } from './optimization-request'
import { fetchOptimizationCredit, runOptimization } from './optimization-api'

/**
 * Credit của một lần chạy tối ưu 3D qua lớp `-api.ts` (FE-8-05, D-89): giữ khi bắt đầu, trừ khi lưu xong, hoàn khi lỗi hoặc huỷ — mỗi
 * lần chạy đúng một bộ giao dịch. Luật chặn (hết credit, gói hết hạn, gói không giới hạn) kiểm ở `billing.test.ts`. Kho dùng chung
 * không phiên: công ty mặc định Long Bình, gói Pro, 472 credit; một lần chạy 2 credit (kho có độ trễ giả nên mỗi lượt chạy mất vài giây).
 */

const TRIP_ID = 'TRIP-012'
const SLOW = 30_000

async function runInput(overrides: { simulateFailure?: boolean; signal?: AbortSignal } = {}) {
  const db = getMockDb()
  const trip = await db.getTrip(TRIP_ID)
  const request = buildOptimizationRequest(trip, await db.getVehicle(trip.vehicleId), DEFAULT_SETUP)
  return { tripId: TRIP_ID, request, simulateFailure: false, ...overrides }
}

test('a saved run costs the credits of one run (2) for its three plans, and reports its three steps in order', async () => {
  const before = (await fetchOptimizationCredit()).balance
  const stages: string[] = []
  const outcome = await runOptimization({ ...(await runInput()), onStage: (stage) => stages.push(stage) })
  expect(stages).toStrictEqual(['reserve', 'pack', 'save'])
  expect(outcome.kind === 'saved' ? outcome.revisions : []).toHaveLength(3)
  expect(await fetchOptimizationCredit()).toMatchObject({ balance: before - 2, cost: 2, planName: 'Pro', algorithmTier: 'EP_DBLF_GA', block: null })
  expect((await getMockDb().listCreditTransactions())[0]).toMatchObject({ type: 'USAGE', amount: -2, usageStatus: 'DEDUCTED', tripId: TRIP_ID })
}, SLOW)

test.each([
  { what: 'a service failure (?mo-phong=loi)', input: () => runInput({ simulateFailure: true }), error: OptimizationServiceError },
  { what: 'a cancelled run', input: () => runInput({ signal: AbortSignal.abort() }), error: DOMException },
])('$what is refunded: balance unchanged, one usage and one refund of the run', async ({ input, error }) => {
  const db = getMockDb()
  const before = (await fetchOptimizationCredit()).balance
  const stages: string[] = []
  await expect(runOptimization({ ...(await input()), onStage: (stage) => stages.push(stage) })).rejects.toBeInstanceOf(error)
  // Không tới bước lưu: hộp thoại không bao giờ nói "đang lưu" cho một lần chạy không có gì để lưu
  expect(stages).toStrictEqual(['reserve', 'pack'])
  expect((await fetchOptimizationCredit()).balance).toBe(before)
  const [refund, usage] = await db.listCreditTransactions()
  expect([refund, usage]).toMatchObject([
    { type: 'REFUND', amount: 2, reference: usage?.reference },
    { type: 'USAGE', amount: -2, usageStatus: 'REFUNDED', refunded: true },
  ])
}, SLOW)
