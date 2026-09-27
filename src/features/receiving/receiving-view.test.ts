import { expect, test } from 'vitest'
import { fetchIncomingShipments, receivePackageByQr } from './receiving-api'
import { pendingByToken, pendingCount, recentReceipts, shipmentProgress } from './receiving-view'

/**
 * Màn nhận hàng (LM-104) đọc lô qua `fetchIncomingShipments` rồi tính bằng các hàm thuần này; test đi qua kho seed thật
 * (SHP-002 đang nhận 4 / 12, SHP-003 chưa nhận kiện nào) thay vì dựng lô giả.
 */

test('a scanned code finds the pending package however it was typed, and received packages are left to the repository', async () => {
  const rows = await fetchIncomingShipments()
  const second = rows.find((row) => row.shipment.id === 'SHP-002')!
  const waiting = second.pending[0]!.package
  const typed = ` ${waiting.qrToken.toLowerCase().replaceAll('-', ' ')} `

  expect(pendingByToken(rows, typed)).toMatchObject({ item: { package: { id: waiting.id } }, row: { shipment: { id: 'SHP-002' } } })
  expect(pendingByToken(rows, second.received[0]!.package.qrToken)).toBeUndefined()
  expect(pendingByToken(rows, 'LM-0000-0000-0000')).toBeUndefined()
})

test('progress counts received packages of each shipment and the recent list is newest first', async () => {
  const before = await fetchIncomingShipments()
  const second = before.find((row) => row.shipment.id === 'SHP-002')!
  expect(shipmentProgress(second)).toStrictEqual({ received: 4, total: 12, percent: (4 / 12) * 100 })
  const waitingBefore = pendingCount(before)

  const next = second.pending[0]!.package
  await receivePackageByQr(next.qrToken)
  const after = await fetchIncomingShipments()

  expect(pendingCount(after)).toBe(waitingBefore - 1)
  expect(shipmentProgress(after.find((row) => row.shipment.id === 'SHP-002')!).received).toBe(5)
  const recent = recentReceipts(after, 3)
  expect(recent).toHaveLength(3)
  expect(recent[0]!.item.package.id).toBe(next.id)
  expect(recent.map((receipt) => receipt.at)).toStrictEqual(recent.map((receipt) => receipt.at).toSorted().toReversed())
})
