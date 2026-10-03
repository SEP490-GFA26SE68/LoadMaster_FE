import { expect, test } from 'vitest'
import { annotatePlacements, applyPose, createConstraintEngine } from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_CARTON_A_PLACEMENT, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, PackagePlacement } from '@/domain/models'

test('the Spec §12 sample placement has no error, stands fully supported, carries nothing, and only sits off-centre', () => {
  const engine = createConstraintEngine({
    vehicle: SPEC_TRUCK_6M,
    packages: [SPEC_CARTON_A],
    placements: [SPEC_CARTON_A_PLACEMENT],
    settings: { enforceLifo: true },
  })
  const { issues, byInstanceId, supportRatioById, loadById } = engine.evaluateAll()
  expect({
    issues,
    ownIssues: byInstanceId.get('PKG-001-01') ?? [],
    supportRatio: supportRatioById.get('PKG-001-01'),
    loadKg: loadById.get('PKG-001-01'),
  }).toStrictEqual({
    // one carton at x 120..240, y 0..60 puts the centre of gravity at (180, 30): 90 cm off the 120 cm centre line (limit 15% of 240 =
    // 36 cm) and 120 cm ahead of the 300 cm mid-length (limit 15% of 600 = 90 cm)
    issues: [
      { code: 'COG_LATERAL', severity: 'warning', params: { offsetCm: 90, limitCm: 36 } },
      { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 120, limitCm: 90, toward: 'front' } },
    ],
    ownIssues: [],
    supportRatio: 1,
    loadKg: 0,
  })
})

test('annotatePlacements replaces stale supportRatio and constraintWarnings with what the engine finds', () => {
  const stale = { ...SPEC_CARTON_A_PLACEMENT, supportRatio: 0.3, constraintWarnings: ['OVERLAP'] }
  // 60 cm up in the air at x 300: nothing below it
  const floating = { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: 'PKG-001-02', xCm: 300, zCm: 60 }
  const annotated = annotatePlacements({ vehicle: SPEC_TRUCK_6M, packages: [SPEC_CARTON_A], placements: [stale, floating], settings: { enforceLifo: true } })
  expect(annotated.map(({ packageInstanceId, supportRatio, constraintWarnings }) => [packageInstanceId, supportRatio, constraintWarnings])).toStrictEqual([
    ['PKG-001-01', 1, []],
    ['PKG-001-02', 0, ['SUPPORT_BELOW_MIN']],
  ])
})

/** Carton A (120 × 60 × 45 cm, LWH) instances on the floor at y 60, one per x. */
function cartonsAt(...xs: number[]): PackagePlacement[] {
  return xs.map((xCm, index) => ({ ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: `PKG-001-0${index + 1}`, xCm, yCm: 60 }))
}

function engineFor(placements: PackagePlacement[], packages: CargoPackage[] = [SPEC_CARTON_A]) {
  return createConstraintEngine({ vehicle: SPEC_TRUCK_6M, packages, placements, settings: { enforceLifo: true } })
}

test('each overlapping pair is reported once, on the later package, and listed under both packages', () => {
  // x 240..360, 300..420 and 400..520: the first two share 60 cm, the last two 20 cm, the first and last nothing
  const { issues, byInstanceId } = engineFor(cartonsAt(240, 300, 400)).evaluateAll()
  const later = { code: 'OVERLAP', severity: 'error', packageInstanceId: 'PKG-001-02', relatedIds: ['PKG-001-01'], params: {} }
  const last = { code: 'OVERLAP', severity: 'error', packageInstanceId: 'PKG-001-03', relatedIds: ['PKG-001-02'], params: {} }
  expect(issues.filter(({ code }) => code === 'OVERLAP')).toStrictEqual([later, last])
  expect(['PKG-001-01', 'PKG-001-02', 'PKG-001-03'].map((id) => byInstanceId.get(id))).toStrictEqual([[later], [later, last], [last]])
})

test('evaluateAll runs every placement check of the domain on one plan', () => {
  const heavy: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-002', name: 'Máy nén khí', quantity: 1, weightKg: 100, deliveryStop: 1 }
  const early: CargoPackage = { ...SPEC_CARTON_A, id: 'PKG-003', name: 'Thùng nước mắm', quantity: 1, deliveryStop: 1 }
  const at = (packageInstanceId: string, xCm: number, yCm: number, zCm: number, loadingOrder: number): PackagePlacement => ({
    ...SPEC_CARTON_A_PLACEMENT,
    packageInstanceId,
    xCm,
    yCm,
    zCm,
    loadingOrder,
  })
  const plan = [
    at('PKG-001-01', 0, 0, 0, 1), // inside the wheel arch x 0..120, y 0..30
    at('PKG-001-02', 200, 180, 210, 2), // top at 255 under a 250 cm ceiling, floating
    at('PKG-001-03', 300, 0, 0, 4), // rated 90 kg, carries the 100 kg compressor
    at('PKG-002-01', 300, 0, 45, 3), // loaded before the carton under it
    at('PKG-003-01', 300, 120, 0, 5), // stop 1, its rear face x = 420 fully covered by a stop 2 carton
    at('PKG-001-04', 420, 120, 0, 6),
  ]
  const { issues } = engineFor(plan, [SPEC_CARTON_A, heavy, early]).evaluateAll()
  expect(issues.filter(({ code }) => !code.startsWith('COG')).map(({ code, packageInstanceId }) => [code, packageInstanceId])).toStrictEqual([
    ['OBSTACLE_OVERLAP', 'PKG-001-01'],
    ['EXCEEDS_BOUNDARY', 'PKG-001-02'],
    ['SUPPORT_BELOW_MIN', 'PKG-001-02'],
    ['LIFO_BLOCKED', 'PKG-003-01'],
    ['TOP_LOAD_EXCEEDED', 'PKG-001-03'],
    ['LOADING_ORDER_INFEASIBLE', 'PKG-002-01'],
  ])
})

test('an upright-only carton laid down is not allowed, and sizes that do not follow the declared orientation mismatch', () => {
  // Carton A allows LWH and WLH only (keepUpright); HWL stands it on its side with sizes that do follow HWL
  const laidDown = applyPose(cartonsAt(0)[0] as PackagePlacement, { xCm: 300, yCm: 60, zCm: 0, orientation: 'HWL' }, SPEC_CARTON_A)
  // WLH is allowed, but the sizes are still the 120 × 60 × 45 cm of LWH
  const [, stale] = cartonsAt(0, 0).map((placement) => ({ ...placement, orientation: 'WLH' as const, yCm: 150 }))
  const { issues } = engineFor([laidDown, stale as PackagePlacement]).evaluateAll()
  expect(issues.filter(({ code }) => code.startsWith('ORIENTATION'))).toStrictEqual([
    { code: 'ORIENTATION_NOT_ALLOWED', severity: 'error', packageInstanceId: 'PKG-001-01', params: { orientation: 'HWL' } },
    { code: 'ORIENTATION_MISMATCH', severity: 'error', packageInstanceId: 'PKG-001-02', params: { orientation: 'WLH' } },
  ])
})
