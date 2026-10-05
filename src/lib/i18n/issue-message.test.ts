import { describe, expect, test } from 'vitest'
import {
  CONSTRAINT_CODES,
  stackIssues,
  validatePackages,
  validateVehicle,
  type ConstraintCode,
  type ConstraintIssue,
} from '@/domain/constraints'
import { SPEC_CARTON_A, SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage, VehicleConfig, VehicleObstacle } from '@/domain/models'
import { placed, stackGraphOf, stackingProfile } from '@/test/placements'
import { createFormatter } from '@/lib/format'
import { createTranslator, formatIssue, LOCALES, type Locale } from '@/lib/i18n'
import { SPEC_13_EXAMPLES, SPEC_13_PKG_004_TOO_TALL } from '@/test/spec-13'

const FORMAT_LOCALES = { vi: 'vi-VN', en: 'en-US' } as const

function messageOf(issue: ConstraintIssue, locale: Locale): string {
  return formatIssue(issue, createTranslator(locale), createFormatter(FORMAT_LOCALES[locale]))
}

test.each(SPEC_13_EXAMPLES)('English rebuilds Spec §13 word for word: "$sentence"', ({ sentence, issue }) => {
  expect(messageOf(issue, 'en')).toBe(sentence)
})

/** One realistic issue per code; a new code without a sample fails `tsc -b`. */
const SAMPLE_ISSUES: { readonly [C in ConstraintCode]: ConstraintIssue<C> } = {
  DIMENSION_NOT_POSITIVE: {
    code: 'DIMENSION_NOT_POSITIVE',
    severity: 'error',
    field: 'heightCm',
    params: { entity: 'package', packageId: 'PKG-002' },
  },
  DOOR_EXCEEDS_INNER: {
    code: 'DOOR_EXCEEDS_INNER',
    severity: 'error',
    field: 'doorHeightCm',
    params: { axis: 'z', doorCm: 255.5, innerCm: 250 },
  },
  NO_ALLOWED_ORIENTATION: { code: 'NO_ALLOWED_ORIENTATION', severity: 'error', params: { packageId: 'PKG-001' } },
  PAYLOAD_EXCEEDED: {
    code: 'PAYLOAD_EXCEEDED',
    severity: 'warning',
    params: { totalKg: 5320, maxPayloadKg: 5000, overKg: 320 },
  },
  MUST_LOAD_PAYLOAD_EXCEEDED: {
    code: 'MUST_LOAD_PAYLOAD_EXCEEDED',
    severity: 'error',
    params: { totalKg: 5150.5, maxPayloadKg: 5000, overKg: 150.5 },
  },
  DOOR_TOO_SMALL: {
    code: 'DOOR_TOO_SMALL',
    severity: 'error',
    params: { packageId: 'PKG-003', doorWidthCm: 220, doorHeightCm: 230 },
  },
  EXCEEDS_BOUNDARY: SPEC_13_PKG_004_TOO_TALL,
  OVERLAP: { code: 'OVERLAP', severity: 'error', packageInstanceId: 'PKG-006', relatedIds: ['PKG-007', 'PKG-009'], params: {} },
  OBSTACLE_OVERLAP: {
    code: 'OBSTACLE_OVERLAP',
    severity: 'error',
    packageInstanceId: 'PKG-001-02',
    params: { obstacleId: 'OBS-001' },
  },
  NON_BEARING_SUPPORT: {
    code: 'NON_BEARING_SUPPORT',
    severity: 'error',
    packageInstanceId: 'PKG-001-03',
    params: { obstacleId: 'OBS-001' },
  },
  SUPPORT_BELOW_MIN: {
    code: 'SUPPORT_BELOW_MIN',
    severity: 'warning',
    packageInstanceId: 'PKG-008',
    params: { ratio: 0.62, required: 0.8 },
  },
  TOP_LOAD_EXCEEDED: {
    code: 'TOP_LOAD_EXCEEDED',
    severity: 'error',
    packageInstanceId: 'PKG-001-01',
    params: { loadKg: 120.25, maxKg: 90 },
  },
  NOT_STACKABLE: {
    code: 'NOT_STACKABLE',
    severity: 'error',
    packageInstanceId: 'PKG-002-01',
    relatedIds: ['PKG-001-01'],
    params: {},
  },
  STACK_COUNT_EXCEEDED: {
    code: 'STACK_COUNT_EXCEEDED',
    severity: 'error',
    packageInstanceId: 'PKG-001-04',
    params: { layers: 4, maxStackCount: 3 },
  },
  LIFO_BLOCKED: { code: 'LIFO_BLOCKED', severity: 'error', packageInstanceId: 'PKG-001-01', params: { coverage: 1 } },
  LIFO_PARTIAL: { code: 'LIFO_PARTIAL', severity: 'warning', packageInstanceId: 'PKG-001-02', params: { coverage: 0.4 } },
  COG_LATERAL: { code: 'COG_LATERAL', severity: 'warning', params: { offsetCm: 26.4, limitCm: 24 } },
  COG_LONGITUDINAL: { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 112.5, limitCm: 90, toward: 'front' } },
  COG_HIGH: { code: 'COG_HIGH', severity: 'warning', params: { heightCm: 137.5, limitCm: 125 } },
  AXLE_OVERLOAD: { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'rear', loadKg: 6240.5, limitKg: 6000, overKg: 240.5 } },
  MUST_LOAD_UNPLACED: { code: 'MUST_LOAD_UNPLACED', severity: 'blockApproval', params: { packageId: 'PKG-003' } },
  LOADING_ORDER_INFEASIBLE: {
    code: 'LOADING_ORDER_INFEASIBLE',
    severity: 'error',
    packageInstanceId: 'PKG-001-02',
    relatedIds: ['PKG-001-01'],
    params: {},
  },
  DUPLICATE_INSTANCE_ID: {
    code: 'DUPLICATE_INSTANCE_ID',
    severity: 'error',
    packageInstanceId: 'PKG-001-01',
    relatedIds: ['PKG-001', 'PKG-001-01'],
    params: { occurrences: 2 },
  },
  ORIENTATION_MISMATCH: {
    code: 'ORIENTATION_MISMATCH',
    severity: 'error',
    packageInstanceId: 'PKG-001-01',
    params: { orientation: 'WLH' },
  },
  ORIENTATION_NOT_ALLOWED: {
    code: 'ORIENTATION_NOT_ALLOWED',
    severity: 'error',
    packageInstanceId: 'PKG-001-02',
    params: { orientation: 'HWL' },
  },
}

