import type { Locale } from '@/lib/i18n'
import type { TopicId } from './assistant-kb'
import { chatText, matchText } from './assistant-chat-text'
import { MIN_SCORE, rankTopics } from './assistant-match'
import { TOPIC_VOCAB, STOP_WORDS } from './assistant-route-words'

/**
 * Bộ định tuyến của trợ lý "Hỏi Lumo" (thuần): một câu gõ được trả ở mức nào —
 *
 * - `SMALL_TALK`: chào, cảm ơn, tạm biệt, "ok" → câu xã giao ngắn của từ điển kèm câu hỏi gợi ý, không gọi mô hình kể cả khi đang nói
 *   tiếp với mô hình;
 * - `PREPARED`: câu soạn sẵn của một chủ đề **trả lời đủ** câu hỏi → không gọi mô hình;
 * - `MODEL`: mọi câu còn lại.
 *
 * Chất lượng là ưu tiên số một: thà gọi mô hình còn hơn trả câu soạn sẵn qua loa hay sai chủ đề. Nên `PREPARED` chỉ khi đủ cả: không đang
 * nói tiếp với mô hình; khớp đúng một chủ đề (chủ đề thứ hai dưới ngưỡng); câu ngắn, một ý; không có tín hiệu sâu (bực / báo lỗi, cố lừa,
 * hỏi tiếp, nhiều ý, có số, so sánh, điều kiện, kể chuyện công ty mình, "tại sao", "tính thế nào", "là gì", "thế nào" ở chủ đề mà câu soạn
 * sẵn không giải thích cách làm); và **mọi chữ** của câu đều nằm trong từ vựng của chủ đề hay là chữ chức năng — một chữ lạ ("VAT",
 * "iPhone", "CSV") là chi tiết câu soạn sẵn không nói tới. `reason` là mã để đếm và test, không phải câu chữ.
 */
export type Route = 'SMALL_TALK' | 'PREPARED' | 'MODEL'
export type SmallTalkKind = 'GREETING' | 'THANKS' | 'BYE' | 'ACK'

export type RouteReason =
  | SmallTalkKind
  | 'TOPIC'
  | 'EMPTY'
  | 'FRUSTRATION'
  | 'MANIPULATION'
  | 'IN_CONVERSATION'
  | 'FOLLOW_UP'
  | 'MULTI_PART'
  | 'LONG'
  | 'QUANTITY'
  | 'COMPARISON'
  | 'CONDITION'
  | 'OWN_CONTEXT'
  | 'WHY'
  | 'MECHANISM'
  | 'DEFINITION'
  | 'NO_TOPIC'
  | 'AMBIGUOUS'
  | 'HOW'
  | 'SPECIFIC'

export type RouteDecision =
  | { readonly route: 'SMALL_TALK'; readonly smallTalk: SmallTalkKind; readonly reason: SmallTalkKind }
  | { readonly route: 'PREPARED'; readonly topicId: TopicId; readonly reason: 'TOPIC' }
  | { readonly route: 'MODEL'; readonly reason: Exclude<RouteReason, SmallTalkKind | 'TOPIC'> }

export type RouteOptions = {
  /** Đã có hội thoại với mô hình (câu trả lời của mô hình hay một lần "hỏi chi tiết"): câu sau, trừ xã giao, nói tiếp với mô hình. */
  readonly inConversation: boolean
  readonly locale: Locale
}

/**
 * Câu dài hơn chừng này chữ là câu kể nhiều — câu gợi ý dài nhất ("How do you make sure the right package is loaded and delivered?") có
 * 12 chữ; câu khách gõ một ý về một chủ đề hiếm khi dài hơn.
 */
export const MAX_PREPARED_WORDS = 14

