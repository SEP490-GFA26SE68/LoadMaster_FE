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
  picker: {
    search: 'Find a place',
    searchPlaceholder: 'Type a province, district or industrial park',
    results: 'Matching places',
    noResults: 'No sample place matches "{query}". Type the coordinates in the two fields below.',
    kind: { PROVINCE: 'Province / city', DISTRICT: 'District', INDUSTRIAL_PARK: 'Industrial park' },
    lat: 'Latitude',
    lng: 'Longitude',
    clear: 'Clear coordinates',
    picked: 'Coordinates taken from {name}.',
    hint: 'Pick from the sample places (approximate, area-level coordinates) or type the latitude and longitude.',
    hintMap: 'Pick from the sample places, click the map, or type the latitude and longitude.',
    map: 'Map for picking coordinates',
    errors: {
      incomplete: { lat: 'Enter the latitude as well', lng: 'Enter the longitude as well' },
      invalid: { lat: 'Latitude is a number from −90 to 90', lng: 'Longitude is a number from −180 to 180' },
    },
  },
} satisfies Dictionary<typeof source>
