import type { Dictionary } from '../types'
import type { qr as source } from '../vi/qr'

export const qr = {
  imageLabel: 'QR code {token}',
  label: {
    poolId: 'Pool ID',
    senderCode: 'Sender code',
    handlingClass: 'Handling class',
    dimensions: 'Dimensions',
    weight: 'Weight',
    destination: 'Destination',
    fragile: 'Fragile',
  },
  scan: {
    camera: {
      starting: 'Opening the camera…',
      scanning: 'The camera is scanning. Center the QR code in the frame.',
      unsupported: 'This browser cannot scan QR codes with the camera. Type the code printed under the QR image.',
      denied: 'Camera access was not allowed. Type the code printed under the QR image.',
      failed: 'The camera could not be opened. Type the code printed under the QR image.',
    },
    manualLabel: 'Enter code',
    manualHint: 'The code is printed right under the QR image. Case and spaces do not matter.',
    manualRequired: 'Enter a code before confirming.',
    submit: 'Confirm code',
    close: 'Close',
  },
  verify: {
    levels: 'How to verify',
    codeLabel: 'QR code or sender code',
    codeHint: 'The code printed under the QR image, or the sender\'s package code printed on the label. Case does not matter.',
    codeRequired: 'Enter a code before verifying.',
    codeSubmit: 'Verify code',
    manualIntro: 'Use this when the label is torn, missing or unreadable. The dispatcher must approve a manual confirmation before this step can finish.',
    manualPackage: 'Package',
    manualReason: 'Reason',
    manualNote: 'Note',
    manualNoteHint: 'Required when you choose Other.',
    manualSubmit: 'Send manual confirmation',
    manualEmpty: 'There is no package to confirm manually at this step.',
    reprint: 'Reprint label {id}',
    errors: {
      packageRequired: 'Choose the package to confirm.',
      reasonRequired: 'Choose a reason.',
      noteRequired: 'A note is required when you choose Other.',
      noteTooLong: 'The note takes at most {max} characters.',
    },
    close: 'Close',
  },
} satisfies Dictionary<typeof source>