/** Chữ xã giao: câu chỉ gồm những chữ này là câu xã giao. Mỗi nhóm một kiểu câu đáp; câu có nhiều nhóm lấy nhóm đứng trước. */
const SMALL_TALK_WORDS: readonly (readonly [SmallTalkKind, readonly string[]])[] = [
  ['BYE', ['tam biet', 'bye', 'goodbye', 'bai', 'see you', 'hen gap lai']],
  ['THANKS', ['cam on', 'thanks', 'thank you', 'thank', 'many thanks', 'appreciate it']],
  ['GREETING', ['xin chao', 'chao', 'hi', 'hello', 'hey', 'alo', 'lumo oi', 'ban oi', 'admin oi', 'em oi', 'good morning', 'good afternoon', 'good evening']],
  ['ACK', ['ok', 'duoc roi', 'hieu roi', 'vang', 'da', 'u', 'great', 'cool', 'got it', 'nice', 'tuyet', 'hay qua']],
]
/** Chữ đệm đi cùng câu xã giao ("cảm ơn bạn nhiều nhé", "thanks a lot"). */
const SMALL_TALK_FILLER = new Set([
  'ban', 'oi', 'lumo', 'admin', 'nhe', 'nha', 'a', 'ah', 'nhieu', 'lam', 'minh', 'em', 'anh', 'chi', 'roi', 'so', 'much',
  'very', 'lot', 'you', 'there', 'again', 'all', 'hihi', 'haha', 'nhen', 'luon', 'qua',
])

/** Một cụm có nằm trọn từ trong câu đã chuẩn hoá (đã chèn khoảng trắng hai đầu). */
const has = (padded: string, phrases: readonly string[]) => phrases.some((phrase) => padded.includes(` ${phrase} `))

function smallTalkOf(normalized: string): SmallTalkKind | null {
  let rest = ` ${normalized} `
  const kinds: SmallTalkKind[] = []
  for (const [kind, phrases] of SMALL_TALK_WORDS) {
    for (const phrase of [...phrases].sort((a, b) => b.length - a.length)) {
      if (rest.includes(` ${phrase} `)) {
        kinds.push(kind)
        rest = rest.split(` ${phrase} `).join('  ')
      }
    }
  }
  const leftover = rest.split(' ').filter((token) => token !== '' && !SMALL_TALK_FILLER.has(token))
  if (leftover.length > 0) return null
  return SMALL_TALK_WORDS.find(([kind]) => kinds.includes(kind))?.[0] ?? null
}

/** Bực, phàn nàn, báo lỗi, gấp: luôn để mô hình đáp (xét trên câu chưa mở viết tắt nữa — "hỏng" và "hong" là một chữ). */
const FRUSTRATION = [
  'error', 'errors', 'bug', 'su co', 'hong roi', 'bi hong', 'khong dang nhap', 'khong vao', 'ko vao', 'k vao',
  'khong hoat dong', 'khong chay', 'khong hien', 'khong thay', 'khong duoc nua', 'van khong', 'cham qua', 'cham the', 'te qua', 'te the',
  'chan qua', 'buc', 'buc minh', 'khan cap', 'tru tien', 'mat tien', 'hoan tien', 'chua co credit', 'lua dao', 'urgent',
  'asap', 'not working', 'doesn t work', 'does not work', 'broken', 'crash', 'crashing', 'refund', 'terrible', 'awful', 'worst', 'angry',
  'scam', 'wtf', 'can t log', 'cannot log', 'charged twice',
]
/** "lỗi" — không phải "trả lời", "câu trả lời", "lợi ích", "lợi thế", "lợi hơn" (cùng viết "loi" khi bỏ dấu). */
const ERROR_LOI = /(?<!tra )\bloi\b(?! ich| the| hon| nhat)/
/** Tiếng "gặp" ("gặp người tư vấn") viết không dấu cũng là "gap": chỉ coi là gấp khi đứng đầu câu hay đi với "giúp", "lắm". */
const URGENT_GAP = /^gap |\bgap (giup|lam|nhe|di)\b|\bsua gap\b|\bcan gap\b/

const MANIPULATION = [
  'bo qua', 'ignore', 'instructions', 'huong dan truoc', 'system prompt', 'prompt', 'gia vo', 'pretend', 'dong vai', 'role play',
  'jailbreak', 'developer mode', 'quen het', 'forget', 'chatgpt', 'gpt', 'tiet lo', 'reveal', 'admin day', 'toi la admin',
  'khach hang khac', 'tat ca cong ty', 'liet ke tat ca', 'cong ty dang dung', 'phai ai', 'la ai khong', 'are you a bot', 'are you ai',
  'are you human', 'nguoi that khong', 'la bot', 'is this ai',
]

