import type { Dictionary } from '../types'
import type { plannerPhysics as source } from '../vi/plannerPhysics'

export const plannerPhysics = {
  duration: {
    seconds: '{seconds} s',
    minutes: '{minutes} min',
    minutesSeconds: '{minutes} min {seconds} s',
    hoursMinutes: '{hours} h {minutes} min',
  },
  estimate: {
    loading: 'Loading ≈ {duration}',
    unloading: 'Unloading ≈ {duration}',
    caption: 'Estimated real time',
    trigger: 'Estimated real time of the {pass} pass: {duration}. Show assumptions',
    passes: { loading: 'loading', unloading: 'unloading' },
  },
  speed: {
    label: 'Playback speed relative to real time',
    option: '×{scale}',
  },
  assumptions: {
    title: 'Estimated from manual-handling assumptions — not the company’s own measurements',
    speed: 'Top carrying speed {value} m/s',
    acceleration: 'Carrying acceleration {value} m/s²',
    handling: 'Handling per package (pick, place, scan) {value} s',
    distance: 'Carry distance: from the package centre to the rear door, along the body',
    moved: 'Unloading adds two carries for every later-stop package blocking the straight way out',
    playback: 'At ×{scale}, one second on screen is {scale} real seconds',
  },
  atStep: 'At step {step} / {total}',
  gravity: {
    title: 'Cargo center of gravity (G)',
    fromFront: '{value} from the front wall',
    lateral: 'Lateral offset {value}',
    height: 'Height {value}',
    description: 'Cargo center of gravity G: {x} from the front wall, {y} lateral offset from the body centre line, {z} above the floor.',
    empty: 'No package is on the truck at this step.',
  },
  estimateTag: 'Estimate',
  unloadTime: {
    title: 'Estimated unloading time',
    stop: 'Stop {number} · {name}',
    value: '≈ {duration}',
    moved: { one: 'Move {count} blocking package', other: 'Move {count} blocking packages' },
    total: 'Whole trip ≈ {duration}',
    note: 'Only carrying inside the body; parking, opening the doors and signing are not included.',
  },
} satisfies Dictionary<typeof source>