describe.each(LOCALES)('every constraint code has a finished sentence in %s', (locale) => {
  test.each(CONSTRAINT_CODES)('%s', (code) => {
    const message = messageOf(SAMPLE_ISSUES[code], locale)
    expect(message).not.toMatch(/[{}]|^issues\./)
  })

  test('the sentences read as reviewed', () => {
    expect(Object.fromEntries(CONSTRAINT_CODES.map((code) => [code, messageOf(SAMPLE_ISSUES[code], locale)]))).toMatchSnapshot()
  })

  test('codes whose sentence depends on axis, side or entity read as reviewed', () => {
    const boundary = (axis: 'x' | 'y' | 'z', side: 'beforeOrigin' | 'beyondInterior'): ConstraintIssue => ({
      ...SPEC_13_PKG_004_TOO_TALL,
      params: { axis, side, overCm: 3.5 },
    })
    const variants: ConstraintIssue[] = [
      boundary('x', 'beforeOrigin'),
      boundary('x', 'beyondInterior'),
      boundary('y', 'beforeOrigin'),
      boundary('y', 'beyondInterior'),
      boundary('z', 'beforeOrigin'),
      boundary('z', 'beyondInterior'),
      { code: 'DIMENSION_NOT_POSITIVE', severity: 'error', field: 'innerWidthCm', params: { entity: 'vehicle' } },
      {
        code: 'DIMENSION_NOT_POSITIVE',
        severity: 'error',
        field: 'lengthCm',
        params: { entity: 'obstacle', obstacleId: 'OBS-001' },
      },
      { code: 'DOOR_EXCEEDS_INNER', severity: 'error', field: 'doorWidthCm', params: { axis: 'y', doorCm: 250, innerCm: 240 } },
      { code: 'COG_LONGITUDINAL', severity: 'warning', params: { offsetCm: 95, limitCm: 90, toward: 'rear' } },
      { code: 'AXLE_OVERLOAD', severity: 'error', params: { group: 'front', loadKg: 3120, limitKg: 3000, overKg: 120 } },
    ]
    expect(variants.map((issue) => messageOf(issue, locale))).toMatchSnapshot()
  })
})