/** Câu hỏi tiếp trỏ về lượt trước ("còn gói kia?", "cái đó thì sao") — câu soạn sẵn không biết "kia", "đó" là gì. */
const FOLLOW_UP_START = /^(con|the con|vay con|vay thi|the thi|con cai|and|what about|how about|also)\b/
const FOLLOW_UP = [
  'cai do', 'cai nay', 'cai kia', 'goi kia', 'goi do', 'goi con lai', 'no', 'the other', 'that one', 'this one', 'the same', 'cai tren',
  'nhu tren', 'vua roi', 'luc nay',
]

const MULTI_PART = ['ngoai ra', 'them nua', 'con nua', 'va co', 'va cach', 'va gia', 'and do', 'and is', 'and how', 'and what', 'as well']

const COMPARISON = [
  'so voi', 'so sanh', 'khac gi', 'khac nhau', 'khac biet', 'hon', 're nhat', 'tot nhat', 'hop nhat', 'dat nhat', 'loi nhat',
  'nhieu nhat', 'it nhat', 'cai nao', 'loai nao', 'hay la', 'versus', 'compare',
  'comparison', 'difference', 'different', 'better', 'cheaper', 'cheapest', 'best value', 'or',
]
/** "hay" là "hoặc" — trừ "có … hay không" là câu hỏi có / không thường. */
const OR_HAY = /\bhay\b(?! khong)/

/**
 * "Không quét được mã thì sao", "mất nhãn thì làm sao": một trục trặc kèm "thì sao" là hỏi điều gì xảy ra khi đó — câu soạn sẵn chỉ nói lúc
 * mọi thứ chạy đúng. "Cần hỗ trợ khi đang dùng thì sao?" không có chữ trục trặc nên vẫn là câu hỏi thường.
 */
/** "liệu … có" là hỏi điều kiện — trừ "dữ liệu" (cùng viết "lieu" khi bỏ dấu). */
const LIEU = /(?<!du )\blieu\b/

const TROUBLE_THEN = /\b(khong|chua|het|mat|hong|sai|nham|quen|bi)\b.*\bthi (sao|lam sao|the nao)\b/

const CONDITION = ['neu', 'gia su', 'truong hop', 'if', 'what if', 'suppose', 'in case', 'what happens', 'chuyen gi xay ra']

/** Khách kể về công ty mình ("bên mình đang dùng Excel", "we have 20 trucks"): câu trả lời phải theo hoàn cảnh đó. */
const OWN_CONTEXT = [
  'hien tai', 'hien dang', 'doi xe', 'xe cua minh', 'xe cua toi', 'xe cua em', 'kho minh',
  'kho cua minh', 'ben minh', 'ben em', 'ben toi', 'cong ty minh co', 'cong ty toi co', 'cong ty em co', 'chung toi co', 'chung toi dang',
  'minh chay', 'toi chay', 'em chay', 'we have', 'we use', 'we run', 'we currently', 'we ship', 'we deliver', 'our fleet', 'our trucks',
  'our drivers', 'our warehouse', 'my fleet', 'my trucks', 'my drivers', 'currently', 'i have', 'i run',
]

/** "đang dùng Excel", "đang chạy 10 xe" — trừ "khi đang dùng", "đang dùng thì …" là hỏi chung về lúc dùng. */
const OWN_CONTEXT_NOW = /(?<!khi) dang (dung|chay) (?!thi )/

const WHY = ['tai sao', 'vi sao', 'sao lai', 'why', 'de lam gi', 'what for']
const MECHANISM = [
  'tinh the nao', 'tinh nhu the nao', 'tinh ra sao', 'cach tinh', 'tinh dua', 'dua tren', 'dua vao dau', 'cong thuc', 'thuat toan',
  'algorithm', 'calculated', 'calculate', 'computed', 'based on', 'chinh xac', 'accurate', 'accuracy', 'co che', 'mechanism',
]
const DEFINITION = ['la gi', 'what is', 'what are', 'what s', 'nghia la', 'means', 'meaning']
const HOW = ['the nao', 'nhu the nao', 'ra sao', 'lam sao', 'lam the nao', 'cach nao']
/** "how" — trừ "how much", "how many" là hỏi số (giá, credit), không hỏi cách làm. */
const HOW_EN = /\bhow\b(?! much| many)/
/** Chủ đề mà câu soạn sẵn nói cách làm, nên "thế nào / how" về chủ đề đó vẫn trả sẵn được. */
const HOW_COVERED: ReadonlySet<TopicId> = new Set([
  'plans', 'advisor', 'start', 'howItWorks', 'roles', 'devices', 'packages', 'verify', 'support', 'human',
])

