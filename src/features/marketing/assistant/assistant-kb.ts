import { GUEST_REGISTRATION, PUBLIC_HOME, PUBLIC_PRICING, TRIAL_REGISTRATION } from '@/features/auth/landing'
import { contactPath } from '../contact-form'

/**
 * Bộ câu trả lời soạn sẵn của trợ lý "Hỏi Lumo" (thuần, không React). Mỗi chủ đề: từ khoá để khớp câu hỏi (chữ ASCII không dấu, vi + en —
 * `assistant-match.ts` bỏ dấu câu hỏi trước khi so), phần trả lời theo thứ tự (`answer` là câu `assistant.topics.<id>.answer` của từ
 * điển, còn lại là phần dựng từ dữ liệu — `AssistantFacts`), liên kết xem thêm và câu hỏi tiếp theo gợi ý. Chỉ nói điều sản phẩm đang làm
 * được; điều phụ thuộc nguồn dữ liệu đi theo `AssistantContext`.
 */
export const TOPIC_IDS = [
  'plans', 'credit', 'advisor', 'start', 'howItWorks', 'roles', 'devices', 'packages', 'verify',
  'loading3d', 'axle', 'routes', 'pickup', 'tenancy', 'support', 'human', 'about',
] as const
export type TopicId = (typeof TOPIC_IDS)[number]

/** Phần trả lời dựng từ dữ liệu: danh mục gói, hằng của code (credit mỗi lần chạy, số mục tiêu, số luật nhận hàng…). */
export type FactId = 'planList' | 'creditCost' | 'steps' | 'roleDevices' | 'objectives' | 'restRule' | 'pickupRules'
export type AnswerPart = 'answer' | FactId

/** `id` của ba phần trên trang giới thiệu; liên kết đi kèm `pathname` nên bấm từ Bảng giá vẫn tới đúng phần. */
export const SECTION_ANCHORS = { plans: 'goi-cuoc', how: 'cach-hoat-dong', features: 'tinh-nang' } as const

export type ActionId = 'plans' | 'pricing' | 'how' | 'features' | 'trial' | 'registerNow' | 'requestTrial'
/** `to` là đường dẫn của router (có thể kèm `?` và `#`); trang khác thì là điều hướng sang trang đó. */
export type AssistantAction = { readonly id: ActionId; readonly to: string }

/**
 * Điều câu trả lời phụ thuộc: `selfSignUp` — khách tự đăng ký được (nhóm `registration` nối máy chủ, chưa đăng nhập; như `PlanCard`);
 * `mockRoutes` — giờ đến tính bằng mock tối ưu tuyến của app (có luật nghỉ bắt buộc), không phải máy chủ.
 */
export type AssistantContext = { readonly selfSignUp: boolean; readonly mockRoutes: boolean }

export type Topic = {
  readonly id: TopicId
  /** Cụm từ khoá, khớp trọn từ; mỗi cụm nặng (số từ + 1). */
  readonly keywords: readonly string[]
  /** Từ gợi ý yếu, mỗi từ nặng 1 — một mình không đủ ngưỡng. */
  readonly hints?: readonly string[]
  readonly parts: (ctx: AssistantContext) => readonly AnswerPart[]
  readonly actions: (ctx: AssistantContext) => readonly AssistantAction[]
  readonly followUps: readonly TopicId[]
}

const section = (id: 'plans' | 'how' | 'features'): AssistantAction => ({ id, to: `${PUBLIC_HOME}#${SECTION_ANCHORS[id]}` })
export const PRICING_ACTION: AssistantAction = { id: 'pricing', to: PUBLIC_PRICING }
/** Form liên hệ, loại "Đăng ký tài khoản dùng thử" — kho mẫu: tài khoản công ty do đội LoadMaster tạo. */
const REQUEST_TRIAL: AssistantAction = { id: 'requestTrial', to: contactPath({ type: 'DEMO_REQUEST' }) }
const SIGN_UP: readonly AssistantAction[] = [
  { id: 'trial', to: TRIAL_REGISTRATION },
  { id: 'registerNow', to: GUEST_REGISTRATION },
]

const answerOnly = () => ['answer'] as const
const none = () => []

