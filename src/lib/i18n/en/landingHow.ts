import type { Dictionary } from '../types'
import type { landingHow as source } from '../vi/landingHow'

/**
 * "How is this worked out?" on the figures of the public pages (`features/marketing/HowComputed`): the opening 3D stage, "Try it with your
 * cargo" (plan cards, the Axle load tab) and the `/phuong-an-mau` page. Each sentence states the formula in plain words; the parameters
 * are the figures of the run itself. No algorithm names; public pages say "simulated optimizer".
 */
export const landingHow = {
  toggle: 'How is this worked out?',
  toggleFor: 'How is this worked out? — {subject}',
  source: 'Every figure is worked out by LoadMaster’s simulated optimizer in your browser, from this very run.',
  placed: {
    label: 'Loaded',
    text: 'Count of packages that have a place in the body: {placed} of the {total} packages in the run.',
  },
  volume: {
    label: 'Volume fill',
    text: 'Total volume of the {placed} loaded packages ({used}) ÷ volume of the truck body ({total}) = {value}.',
  },
  payload: {
    label: 'Payload used',
    text: 'Total weight of the {placed} loaded packages ({used}) ÷ truck payload ({max}) = {value}.',
  },
  axleGap: {
    label: 'Axle load gap',
    text: 'Usage of each axle group = load ÷ limit. Front: {frontLoad} ÷ {frontLimit} = {front}. Rear: {rearLoad} ÷ {rearLimit} = {rear}. They differ by {value} points.',
  },
  rehandling: {
    label: 'Re-handled packages',
    text: 'The floor is split into zones by delivery stop, first stop at the door. A package whose centre sits in another stop’s zone counts as one re-handling: {value} of the {placed} loaded packages.',
  },
  unplaced: {
    label: 'Not loaded',
    text: '{total} packages in the run − {placed} loaded = {value}.',
  },
  balance: {
    label: 'Centre of gravity off mid-body',
    text: 'The cargo’s centre of gravity is {center} from the front wall; mid-body is at {middle}. The offset is {value}.',
  },
  axle: {
    shareLabel: 'Cargo shared between the two axles',
    share: 'The rear axle takes {mass} × distance from the centre of gravity to the front axle ({arm}) ÷ distance between the axles ({wheelbase}) = {rear}. The rest, {front}, goes to the front axle.',
    shareLift: 'The rear axle takes {mass} × distance from the centre of gravity to the front axle ({arm}) ÷ distance between the axles ({wheelbase}) = {rear}. The centre of gravity sits behind the rear axle, so the cargo lifts {front} off the front axle.',
    frontLabel: 'Front axle load',
    rearLabel: 'Rear axle load',
    load: 'Load of the empty truck {empty} + cargo share {cargo} = {value}; the axle limit is {limit}.',
  },
} as const satisfies Dictionary<typeof source>
