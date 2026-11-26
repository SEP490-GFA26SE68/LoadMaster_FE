import type { Dictionary } from '../types'
import type { physicalData as source } from '../vi/physicalData'

export const physicalData = {
  sigma: {
    label: 'Top load capacity',
    hint: 'The most weight each m² of the package top can carry. Leave it empty when there is no figure — no value is filled in for you.',
    packageLabel: 'Top load capacity for this package',
    packageHint: 'Overrides the package type value. Leave it empty to use the package type value.',
  },
  mckee: {
    toggle: 'Estimate for a corrugated box',
    description: 'Computed from the board edge crush strength and thickness; the base perimeter and top area come from the package type length and width.',
    ect: 'Edge crush strength (ECT)',
    ectHint: 'For example: 32 lb/in ≈ 5,604 N/m.',
    thickness: 'Board thickness',
    safetyFactor: 'Safety factor',
    safetyFactorHint: 'Allows for humidity, storage time and vibration in transit; usually above 2.',
    needDimensions: 'Enter the package type length and width to compute the base perimeter and top area.',
    needInputs: 'Enter the edge crush strength, board thickness and safety factor (all above 0) to see the result.',
    perimeter: 'Base perimeter',
    area: 'Top area',
    boxCompression: 'Box compression strength',
    result: 'Estimated top load capacity',
    use: 'Use this value',
    formula: 'Box compression ≈ 5.87 × ECT × √(thickness × base perimeter); top load capacity ≈ box compression ÷ (safety factor × 9.81 × top area).',
    limits:
      'The formula only holds for empty single-wall regular slotted cartons (RSC) tested in a laboratory. Expect large errors for boxes with holes, multi-wall boards or offset stacking.',
  },
  vehicle: {
    floorLoad: 'Floor load capacity',
    floorLoadHint: 'The most weight each m² of the cargo floor can carry. Leave it empty to skip the floor load check.',
    cogY: 'Maximum lateral centre of gravity offset',
    cogYHint: 'As a % of the cargo width. Leave it empty to use the longitudinal limit.',
  },
  errors: {
    nonNegative: 'Enter a number of 0 or more.',
    positive: 'Enter a number above 0.',
    decimalScale: 'Use at most two decimal places.',
    cannotClear: 'The server cannot clear a saved value yet: enter a new value, or keep the old one.',
  },
  warnings: {
    title: 'Missing package data',
    TOP_LOAD_CAPACITY_MISSING: {
      one: '{count} package has no top load capacity — enter it on the package type or on the package.',
      other: '{count} packages have no top load capacity — enter it on the package type or on each package.',
    },
    PACKAGE_TYPE_MISSING: {
      one: '{count} package has no package type, so it is not rotated when loading.',
      other: '{count} packages have no package type, so they are not rotated when loading.',
    },
    codes: 'Packages: {codes}',
    more: {
      one: 'and {count} more package',
      other: 'and {count} more packages',
    },
    openPackages: 'Open Package pool',
    openPackageTypes: 'Open Package types',
  },
} satisfies Dictionary<typeof source>
