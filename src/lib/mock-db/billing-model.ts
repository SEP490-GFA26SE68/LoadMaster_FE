/**
 * Gói cước, đăng ký của công ty, credit và thanh toán (FE-8-01, FE-8-05; D-89, D-90, D-94). Kiểu và luật thuần — kho ghi ở
 * `db-billing.ts`, seed ở `seed-billing.ts`. Tiền là VND nguyên; credit là số nguyên.
 */

/** Hạng gói theo backend (`SubscriptionTier`). */
export const PLAN_TIERS = ['BASIC', 'PRO', 'ULTIMATE'] as const
export type PlanTier = (typeof PLAN_TIERS)[number]

/**
 * Hạng thuật toán của gói theo backend (`algorithm_tier`). Mock chạy một thuật toán cho mọi hạng; hạng chỉ nói gói được dùng tới đâu
 * (AGENTS mục 6: phương án luôn ghi đúng tên đã chạy).
 */
export const ALGORITHM_TIERS = ['EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'] as const
export type AlgorithmTier = (typeof ALGORITHM_TIERS)[number]

/** Hạng thuật toán và tính năng của gói theo hạng: gói tạo mới (FE-8-02) nhận đúng bộ của hạng, người tạo chỉ chọn hạng. */
export const TIER_ALGORITHM: Readonly<Record<PlanTier, AlgorithmTier>> = { BASIC: 'EP_DBLF', PRO: 'EP_DBLF_GA', ULTIMATE: 'EP_DBLF_GA_AI' }
export const TIER_FEATURES: Readonly<Record<PlanTier, readonly string[]>> = {
  BASIC: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION'],
  PRO: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM'],
  ULTIMATE: ['OPTIMIZATION_3D', 'ROUTE_OPTIMIZATION', 'ADVANCED_ALGORITHM', 'UNLIMITED_CREDITS'],
}

export type SubscriptionPlan = {
  /** `PLAN-NNN`. */
  id: string
  name: string
  tier: PlanTier
  priceVnd: number
  /** Credit cấp mỗi kỳ; `null` là không giới hạn (Ultimate). */
  monthlyCredits: number | null
  algorithmTier: AlgorithmTier
  /** Mã tính năng của gói, màn dịch. */
  features: string[]
  /** Đang bán (mỗi hạng một gói đang bán, D-90). */
  active: boolean
  /** Giá hoặc hạn mức chưa được nhóm chốt (PRD v2 mục 17.2): màn nhãn "Giá trị tạm — chờ chốt". Sửa gói thì cờ này tắt. */
  provisional: boolean
}

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED'

/** Gói của một công ty — mỗi công ty tối đa một dòng (backend: `company_id UNIQUE`). */
export type CompanySubscription = {
  /** `SUB-NNN`. */
  id: string
  companyId: string
  planId: string
  status: SubscriptionStatus
  /** Lần đăng ký (kỳ đầu) bắt đầu. */
  startedAt: string
  /** Hết kỳ hiện tại: tới đây mà chưa trả gia hạn (hoặc đã huỷ) thì gói hết hạn. */
  expiresAt: string
  autoRenew: boolean
  /** Lúc huỷ gói (còn hiệu lực tới `expiresAt`). */
  cancelledAt?: string
}

export type CreditAccount = {
  /** `CA-NNN`. */
  id: string
  companyId: string
  /**
   * Tổng `amount` của sổ cái công ty kể từ lần cấp credit tháng (`MONTHLY_GRANT`) gần nhất, không bao giờ âm: mỗi kỳ mới đặt lại số dư
   * về đúng credit của kỳ đó, credit còn lại của kỳ trước không cộng dồn — như máy chủ (Q-27).
   */
  balance: number
}

export const CREDIT_TRANSACTION_TYPES = ['MONTHLY_GRANT', 'PURCHASE', 'USAGE', 'REFUND'] as const
export type CreditTransactionType = (typeof CREDIT_TRANSACTION_TYPES)[number]

