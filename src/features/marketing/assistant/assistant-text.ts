/**
 * Chữ của mô hình thành khối để vẽ (thuần): đoạn văn (cách nhau bằng dòng trống, tiêu đề `#` là một đoạn riêng), danh sách gạch đầu dòng
 * (`-`, `*`, `•`) và danh sách bước (`1.`, `2)`). Dấu định dạng Markdown (`**`, `__`, `` ` ``, `#`) bị bỏ — màn vẽ bằng phần tử thường,
 * không bao giờ đưa HTML của mô hình vào trang.
 */
export type AnswerBlock =
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'bullets' | 'steps'; readonly items: readonly string[] }

type ListKind = 'bullets' | 'steps'

const HEADING = /^#{1,6}\s+(.+)$/
const BULLET = /^[-*•]\s+(.+)$/
const STEP = /^\d{1,3}[.)]\s+(.+)$/

const plain = (text: string) => text.replace(/\*\*|__|`/g, '').trim()

function listItem(line: string): { kind: ListKind; text: string } | null {
  const bullet = BULLET.exec(line)
  if (bullet) return { kind: 'bullets', text: plain(bullet[1] ?? '') }
  const step = STEP.exec(line)
  return step ? { kind: 'steps', text: plain(step[1] ?? '') } : null
}

export function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = []
  const state: { paragraph: string[]; list: { kind: ListKind; items: string[] } | null } = { paragraph: [], list: null }
  const close = () => {
    if (state.paragraph.length > 0) blocks.push({ kind: 'paragraph', text: state.paragraph.join('\n') })
    if (state.list !== null) blocks.push(state.list)
    state.paragraph = []
    state.list = null
  }

  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    const title = HEADING.exec(line)?.[1]
    const item = listItem(line)
    if (line === '' || title !== undefined) {
      close()
      if (title !== undefined && plain(title) !== '') blocks.push({ kind: 'paragraph', text: plain(title) })
    } else if (item) {
      if (state.list?.kind !== item.kind) close()
      state.list ??= { kind: item.kind, items: [] }
      if (item.text !== '') state.list.items.push(item.text)
    } else {
      if (state.list !== null) close()
      if (plain(line) !== '') state.paragraph.push(plain(line))
    }
  }
  close()
  return blocks
}