export const TOPICS: readonly Topic[] = [
  {
    id: 'plans',
    keywords: ['gia', 'bang gia', 'gia goi', 'bao nhieu tien', 'chi phi', 'goi cuoc', 'phi', 'price', 'prices', 'pricing', 'cost', 'how much', 'plans', 'subscription'],
    hints: ['goi', 'plan', 'tien', 'thang'],
    parts: () => ['answer', 'planList'],
    actions: () => [section('plans'), PRICING_ACTION],
    followUps: ['advisor', 'credit', 'start'],
  },
  {
    id: 'credit',
    keywords: ['credit', 'credits', 'tin chi', 'mot lan toi uu', 'lan chay', 'moi lan chay', 'ton bao nhieu', 'het credit', 'nap credit', 'top up', 'one optimization', 'optimization use', 'credits per run'],
    hints: ['ton', 'run', 'runs'],
    parts: () => ['creditCost', 'answer'],
    actions: () => [section('plans')],
    followUps: ['advisor', 'plans', 'loading3d'],
  },
  {
    id: 'advisor',
    keywords: ['goi nao', 'goi nao hop', 'chon goi', 'nen chon', 'phu hop', 'hop voi', 'tu van goi', 'which plan', 'plan fits', 'right plan', 'best plan', 'recommend', 'suggest a plan'],
    hints: ['cong ty toi', 'my company'],
    parts: answerOnly,
    actions: none,
    followUps: ['plans', 'credit', 'start'],
  },
  {
    id: 'start',
    keywords: ['dung thu', 'trai nghiem', 'dang ky', 'bat dau', 'mo tai khoan', 'tao tai khoan', 'demo', 'trial', 'try', 'free trial', 'sign up', 'signup', 'register', 'get started', 'create an account', 'try it'],
    hints: ['tai khoan', 'account'],
    parts: () => ['answer'],
    actions: (ctx) => (ctx.selfSignUp ? SIGN_UP : [REQUEST_TRIAL]),
    followUps: ['plans', 'howItWorks', 'human'],
  },
  {
    id: 'howItWorks',
    keywords: ['hoat dong', 'cach hoat dong', 'quy trinh', 'cac buoc', 'lam viec the nao', 'how it works', 'how does it work', 'loadmaster work', 'does loadmaster work', 'workflow', 'process', 'steps'],
    hints: ['the nao', 'nhu the nao', 'how'],
    parts: () => ['answer', 'steps'],
    actions: () => [section('how')],
    followUps: ['loading3d', 'routes', 'roles'],
  },
  {
    id: 'roles',
    keywords: ['vai tro', 'ai dung', 'cong ty dung', 'ai trong cong ty', 'nguoi dung', 'dieu phoi', 'nhan vien kho', 'tai xe', 'quan ly', 'roles', 'role', 'who uses', 'uses loadmaster', 'who in my company', 'dispatcher', 'driver', 'drivers', 'warehouse staff', 'users'],
    hints: ['ai', 'who'],
    parts: () => ['answer', 'roleDevices'],
    actions: () => [section('features')],
    followUps: ['devices', 'tenancy', 'howItWorks'],
  },
  {
    id: 'devices',
    keywords: ['dien thoai', 'may tinh bang', 'di dong', 'mobile', 'phone', 'phones', 'tablet', 'tablets', 'app', 'ung dung', 'trinh duyet', 'browser'],
    hints: ['thiet bi', 'device'],
    parts: answerOnly,
    actions: () => [section('features')],
    followUps: ['roles', 'verify', 'packages'],
  },
  {
    id: 'packages',
    keywords: ['nhap kien', 'kien hang', 'excel', 'file', 'nhap file', 'import', 'nhan qr', 'in nhan', 'packages', 'package', 'parcel', 'parcels', 'enter packages', 'label', 'labels', 'upload'],
    hints: ['kien', 'hang', 'nhap'],
    parts: answerOnly,
    actions: () => [section('features')],
    followUps: ['verify', 'loading3d', 'howItWorks'],
  },
  {
    id: 'verify',
    keywords: ['quet', 'quet qr', 'ma qr', 'qr', 'doi chieu', 'dung kien', 'nham kien', 'scan', 'scanning', 'barcode', 'right package', 'wrong package', 'verify', 'check packages'],
    hints: ['xep', 'giao', 'kiem'],
    parts: answerOnly,
    actions: () => [section('features')],
    followUps: ['packages', 'devices', 'pickup'],
  },
  {
    id: 'loading3d',
    keywords: ['3d', 'xep hang', 'phuong an', 'thung xe', 'xep 3d', 'toi uu xep', 'chat xep', 'load plan', 'loading plan', 'load optimization', 'packing', 'cargo layout', 'stacking'],
    hints: ['toi uu', 'xep', 'optimize', 'optimization'],
    parts: () => ['objectives', 'answer'],
    actions: () => [section('features')],
    followUps: ['axle', 'credit', 'routes'],
  },
  {
    id: 'axle',
    keywords: ['tai truc', 'truc xe', 'qua tai', 'can bang tai', 'trong tam', 'axle', 'axles', 'axle load', 'axle loads', 'overload', 'overloaded', 'weight balance', 'center of gravity'],
    hints: ['tai trong', 'weight'],
    parts: answerOnly,
    actions: () => [section('features')],
    followUps: ['loading3d', 'pickup', 'routes'],
  },
  {
    id: 'routes',
    keywords: ['tuyen', 'tuyen duong', 'toi uu tuyen', 'lo trinh', 'diem giao', 'gio den', 'tre han', 'giam sat', 'ban do', 'gps', 'eta', 'route', 'routes', 'routing', 'optimize routes', 'delivery stops', 'tracking', 'late', 'deadline', 'map'],
    hints: ['duong', 'xe chay'],
    parts: (ctx) => (ctx.mockRoutes ? ['answer', 'restRule'] : ['answer']),
    actions: () => [section('features')],
    followUps: ['pickup', 'loading3d', 'devices'],
  },
  {
    id: 'pickup',
    keywords: ['doc duong', 'nhan hang', 'nhan them', 'lay them hang', 'nhan hang doc duong', 'pickup', 'pick up', 'pickups', 'on the way', 'extra cargo', 'collect'],
    hints: ['them hang', 'more cargo'],
    parts: () => ['pickupRules', 'answer'],
    actions: () => [section('features')],
    followUps: ['routes', 'axle', 'verify'],
  },
  {
    id: 'tenancy',
    keywords: ['du lieu', 'bao mat', 'tach rieng', 'rieng tu', 'phan quyen', 'cong ty khac', 'data', 'privacy', 'security', 'separate', 'permissions', 'isolated'],
    hints: ['an toan', 'safe'],
    parts: answerOnly,
    actions: none,
    followUps: ['roles', 'support', 'start'],
  },
  {
    id: 'support',
    keywords: ['ho tro', 'yeu cau ho tro', 'bao loi', 'gap loi', 'su co', 'support', 'help', 'get help', 'bug', 'problem', 'issue', 'ticket'],
    hints: ['loi', 'error'],
    parts: answerOnly,
    actions: none,
    followUps: ['human', 'tenancy', 'start'],
  },
  {
    id: 'human',
    keywords: ['nhan vien', 'nguoi that', 'hoi nguoi', 'nguoi cua loadmaster', 'tu van vien', 'lien he', 'goi dien', 'hotline', 'email', 'noi chuyen', 'tu van', 'human', 'person', 'real person', 'agent', 'contact', 'sales', 'talk to', 'speak to', 'ask someone', 'someone'],
    parts: answerOnly,
    actions: none,
    followUps: ['start', 'plans', 'about'],
  },
  {
    id: 'about',
    keywords: ['ban la ai', 'lumo', 'tro ly', 'chatbot', 'bot', 'may that', 'tri tue nhan tao', 'phai ai', 'la ai khong', 'who are you', 'what are you', 'assistant', 'are you a bot', 'are you human', 'are you ai', 'is this ai', 'artificial intelligence'],
    parts: answerOnly,
    actions: none,
    followUps: ['human', 'howItWorks', 'plans'],
  },
]

/** Bốn câu hỏi gợi ý lúc mở trợ lý, và gợi ý sau câu không khớp chủ đề nào. */
export const STARTER_TOPICS: readonly TopicId[] = ['plans', 'credit', 'start', 'advisor']
export const FALLBACK_TOPICS: readonly TopicId[] = ['plans', 'howItWorks', 'start']

export function topicOf(id: TopicId): Topic {
  const topic = TOPICS.find((candidate) => candidate.id === id)
  if (!topic) throw new Error(`Chủ đề trợ lý không tồn tại: ${id}`)
  return topic
}