/** Một lượt dùng đi `RESERVED` → `DEDUCTED` (lần chạy xong) hoặc `REFUNDED` (lỗi, huỷ); hoàn đúng một lần theo tham chiếu. */
export type UsageStatus = 'RESERVED' | 'DEDUCTED' | 'REFUNDED'

export type CreditTransaction = {
  /** `CTX-NNNN`. */
  id: string
  companyId: string
  type: CreditTransactionType
  /** Có dấu: cấp, mua, hoàn là số dương; dùng là số âm (Ultimate: 0). */
  amount: number
  /** Mã lần chạy (`JOB-NNN`) cho dùng và hoàn; mã thanh toán cho cấp và mua. */
  reference: string
  refunded: boolean
  /** Chỉ ở giao dịch `USAGE`. */
  usageStatus?: UsageStatus
  /** Chuyến của lần chạy (giao dịch `USAGE` và `REFUND` của nó). */
  tripId?: string
  createdAt: string
}

export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/** `SUBSCRIBE` đăng ký gói, `RENEWAL` gia hạn tự tạo, `TOPUP` nạp credit. */
export type PaymentPurpose = 'SUBSCRIBE' | 'RENEWAL' | 'TOPUP'

export type PaymentTransaction = {
  /** `PAY-NNN` — cũng là mã giao dịch của màn thanh toán giả lập. */
  id: string
  companyId: string
  purpose: PaymentPurpose
  amountVnd: number
  status: PaymentStatus
  planId?: string
  /** Credit sẽ cộng khi trả xong, chụp lúc tạo thanh toán (đổi giá / hạn mức gói không đổi thanh toán đã tạo trừ khi kỳ kế tiếp). `null`: gói không giới hạn. */
  credits?: number | null
  /** Gia hạn: hạn của kỳ mà thanh toán này nối tiếp. */
  periodEnd?: string
  createdAt: string
  updatedAt: string
}

export type CurrentSubscription = { subscription: CompanySubscription; plan: SubscriptionPlan }

/** Số dư của công ty; gói không giới hạn thì `unlimited` (số dư thật vẫn tính theo sổ cái). */
export type CreditBalance = { balance: number; unlimited: boolean }

/** Phần gói được sửa (D-90): đổi giá, credit tháng áp dụng từ kỳ gia hạn kế tiếp của từng công ty. */
export type PlanPatch = Partial<Pick<SubscriptionPlan, 'name' | 'priceVnd' | 'monthlyCredits' | 'features'>>

/** Gói mới (FE-8-02): hạng chọn bộ thuật toán và tính năng; `active` vắng là đang bán. Quản lý nền tảng tạo, `provisional` luôn tắt. */
export type PlanInput = Pick<SubscriptionPlan, 'name' | 'tier' | 'priceVnd' | 'monthlyCredits'> & { active?: boolean }

/** Một lần chạy tối ưu đã giữ credit; `reference` đưa cho `saveOptimizationRun` (trừ) hoặc `refundOptimizationCredit` (hoàn). */
export type CreditReservation = { reference: string; cost: number }

/** Mọi hằng số vòng đời gói và credit ở một chỗ. */
export const BILLING_CONSTANTS = {
  /** Một kỳ gói (ngày). */
  periodDays: 30,
  /** Tự gia hạn tạo thanh toán Chờ chừng ấy ngày trước hạn (đã chốt). */
  renewalNoticeDays: 7,
  /** Ngưỡng "Sắp hết credit" là tỉ lệ này của credit tháng của gói, làm tròn lên (`lowCreditThreshold`; đã chốt). */
  lowCreditRatio: 0.25,
  /** Credit mỗi lần chạy tối ưu 3D (D-89, như INITIAL_OPTIMIZATION_CREDIT_COST của BE): giữ, trừ, hoàn và chặn đều theo số này; ba phương án vẫn một lần. */
  optimizationCost: 2,
  /** Gói nạp credit và giá mỗi credit (D-89). */
  topUpPacks: [50, 500],
  creditPriceVnd: 1000,
} as const

export const isUnlimited = (plan: Pick<SubscriptionPlan, 'monthlyCredits'>) => plan.monthlyCredits === null

