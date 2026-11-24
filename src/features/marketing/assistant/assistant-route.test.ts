import { describe, expect, test } from 'vitest'
import { TOPIC_IDS, type TopicId } from './assistant-kb'
import { matchTopic } from './assistant-match'
import { ROUTE_CORPUS, type RouteCase } from './assistant-route-corpus'

/** Mức một bộ định tuyến chọn cho một câu: `MODEL`, `SMALL_TALK` hay mã chủ đề của câu soạn sẵn. */
type Routed = 'MODEL' | 'SMALL_TALK' | TopicId

type Score = {
  readonly total: number
  /** Câu cần mô hình mà bị trả bằng câu soạn sẵn hay câu xã giao — chỉ số chặn. */
  readonly deepServed: readonly string[]
  /** Câu soạn sẵn / xã giao bị trả sai mức hay sai chủ đề — chỉ số chặn. */
  readonly wrongTopic: readonly string[]
  /** Câu soạn sẵn / xã giao trả đúng mà không gọi mô hình. */
  readonly served: number
  /** Số câu mang nhãn soạn sẵn / xã giao. */
  readonly servable: number
}

function score(route: (item: RouteCase) => Routed): Score {
  const deepServed: string[] = []
  const wrongTopic: string[] = []
  let served = 0
  let servable = 0
  for (const item of ROUTE_CORPUS) {
    const routed = route(item)
    if (item.expect !== 'MODEL') servable += 1
    if (routed === 'MODEL') continue
    if (item.expect === 'MODEL') deepServed.push(`${item.text} → ${routed}`)
    else if (routed !== item.expect) wrongTopic.push(`${item.text} → ${routed} (đúng: ${item.expect})`)
    else served += 1
  }
  return { total: ROUTE_CORPUS.length, deepServed, wrongTopic, served, servable }
}

const percent = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`

function report(name: string, result: Score): string {
  return [
    `${name}: ${result.total} câu`,
    `trả đúng không gọi mô hình ${result.served}/${result.servable} (${percent(result.served, result.servable)} câu soạn sẵn / xã giao, ${percent(result.served, result.total)} cả bộ)`,
    `câu sâu bị trả sẵn ${result.deepServed.length}`,
    `sai chủ đề ${result.wrongTopic.length}`,
  ].join(' · ')
}

/** Bộ khớp từ khoá cũ coi như bộ định tuyến: khớp được chủ đề là trả câu soạn sẵn, không thì hỏi mô hình. */
const legacyRoute = (item: RouteCase): Routed => matchTopic(item.text) ?? 'MODEL'

describe('route corpus', () => {
  test('150–200 distinct customer questions, each labelled with a real level', () => {
    expect(ROUTE_CORPUS.length).toBeGreaterThanOrEqual(150)
    expect(ROUTE_CORPUS.length).toBeLessThanOrEqual(200)
    expect(new Set(ROUTE_CORPUS.map((item) => `${item.inConversation === true}:${item.text}`)).size).toBe(ROUTE_CORPUS.length)
    const levels = new Set<string>(['MODEL', 'SMALL_TALK', ...TOPIC_IDS])
    expect(ROUTE_CORPUS.filter((item) => !levels.has(item.expect))).toStrictEqual([])
    // Mỗi chủ đề có ít nhất một câu trả sẵn được, để cổng thấy khi một chủ đề bị khớp sai
    for (const id of TOPIC_IDS) expect([id, ROUTE_CORPUS.some((item) => item.expect === id)]).toStrictEqual([id, true])
  })

  test('the legacy keyword matcher, measured as a router (baseline)', () => {
    const result = score(legacyRoute)
    console.info(report('bộ khớp cũ', result))
    expect(result.total).toBe(ROUTE_CORPUS.length)
  })
})
