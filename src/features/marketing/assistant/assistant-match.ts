import { normalizeSearchText } from '@/lib/list-filter'
import { TOPICS, type Topic, type TopicId } from './assistant-kb'

/**
 * Khớp câu hỏi với một chủ đề của bộ câu trả lời (thuần). Câu hỏi bỏ dấu, chữ thường, mọi ký tự ngoài a–z 0–9 thành khoảng trắng; một cụm
 * từ khoá chỉ khớp trọn từ ("gia" không khớp trong "giao"). Cụm khớp được (số từ + 1) điểm, từ gợi ý 1 điểm; chủ đề điểm cao nhất thắng,
 * hoà thì chủ đề đứng trước trong `TOPICS`. Dưới `MIN_SCORE` là không khớp — trợ lý nói thẳng là chưa có câu trả lời.
 */
export const MIN_SCORE = 2

/** Dạng so của một câu: bỏ dấu, chữ thường, chỉ còn chữ và số cách nhau một khoảng trắng. */
export function matchText(text: string): string {
  return normalizeSearchText(text).replace(/[^a-z0-9]+/g, ' ').trim()
}

function contains(padded: string, phrase: string): boolean {
  return padded.includes(` ${phrase} `)
}

export function scoreTopic(question: string, topic: Topic): number {
  const padded = ` ${matchText(question)} `
  const keywordScore = topic.keywords
    .filter((phrase) => contains(padded, phrase))
    .reduce((sum, phrase) => sum + phrase.split(' ').length + 1, 0)
  const hintScore = (topic.hints ?? []).filter((word) => contains(padded, word)).length
  return keywordScore + hintScore
}

export function matchTopic(question: string): TopicId | null {
  let best: { id: TopicId; score: number } | null = null
  for (const topic of TOPICS) {
    const score = scoreTopic(question, topic)
    if (score >= MIN_SCORE && (best === null || score > best.score)) best = { id: topic.id, score }
  }
  return best?.id ?? null
}