/**
 * Số dư từ ngưỡng này trở xuống thì báo "Sắp hết credit" cho quản trị công ty: `ceil(credit tháng × 25 %)`. Gói không giới hạn không có
 * ngưỡng (`null`) — không bao giờ báo, kể cả khi đã hết hạn. Nối backend thì ngưỡng là `lowBalanceThreshold` của bảng giá máy chủ (`getCreditPricing`, cùng công thức) và máy chủ tự báo.
 */
export const lowCreditThreshold = (plan: Pick<SubscriptionPlan, 'monthlyCredits'>): number | null =>
  plan.monthlyCredits === null ? null : Math.ceil(plan.monthlyCredits * BILLING_CONSTANTS.lowCreditRatio)

/** Vì sao một lần chạy tối ưu bị chặn; chưa có gói (`SUBSCRIPTION_EXPIRED`) xét trước số dư. */
export type CreditBlock = 'SUBSCRIPTION_EXPIRED' | 'INSUFFICIENT_CREDITS'

/**
 * Luật chặn lần chạy tối ưu 3D — kho (`reserveOptimizationCredit`) và màn Thiết lập tối ưu (trạng thái mờ trước khi bấm) dùng chung.
 * Công ty chưa từng có gói thì chặn. Gói đã huỷ vẫn chạy được tới hết kỳ; gói đã hết hạn **không chặn** — số dư giữ nguyên (D-94) và
 * vẫn chạy được, chỉ ở hạng Cơ bản (`effectiveAlgorithmTier`), mỗi lần tốn `runCost`.
 */
export function creditBlock(current: CurrentSubscription | null, balance: number): CreditBlock | null {
  if (current === null) return 'SUBSCRIPTION_EXPIRED'
  return balance < runCost(current) ? 'INSUFFICIENT_CREDITS' : null
}

/** Credit một lần chạy tốn: `BILLING_CONSTANTS.optimizationCost`, gói không giới hạn ghi 0 (D-89). */
export const optimizationCost = (plan: Pick<SubscriptionPlan, 'monthlyCredits'>) => (isUnlimited(plan) ? 0 : BILLING_CONSTANTS.optimizationCost)

/**
 * Gói đã hết hạn (`EXPIRED` — kể cả gói đã huỷ sau hết kỳ): công ty **giữ số dư** và vẫn chạy tối ưu bằng số dư đó, nhưng chỉ ở hạng
 * Cơ bản (`EP_DBLF`) và mỗi lần trừ credit như gói thường — "không giới hạn" của gói Ultimate không còn.
 */
export const isLapsed = (current: CurrentSubscription) => current.subscription.status === 'EXPIRED'

/** Credit lần chạy này tốn theo gói lúc này: gói đã hết hạn luôn tốn `BILLING_CONSTANTS.optimizationCost`. */
export const runCost = (current: CurrentSubscription) => (isLapsed(current) ? BILLING_CONSTANTS.optimizationCost : optimizationCost(current.plan))

/** Hạng thuật toán được dùng lúc này: hạng của gói khi gói còn hiệu lực, hạng Cơ bản khi gói đã hết hạn. */
export const effectiveAlgorithmTier = (current: CurrentSubscription): AlgorithmTier =>
  isLapsed(current) ? TIER_ALGORITHM.BASIC : current.plan.algorithmTier

/**
 * Trạng thái của gói **tính theo đồng hồ**, không ghi gì: gói còn `ACTIVE` / `CANCELLED` mà đã quá hạn thì là `EXPIRED`. Kho chỉ ghi
 * `EXPIRED` khi chính công ty đó chạm tới nó (`settle`); các màn của vai trò nền tảng (công ty, hỗ trợ) chỉ đọc nên dùng hàm này.
 */
export function effectiveSubscriptionStatus(subscription: Pick<CompanySubscription, 'status' | 'expiresAt'>, nowIso: string): SubscriptionStatus {
  return subscription.status !== 'EXPIRED' && Date.parse(subscription.expiresAt) <= Date.parse(nowIso) ? 'EXPIRED' : subscription.status
}
