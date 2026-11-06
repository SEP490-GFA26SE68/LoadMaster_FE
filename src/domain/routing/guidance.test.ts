import { expect, test } from 'vitest'
import { nextGuidance, remainingTo, type GuidanceStep } from './guidance'

const HERE = { lat: 10.77, lng: 106.7 }
const STEPS: GuidanceStep[] = [
  { instruction: 'Rẽ phải vào Nguyễn Huệ', maneuver: 'turn-right', distanceMeters: 300, durationSeconds: 40, lat: 10.771, lng: 106.701 },
  { instruction: 'Đi thẳng', maneuver: 'straight', distanceMeters: 800, durationSeconds: 90, lat: 10.78, lng: 106.71 },
]

test('without a GPS fix the first step is shown with its own distance', () => {
  expect(nextGuidance(STEPS, undefined)).toMatchObject({
    instruction: 'Rẽ phải vào Nguyễn Huệ',
    maneuver: 'turn-right',
    remainingMeters: 300,
  })
})

test('when the vehicle is still away from the next turn, remaining meters are the haversine to that turn', () => {
  const next = nextGuidance(STEPS, HERE)
  expect(next?.maneuver).toBe('turn-right')
  expect(next?.remainingMeters).toBeGreaterThan(100)
})

test('an empty step list yields nothing; remainingTo without GPS is 0', () => {
  expect(nextGuidance([], HERE)).toBeUndefined()
  expect(remainingTo({ lat: 10.8, lng: 106.8 }, undefined)).toBe(0)
})
