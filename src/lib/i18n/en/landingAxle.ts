import type { Dictionary } from '../types'
import type { landingAxle as source } from '../vi/landingAxle'

export const landingAxle = {
  title: 'Axle loads within limits',
  lede: 'Move the cargo inside the sample truck and watch the front and rear axle loads follow — the same calculation the app uses to block approving a plan that overloads an axle.',
  figure: {
    frontWall: 'Front wall',
    door: 'Rear door',
    center: 'Centre of mass',
  },
  controls: {
    title: 'Cargo block',
    center: 'Cargo centre of mass, from the front wall',
    centerValue: '{value} from the front wall',
    weight: 'Cargo weight',
  },
  readout: {
    title: 'Load on each axle',
    groups: {
      front: 'Front axle',
      rear: 'Rear axle',
    },
    load: '{load} / {limit}',
    within: 'Within the limit',
    over: 'Over by {over}',
    added: 'Empty truck {empty} · cargo adds {cargo}',
    lifted: 'Empty truck {empty} · cargo lifts {cargo}',
  },
  announce: {
    within: '{group} {load}, within the limit of {limit}.',
    over: '{group} {load}, over the limit of {limit} by {over}.',
  },
  model: "The app's lever model: the closer the cargo's centre of mass is to an axle, the more that axle carries; the empty truck's load is added on top. The figures are estimates and do not replace weighing the axles.",
  source: 'Sample truck: box {dimensions}, payload {payload}. The front axle sits under the cab, {front} ahead of the front wall; the rear axle is {rear} behind the front wall. Axle positions, empty loads and limits are estimates by truck size, not checked against manufacturer data.',
} satisfies Dictionary<typeof source>
