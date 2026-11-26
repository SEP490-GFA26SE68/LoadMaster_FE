import { expect, test } from 'vitest'
import { mergeReplies, noteOfReplies, requestAttachmentsOfNote, supportNoteOfNote } from './support-chat'

test('reads request attachments and preserves a plain support note from resolutionNote', () => {
  const note = JSON.stringify([
    { type: 'requestAttachments', images: ['data:image/png;base64,request'] },
    { type: 'supportNote', text: 'Existing support note' },
  ])

  expect(requestAttachmentsOfNote(note)).toStrictEqual(['data:image/png;base64,request'])
  expect(supportNoteOfNote(note)).toBe('Existing support note')
  expect(supportNoteOfNote('Plain legacy note')).toBe('Plain legacy note')
})

test('merges resolutionNote and reply-table messages in order without duplicating migrated replies', () => {
  const imageReply = {
    authorId: '7', authorName: 'Requester', authorRole: 'dispatcher' as const, text: 'First reply',
    at: '2026-11-25T01:00:00.000Z', images: ['data:image/png;base64,reply'],
  }
  const tableDuplicate = { ...imageReply, authorId: '', images: undefined }
  const tableReply = {
    authorId: '4', authorName: 'Support', authorRole: 'systemSupporter' as const, text: 'Second reply',
    at: '2026-11-26T01:00:00.000Z',
  }

  const merged = mergeReplies([imageReply], [tableDuplicate, tableReply])

  expect(merged.map(({ text }) => text)).toStrictEqual(['First reply', 'Second reply'])
  expect(merged[0]?.images).toStrictEqual(['data:image/png;base64,reply'])
})

test('serializes replies without dropping request image or support-note entries', () => {
  const reply = {
    authorId: '7', authorName: 'Requester', authorRole: 'dispatcher' as const, text: 'Follow-up',
    at: '2026-11-26T01:00:00.000Z', images: ['data:image/jpeg;base64,follow-up'],
  }
  const existingNote = JSON.stringify([
    { type: 'requestAttachments', images: ['data:image/png;base64,request'] },
    { type: 'supportNote', text: 'Existing support note' },
  ])

  const serialized = JSON.parse(noteOfReplies([reply], existingNote)) as unknown[]

  expect(serialized).toStrictEqual([
    { type: 'requestAttachments', images: ['data:image/png;base64,request'] },
    { type: 'supportNote', text: 'Existing support note' },
    { ...reply, at: '2026-11-26 08:00:00' },
  ])
})
