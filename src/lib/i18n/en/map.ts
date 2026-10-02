import type { Dictionary } from '../types'
import type { map as source } from '../vi/map'

export const map = {
  points: 'Points on the map, in visiting order',
  depot: 'Departure depot: {name}',
  stop: 'Stop {number}: {name}',
  vehicle: 'Vehicle position: {name}',
  canvas: 'Interactive map',
  zoomIn: 'Zoom in',
  zoomOut: 'Zoom out',
  fit: 'Show the whole route',
  keyboardHint: 'While the map is focused: + and − zoom in and out; the arrow keys move the map.',
  attribution: 'Show or hide the map data sources',
  gestures: {
    ctrl: 'Hold Ctrl and scroll to zoom the map',
    command: 'Hold ⌘ and scroll to zoom the map',
    touch: 'Use two fingers to move the map',
  },
} satisfies Dictionary<typeof source>