describe('issues built by the real validators read as sentences in both languages', () => {
  // Truck 6m breaking every vehicle rule that does not silence the others (a zero interior would skip obstacle checks)
  const brokenVehicle: VehicleConfig = {
    ...SPEC_TRUCK_6M,
    maxPayloadKg: 0,
    doorWidthCm: 250,
    obstacles: [
      { id: 'OBS-001', type: 'WHEEL_ARCH', xCm: 0, yCm: 0, zCm: 0, lengthCm: 0, widthCm: 30, heightCm: 45, loadBearing: false },
      // z 220..260 under a 250 cm ceiling
      { id: 'OBS-002', type: 'COOLING_UNIT', xCm: 0, yCm: 0, zCm: 220, lengthCm: 40, widthCm: 240, heightCm: 40, loadBearing: false },
      // x 10..20, z 225..245: inside OBS-002
      { id: 'OBS-003', type: 'PARTITION', xCm: 10, yCm: 0, zCm: 225, lengthCm: 10, widthCm: 240, heightCm: 20, loadBearing: false },
    ],
  }
  const brokenPackages: CargoPackage[] = [{ ...SPEC_CARTON_A, heightCm: 0, allowedOrientations: [] }]

  test.each(LOCALES)('%s', (locale) => {
    const issues = [...validateVehicle(brokenVehicle), ...validatePackages(brokenPackages)]
    expect(new Set(issues.map(({ code }) => code))).toStrictEqual(
      new Set(['DIMENSION_NOT_POSITIVE', 'DOOR_EXCEEDS_INNER', 'EXCEEDS_BOUNDARY', 'OBSTACLE_OVERLAP', 'NO_ALLOWED_ORIENTATION']),
    )
    expect(issues.map((issue) => messageOf(issue, locale))).toMatchSnapshot()
  })

  test.each(LOCALES)('stack checks in %s', (locale) => {
    const [wheelArch] = SPEC_TRUCK_6M.obstacles as [VehicleObstacle]
    const truck = { ...SPEC_TRUCK_6M, obstacles: [{ ...wheelArch, loadBearing: true, maxTopLoadKg: 20 }] }
    const column = ['C1', 'C2', 'C3'].map((id, level) => placed(id, [300, 0, 45 * level], [120, 60, 45]))
    const placements = [...column, placed('ON-ARCH', [0, 0, 45], [120, 30, 30]), placed('DRUM', [450, 0, 0], [60, 60, 90]), placed('BOX', [450, 0, 90], [40, 40, 20])]
    const carton = stackingProfile(30, { maxTopLoadKg: 40, maxStackCount: 2 })
    const graph = stackGraphOf(placements, {
      C1: carton,
      C2: carton,
      C3: carton,
      'ON-ARCH': stackingProfile(30),
      DRUM: stackingProfile(80, { stackable: false, maxTopLoadKg: 0 }),
      BOX: stackingProfile(4),
    }, truck)
    const issues = stackIssues(graph)
    expect(new Set(issues.map(({ code }) => code))).toStrictEqual(new Set(['TOP_LOAD_EXCEEDED', 'STACK_COUNT_EXCEEDED', 'NOT_STACKABLE']))
    expect(issues.map((issue) => messageOf(issue, locale))).toMatchSnapshot()
  })
})

describe('an issue missing what its sentence needs is a bug where it was built, not a sentence with a gap', () => {
  test('a placement issue without its package instance ID', () => {
    const { packageInstanceId: _, ...anonymous } = SPEC_13_PKG_004_TOO_TALL
    expect(() => messageOf(anonymous, 'vi')).toThrow(/EXCEEDS_BOUNDARY.*packageInstanceId/)
  })

  test('an overlap without the packages it overlaps', () => {
    expect(() => messageOf({ ...SAMPLE_ISSUES.OVERLAP, relatedIds: [] }, 'en')).toThrow(/OVERLAP.*relatedIds/)
  })

  test('a dimension issue on a field that has no label', () => {
    expect(() => messageOf({ ...SAMPLE_ISSUES.DIMENSION_NOT_POSITIVE, field: 'weightKg' }, 'en')).toThrow(/weightKg/)
  })
})
