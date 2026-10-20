import type { Dictionary } from '../types'
import type { landingCompare as source } from '../vi/landingCompare'

export const landingCompare = {
  title: 'Compared with the way you work now',
  lede: 'The same jobs on every trip: done with spreadsheets and judgement by eye, or on one plan that the dispatcher, the warehouse and the driver all follow.',
  table: {
    caption: 'Spreadsheets and LoadMaster, job by job on a trip',
    job: 'Job',
    manual: 'Spreadsheets and judgement by eye',
    app: 'With LoadMaster',
  },
  rows: {
    plan: {
      job: 'Planning the load',
      manual: 'Add up volumes in a spreadsheet and judge by eye; whether it fits is only known once the warehouse tries.',
      app: 'One optimization run gives three 3D plans for three goals: most volume, balanced axle loads, least rehandling. Compare, adjust by hand, then approve one.',
    },
    axle: {
      job: 'Checking axle loads and centre of mass',
      manual: 'Usually only the total weight is checked against the payload; cargo bunched at one end of the box is hard to spot before the truck leaves.',
      app: 'Front and rear axle loads computed from the axle data of each truck, with warnings for an off-centre load. A plan that overloads an axle cannot be approved.',
    },
    unload: {
      job: 'Unloading order by stop',
      manual: 'Remember which package comes off first; cargo for a later stop blocking the door has to be unloaded and reloaded.',
      app: "The box is split into zones by stop: the last stop's cargo sits deepest, the first stop's by the door. Packages blocking the way out or outside their zone are marked, and rehandling is counted.",
    },
    verify: {
      job: 'Checking packages at staging, loading and delivery',
      manual: 'Count by hand against a printed list; a missing or wrong package is hard to trace back to who did what, and when.',
      app: 'Every package is checked when staged, loaded and unloaded: scan the QR code, type the code, or confirm by hand pending dispatcher approval. Each check records who and when.',
    },
    track: {
      job: 'Tracking the trip and arrival times',
      manual: 'Call the driver to ask where they are, then work out the arrival time yourself.',
      app: 'Truck position on the map, estimated arrival at each stop against its deadline, late-risk warnings and incidents on the road.',
    },
    report: {
      job: 'Trip reports',
      manual: 'Pieced together from delivery notes, messages and jottings after the trip.',
      app: 'A report for every trip: arrival against deadline at each stop, returned packages, how packages were checked, incidents. Managers follow the dashboard and export .xlsx reports.',
    },
  },
  fit: {
    title: 'A good fit for',
    items: {
      fleet: 'Small and medium transport companies carrying packages and cartons to several stops per trip.',
      team: 'Teams where a dispatcher builds trips, warehouse staff stage and load, and drivers deliver stop by stop.',
      cargo: 'Cargo that must keep its unloading order, stay upright or limit stacking; fragile, chilled or hazardous goods that need separate trips by class.',
    },
  },
  prepare: {
    title: 'What to prepare',
    vehicles: {
      title: 'Truck list',
      text: 'Inner box size, rear door, payload; position, empty load and limit of each axle; obstacles in the box such as wheel arches or a cooling unit.',
    },
    packages: {
      title: 'Package list',
      text: 'An .xlsx file from the template, one package per row, with the columns:',
      columns: 'Columns of the package template',
      optional: '{column} (optional)',
    },
    stops: {
      title: 'Delivery stops',
      text: 'Address and coordinates of each stop for route optimization; a deadline if there is one.',
    },
    people: {
      title: 'People and devices',
      text: 'Accounts for dispatchers, warehouse staff and drivers; a computer for dispatch, tablets in the warehouse, phones for drivers, an A4 printer for QR labels.',
    },
  },
  missing: {
    title: 'Not available yet',
    text: 'A ready-made connection to accounting or ERP software. Packages come in through an .xlsx file or are added by hand.',
  },
} satisfies Dictionary<typeof source>
