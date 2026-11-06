import { expect, test } from 'vitest'
import { SPEC_CARTON_A, SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import {
  effectiveOrientations,
  isUpright,
  matchesOrientation,
  nextOrientation,
  orientDimensions,
  previousOrientation,
  UPRIGHT_ORIENTATIONS,
} from '@/domain/geometry'

test('each orientation code lays the package edges it names along X, Y and Z, in that order (Carton A 120 × 60 × 45 cm)', () => {
  expect({
    LWH: orientDimensions(SPEC_CARTON_A, 'LWH'),
    LHW: orientDimensions(SPEC_CARTON_A, 'LHW'),
    WLH: orientDimensions(SPEC_CARTON_A, 'WLH'),
    WHL: orientDimensions(SPEC_CARTON_A, 'WHL'),
    HLW: orientDimensions(SPEC_CARTON_A, 'HLW'),
    HWL: orientDimensions(SPEC_CARTON_A, 'HWL'),
  }).toStrictEqual({
    LWH: { placedLengthCm: 120, placedWidthCm: 60, placedHeightCm: 45 },
    LHW: { placedLengthCm: 120, placedWidthCm: 45, placedHeightCm: 60 },
    WLH: { placedLengthCm: 60, placedWidthCm: 120, placedHeightCm: 45 },
    WHL: { placedLengthCm: 60, placedWidthCm: 45, placedHeightCm: 120 },
    HLW: { placedLengthCm: 45, placedWidthCm: 120, placedHeightCm: 60 },
    HWL: { placedLengthCm: 45, placedWidthCm: 60, placedHeightCm: 120 },
  })
})

test('LWH and WLH are the upright orientations, the only codes that keep the package height H on the Z axis', () => {
  const allCodes = ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'] as const
  expect([UPRIGHT_ORIENTATIONS, allCodes.filter(isUpright)]).toStrictEqual([
    ['LWH', 'WLH'],
    ['LWH', 'WLH'],
  ])
})

test('a package not kept upright may use every orientation it allows, in its own order', () => {
  const lyingAllowed = { ...SPEC_CARTON_A, keepUpright: false, allowedOrientations: ['HWL', 'LWH', 'LHW'] as const }
  expect(effectiveOrientations(lyingAllowed)).toStrictEqual(['HWL', 'LWH', 'LHW'])
})

test('a package kept upright only uses its upright orientations, in its own order, even when its list still holds lying ones', () => {
  const stillLying = { ...SPEC_CARTON_A, keepUpright: true, allowedOrientations: ['WLH', 'HWL', 'LWH', 'LHW'] as const }
  expect(effectiveOrientations(stillLying)).toStrictEqual(['WLH', 'LWH'])
})

test('rotating Carton A, which allows LWH and WLH, alternates between the two', () => {
  expect([nextOrientation(SPEC_CARTON_A, 'LWH'), nextOrientation(SPEC_CARTON_A, 'WLH')]).toStrictEqual(['WLH', 'LWH'])
})

test('a 60 × 60 × 45 cm package kept upright stays put: turning LWH into WLH would be a rotation that changes nothing', () => {
  const squareBase = { ...SPEC_CARTON_A, lengthCm: 60 }
  expect([nextOrientation(squareBase, 'LWH'), nextOrientation(squareBase, 'WLH')]).toStrictEqual(['LWH', 'WLH'])
})

test('rotating skips an orientation that only swaps two equal sides and moves on to one that changes the placed size', () => {
  // 60 × 60 × 45 cm: WLH is 60 × 60 × 45 like LWH, HLW lays it down to 45 × 60 × 60
  const squareBase = { ...SPEC_CARTON_A, lengthCm: 60, keepUpright: false, allowedOrientations: ['LWH', 'WLH', 'HLW'] as const }
  expect(nextOrientation(squareBase, 'LWH')).toBe('HLW')
})

test('rotating a package kept upright never tries a lying orientation, even when its list still holds one', () => {
  const stillLying = { ...SPEC_CARTON_A, allowedOrientations: ['LWH', 'HLW', 'WLH'] as const }
  expect(nextOrientation(stillLying, 'LWH')).toBe('WLH')
})

test('rotating Carton A out of an orientation it does not allow, like lying HLW, brings it back to its first allowed one', () => {
  expect(nextOrientation(SPEC_CARTON_A, 'HLW')).toBe('LWH')
})

test('the Spec §12 sample placement, Carton A in LWH at 120 × 60 × 45 cm, matches its orientation', () => {
  expect(matchesOrientation(SPEC_CARTON_A_PLACEMENT, SPEC_CARTON_A)).toBe(true)
})

test('a placement of Carton A labelled WLH must be sized 60 × 120 × 45 cm; keeping the unturned 120 × 60 × 45 cm does not match', () => {
  const relabelledOnly = { ...SPEC_CARTON_A_PLACEMENT, orientation: 'WLH' as const }
  const turned = { ...relabelledOnly, placedLengthCm: 60, placedWidthCm: 120 }
  expect([matchesOrientation(relabelledOnly, SPEC_CARTON_A), matchesOrientation(turned, SPEC_CARTON_A)]).toStrictEqual([false, true])
})

test('a placed size off only by floating-point drift still matches its orientation, but one 0.1 cm short does not', () => {
  // a 120.7 cm carton spanning x = 100.4 → 221.1: 221.1 − 100.4 evaluates to 120.69999999999999
  const carton = { ...SPEC_CARTON_A, lengthCm: 120.7 }
  const spanned = { ...SPEC_CARTON_A_PLACEMENT, placedLengthCm: 221.1 - 100.4 }
  const short = { ...SPEC_CARTON_A_PLACEMENT, placedLengthCm: 120.6 }
  expect([matchesOrientation(spanned, carton), matchesOrientation(short, carton)]).toStrictEqual([true, false])
})

test('turning back walks the allowed orientations in reverse and still skips one that changes nothing', () => {
  const squareBase = { ...SPEC_CARTON_A, lengthCm: 60, keepUpright: false, allowedOrientations: ['LWH', 'WLH', 'HLW'] as const }
  expect([previousOrientation(squareBase, 'HLW'), previousOrientation(squareBase, 'WLH')]).toStrictEqual(['WLH', 'HLW'])
})

test('turning back from an orientation the package does not allow starts at its last allowed one', () => {
  expect(previousOrientation(SPEC_CARTON_A, 'HLW')).toBe('WLH')
})
