import { expect, test } from 'vitest'
import { checkProposedOrder, type ProposedOrderInput } from '@/domain/routing'

/** Năm điểm: A đã hoàn tất, B xe đã tới (cố định), C · D · E còn chưa giao; yêu cầu nhận dọc đường có điểm nhận D, điểm giao E. */
const BASE: ProposedOrderInput = {
  current: ['A', 'B', 'C', 'D', 'E'],
  proposed: ['A', 'B', 'C', 'D', 'E'],
  fixedCount: 2,
  pickups: [{ pickupStopId: 'D', deliveryStopId: 'E' }],
}

test.each([
  { name: 'moving only the free stops, pickup still before its delivery', proposed: ['A', 'B', 'D', 'E', 'C'], violation: null },
  { name: 'the same order is not a change', proposed: ['A', 'B', 'C', 'D', 'E'], violation: { code: 'STOP_ORDER_INVALID' } },
  { name: 'a stop missing', proposed: ['A', 'B', 'C', 'D'], violation: { code: 'STOP_ORDER_INVALID' } },
  { name: 'a stop that is not on the trip', proposed: ['A', 'B', 'C', 'D', 'Z'], violation: { code: 'STOP_ORDER_INVALID' } },
  { name: 'a stop twice', proposed: ['A', 'B', 'C', 'D', 'D'], violation: { code: 'STOP_ORDER_INVALID' } },
  { name: 'the stop the vehicle is at moved', proposed: ['A', 'C', 'B', 'D', 'E'], violation: { code: 'STOP_NOT_MOVABLE', stopIds: ['B'] } },
  { name: 'completed and arrived stops both moved', proposed: ['B', 'A', 'C', 'E', 'D'], violation: { code: 'STOP_NOT_MOVABLE', stopIds: ['A', 'B'] } },
  { name: 'the pickup stop after its delivery stop', proposed: ['A', 'B', 'C', 'E', 'D'], violation: { code: 'PICKUP_AFTER_DELIVERY', pickupStopId: 'D', deliveryStopId: 'E' } },
])('$name', ({ proposed, violation }) => {
  expect(checkProposedOrder({ ...BASE, proposed })).toStrictEqual(violation)
})
