import { describe, expect, test } from 'vitest'
import { TOPIC_IDS, type TopicId } from './assistant-kb'
import { matchTopic } from './assistant-match'
import { routeQuestion } from './assistant-route'
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

const router = (item: RouteCase): Routed => {
  const decision = routeQuestion(item.text, { inConversation: item.inConversation === true, locale: item.locale ?? 'vi' })
  return decision.route === 'PREPARED' ? decision.topicId : decision.route
}

describe('routeQuestion on the corpus (gate)', () => {
  test('no deep question is answered from prepared text, and no prepared answer is off-topic', () => {
    const result = score(router)
    console.info(report('bộ định tuyến', result))
    expect(result.deepServed).toStrictEqual([])
    expect(result.wrongTopic).toStrictEqual([])
  })
})

describe('routeQuestion', () => {
  const vi = { inConversation: false, locale: 'vi' } as const

  test('the gate also keeps most basic questions off the model', () => {
    const result = score(router)
    // 89/97 lúc chốt bộ định tuyến; sửa luật mà rớt dưới mức này là đã đẩy câu cơ bản sang mô hình
    expect(result.served).toBeGreaterThanOrEqual(85)
  })

  test('small talk is answered from the dictionary, even inside a model conversation', () => {
    expect(routeQuestion('Chào bạn', vi)).toStrictEqual({ route: 'SMALL_TALK', smallTalk: 'GREETING', reason: 'GREETING' })
    expect(routeQuestion('cảm ơn nhiều nhé', { ...vi, inConversation: true })).toMatchObject({ smallTalk: 'THANKS' })
    expect(routeQuestion('thx a lot', { inConversation: true, locale: 'en' })).toMatchObject({ smallTalk: 'THANKS' })
    expect(routeQuestion('bye', vi)).toMatchObject({ smallTalk: 'BYE' })
    expect(routeQuestion('oke', vi)).toMatchObject({ smallTalk: 'ACK' })
    expect(routeQuestion('👍', vi)).toMatchObject({ smallTalk: 'ACK' })
  })

  test('a greeting with a question is not small talk', () => {
    expect(routeQuestion('chào bạn, giá gói Pro bao nhiêu?', vi)).toMatchObject({ route: 'PREPARED', topicId: 'plans' })
  })

  test('a model conversation keeps going to the model', () => {
    expect(routeQuestion('Gói Pro giá bao nhiêu?', vi)).toMatchObject({ route: 'PREPARED', topicId: 'plans' })
    expect(routeQuestion('Gói Pro giá bao nhiêu?', { ...vi, inConversation: true })).toStrictEqual({ route: 'MODEL', reason: 'IN_CONVERSATION' })
  })

  test('deep signals send the question to the model, each with its reason code', () => {
    expect(routeQuestion('web lỗi không đăng nhập được', vi)).toMatchObject({ reason: 'FRUSTRATION' })
    expect(routeQuestion('bên mình có 20 xe thì nên chọn gói nào', vi)).toMatchObject({ route: 'MODEL' })
    expect(routeQuestion('gói Pro hơn gói Basic ở đâu', vi)).toMatchObject({ reason: 'COMPARISON' })
    expect(routeQuestion('không quét được mã thì sao', vi)).toMatchObject({ reason: 'CONDITION' })
    expect(routeQuestion('tải trục tính thế nào', vi)).toMatchObject({ reason: 'MECHANISM' })
    expect(routeQuestion('Tại sao cần quét mã?', vi)).toMatchObject({ reason: 'WHY' })
    expect(routeQuestion('còn gói kia?', vi)).toMatchObject({ reason: 'FOLLOW_UP' })
    expect(routeQuestion('Có xuất hoá đơn VAT không?', vi)).toMatchObject({ route: 'MODEL' })
    expect(routeQuestion('???', vi)).toStrictEqual({ route: 'MODEL', reason: 'EMPTY' })
  })

  test('"dữ liệu" is not the conditional "liệu"', () => {
    expect(routeQuestion('liệu có dùng thử được không', vi)).toMatchObject({ reason: 'CONDITION' })
    expect(routeQuestion('dữ liệu có tách riêng không', vi)).toMatchObject({ route: 'PREPARED', topicId: 'tenancy' })
  })
})