/** Một số trong câu là số lượng, kích thước, tiền của khách — trừ "3D" và "1" ("giá 1 tháng"). */
const quantity = (tokens: readonly string[]) => tokens.some((token) => /\d/.test(token) && !['1', '3d', '2d'].includes(token))

const model = (reason: Extract<RouteDecision, { route: 'MODEL' }>['reason']): RouteDecision => ({ route: 'MODEL', reason })

/** Lý do sâu của một câu (không xét chủ đề); `null` khi câu là câu một ý thường. */
function depthReason(raw: string, plain: string, padded: string, tokens: readonly string[]): Extract<RouteDecision, { route: 'MODEL' }>['reason'] | null {
  if (has(` ${plain} `, FRUSTRATION) || has(padded, FRUSTRATION) || URGENT_GAP.test(plain) || ERROR_LOI.test(plain) || /!{2,}/.test(raw)) return 'FRUSTRATION'
  if (has(padded, MANIPULATION)) return 'MANIPULATION'
  if (FOLLOW_UP_START.test(tokens.join(' ')) || has(padded, FOLLOW_UP)) return 'FOLLOW_UP'
  if ((raw.match(/\?/g) ?? []).length > 1 || has(padded, MULTI_PART)) return 'MULTI_PART'
  if (tokens.length > MAX_PREPARED_WORDS) return 'LONG'
  if (quantity(tokens)) return 'QUANTITY'
  if (has(padded, COMPARISON) || OR_HAY.test(padded)) return 'COMPARISON'
  if (has(padded, CONDITION) || LIEU.test(padded) || TROUBLE_THEN.test(padded)) return 'CONDITION'
  if (has(padded, OWN_CONTEXT) || OWN_CONTEXT_NOW.test(padded)) return 'OWN_CONTEXT'
  if (has(padded, WHY)) return 'WHY'
  if (has(padded, MECHANISM)) return 'MECHANISM'
  if (has(padded, DEFINITION)) return 'DEFINITION'
  return null
}

export function routeQuestion(question: string, { inConversation, locale }: RouteOptions): RouteDecision {
  const raw = question.trim()
  const plain = matchText(raw)
  const normalized = chatText(raw, locale)
  if (normalized === '') {
    // Chỉ có biểu tượng ("👍"): một lời đáp lại; chỉ có dấu hỏi ("???"): khách đang không hiểu — để mô hình hỏi lại
    return raw === '' || raw.includes('?') ? model('EMPTY') : { route: 'SMALL_TALK', smallTalk: 'ACK', reason: 'ACK' }
  }
  const smallTalk = smallTalkOf(normalized)
  if (smallTalk !== null) return { route: 'SMALL_TALK', smallTalk, reason: smallTalk }
  if (inConversation) return model('IN_CONVERSATION')

  const tokens = normalized.split(' ')
  const padded = ` ${normalized} `
  const deep = depthReason(raw, plain, padded, tokens)
  if (deep !== null) return model(deep)

  const [best, second] = rankTopics(normalized)
  if (best === undefined || best.score < MIN_SCORE) return model('NO_TOPIC')
  if (second !== undefined && second.score >= MIN_SCORE) return model('AMBIGUOUS')
  if ((has(padded, HOW) || HOW_EN.test(padded)) && !HOW_COVERED.has(best.id)) return model('HOW')
  const vocab = TOPIC_VOCAB[best.id]
  if (tokens.some((token) => !STOP_WORDS.has(token) && !vocab.has(token))) return model('SPECIFIC')
  return { route: 'PREPARED', topicId: best.id, reason: 'TOPIC' }
}
