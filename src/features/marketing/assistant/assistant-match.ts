import type { Locale } from '@/lib/i18n'
import { TOPICS, type Topic, type TopicId } from './assistant-kb'
import { chatText } from './assistant-chat-text'

export { matchText } from './assistant-chat-text'

/**
 * Khớp câu hỏi với một chủ đề của bộ câu trả lời (thuần). Câu hỏi qua bước chuẩn hoá chung `chatText` (bỏ dấu, chữ thường, mọi ký tự
 * ngoài a–z 0–9 thành khoảng trắng, mở chữ viết tắt kiểu nhắn tin); một cụm từ khoá chỉ khớp trọn từ ("gia" không khớp trong "giao"). Cụm
 * khớp được (số từ + 1) điểm, từ gợi ý 1 điểm; chủ đề điểm cao nhất thắng, hoà thì chủ đề đứng trước trong `TOPICS`. Dưới `MIN_SCORE` là
 * không khớp — trợ lý nói thẳng là chưa có câu trả lời.
 */
export const MIN_SCORE = 2

export type TopicScore = { readonly id: TopicId; readonly score: number }

function contains(padded: string, phrase: string): boolean {
  return padded.includes(` ${phrase} `)
}

/** Điểm của một chủ đề trên câu đã chuẩn hoá (`chatText`). */
function scoreNormalized(normalized: string, topic: Topic): number {
  const padded = ` ${normalized} `
  const keywordScore = topic.keywords
    .filter((phrase) => contains(padded, phrase))
    .reduce((sum, phrase) => sum + phrase.split(' ').length + 1, 0)
  const hintScore = (topic.hints ?? []).filter((word) => contains(padded, word)).length
  return keywordScore + hintScore
}

export function scoreTopic(question: string, topic: Topic, locale: Locale = 'vi'): number {
  return scoreNormalized(chatText(question, locale), topic)
}

/** Điểm mọi chủ đề trên một câu đã chuẩn hoá, cao trước (hoà thì giữ thứ tự của `TOPICS`). */
export function rankTopics(normalized: string): TopicScore[] {
  return TOPICS.map((topic) => ({ id: topic.id, score: scoreNormalized(normalized, topic) })).sort((a, b) => b.score - a.score)
}

export function matchTopic(question: string, locale: Locale = 'vi'): TopicId | null {
  const best = rankTopics(chatText(question, locale))[0]
  return best !== undefined && best.score >= MIN_SCORE ? best.id : null
}
