import type { Dictionary } from '../types'
import type { qr as source } from '../vi/qr'

export const qr = {
  imageLabel: 'QR code {token}',
  scan: {
    camera: {
      starting: 'Opening the camera…',
      scanning: 'The camera is scanning. Center the QR code in the frame.',
      unsupported: 'This browser cannot scan QR codes with the camera. Type the code printed under the QR image or pick it from the list.',
      denied: 'Camera access was not allowed. Type the code printed under the QR image or pick it from the list.',
      failed: 'The camera could not be opened. Type the code printed under the QR image or pick it from the list.',
    },
    manualLabel: 'Enter code',
    manualHint: 'The code is printed right under the QR image. Case and spaces do not matter.',
    manualRequired: 'Enter a code before confirming.',
    submit: 'Confirm code',
    pickTitle: 'Or pick from the list',
    close: 'Close',
  },
} satisfies Dictionary<typeof source>
