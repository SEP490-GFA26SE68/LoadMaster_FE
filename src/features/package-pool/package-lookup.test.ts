import { expect, test } from 'vitest'
import { can, type Permission } from '@/features/auth/permissions'
import type { Package } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { lookupActions, lookupView } from './package-lookup'
import type { PackageLookup } from './package-pool-api'

/** Màn Tra cứu kiện (FE-3b-06): màn nào hiện với kết quả nào, và mỗi vai trò làm được gì trên một kiện. */

const pkg = (overrides: Partial<Package> = {}): Package => ({
  id: 'PK-0063', companyId: 'LOG-001', packageCode: 'BV-VIN-2609-05', qrToken: 'LM-7K3F-9XQ2-M4TD', lengthCm: 80, widthCm: 60, heightCm: 50, weightKg: 32,
  handlingClass: 'STANDARD', destination: 'KCN Bắc Vinh, TP. Vinh, Nghệ An', status: 'IMPORTED', flags: [], source: 'IMPORT',
  createdAt: '2026-09-13T09:20:00.000Z', createdBy: 'US-0001', history: [], ...overrides,
})
const found = (overrides: Partial<Package> = {}): PackageLookup => ({ package: pkg(overrides), type: undefined, trip: undefined, stop: undefined })

test('what the screen shows: nothing typed, searching, not found, one package, several to choose from, the chosen one', () => {
  const one = found()
  const twin = found({ id: 'PK-0090' })
  expect(lookupView({ code: '', pickedId: null, pending: false, notFound: false, data: undefined })).toStrictEqual({ kind: 'idle' })
  expect(lookupView({ code: 'BV-VIN-2609-05', pickedId: null, pending: true, notFound: false, data: undefined })).toStrictEqual({ kind: 'pending' })
  expect(lookupView({ code: 'XX', pickedId: null, pending: false, notFound: true, data: undefined })).toStrictEqual({ kind: 'notFound', code: 'XX' })
  expect(lookupView({ code: 'BV-VIN-2609-05', pickedId: null, pending: false, notFound: false, data: [one] })).toStrictEqual({ kind: 'one', item: one, fromMany: false })
  expect(lookupView({ code: 'BV-VIN-2609-05', pickedId: null, pending: false, notFound: false, data: [twin, one] })).toStrictEqual({ kind: 'many', code: 'BV-VIN-2609-05', items: [twin, one] })
  expect(lookupView({ code: 'BV-VIN-2609-05', pickedId: 'PK-0063', pending: false, notFound: false, data: [twin, one] })).toStrictEqual({ kind: 'one', item: one, fromMany: true })
  // Mã kiện trên URL không nằm trong kết quả: quay về danh sách để chọn
  expect(lookupView({ code: 'BV-VIN-2609-05', pickedId: 'PK-9999', pending: false, notFound: false, data: [twin, one] }).kind).toBe('many')
})

const actionsOf = (role: Role, overrides: Partial<Package> = {}) => lookupActions(pkg(overrides), (permission: Permission) => can(role, permission))

test('the dispatcher reprints, opens the package in the pool and its trip, and clears any flag; never "found again"', () => {
  expect(actionsOf('dispatcher', { flags: ['NOT_FOUND', 'DAMAGED'], tripId: 'TRIP-014' })).toStrictEqual({
    reprint: true, openInPool: true, openTrip: true, clearFlags: ['NOT_FOUND', 'DAMAGED'], confirmFound: false,
  })
  expect(actionsOf('dispatcher')).toStrictEqual({ reprint: true, openInPool: true, openTrip: false, clearFlags: [], confirmFound: false })
})

test('the warehouse reprints and reports a "not found" package found; it clears no other flag and opens no dispatcher screen', () => {
  expect(actionsOf('warehouse', { flags: ['NOT_FOUND'], tripId: 'TRIP-014' })).toStrictEqual({
    reprint: true, openInPool: false, openTrip: false, clearFlags: [], confirmFound: true,
  })
  expect(actionsOf('warehouse', { flags: ['DAMAGED'] })).toStrictEqual({ reprint: true, openInPool: false, openTrip: false, clearFlags: [], confirmFound: false })
})
