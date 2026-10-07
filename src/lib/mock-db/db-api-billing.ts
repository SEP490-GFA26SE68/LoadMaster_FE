import type {
  CompanySubscription,
  CreditBalance,
  CreditReservation,
  CreditTransaction,
  CurrentSubscription,
  PaymentTransaction,
  PlanInput,
  PlanPatch,
  SubscriptionPlan,
} from './billing-model'

/**
 * Phần kho của gói cước, credit và thanh toán (FE-8-01, FE-8-05; D-89, D-94). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao,
 * từ chối bằng `MockDbError`. Dữ liệu của công ty đi qua `ctx.scope` (D-64): phiên của một công ty chỉ thấy gói, số dư, sổ cái và thanh
 * toán của công ty mình; phiên nền tảng bị từ chối `COMPANY_REQUIRED`; kho không có phiên làm việc với công ty mặc định. Danh mục gói là
 * dữ liệu nền tảng, mọi phiên đọc được.
 *
 * **Vòng đời gói theo đồng hồ của kho** (`ctx.nowIso`, không hẹn giờ nào): mỗi lần một hàm dưới đây chạm tới công ty, kho xử lý các việc
 * đã đến hạn — tạo thanh toán gia hạn `PENDING` trước hạn `renewalNoticeDays` ngày (tự gia hạn), gói hết kỳ mà chưa trả hoặc đã huỷ
 * thành `EXPIRED`. Xét vai trò của phiên cho các lệnh ghi (kho không có phiên — test logic — thì không xét; sai là `ROLE_NOT_ALLOWED`,
 * xét sau công ty).
 */
export type BillingDb = {
  /** Danh mục gói, bán và ngừng bán, theo thứ tự hạng. */
  listSubscriptionPlans(): Promise<SubscriptionPlan[]>
  /**
   * Quản lý nền tảng sửa gói. Giá hoặc credit tháng mới áp dụng từ kỳ kế tiếp của từng công ty: thanh toán gia hạn đang chờ cập nhật
   * theo, kỳ đang chạy giữ nguyên. Sửa xong gói hết cờ `provisional`. Sai dữ liệu: `PLAN_INVALID`.
   */
  updateSubscriptionPlan(planId: string, patch: PlanPatch): Promise<SubscriptionPlan>
  /**
   * Quản lý nền tảng tạo gói (FE-8-02): `PLAN_INVALID` khi tên trống, hạng lạ, giá không phải số nguyên không âm, credit tháng không phải
   * số nguyên dương hoặc `null`; mở bán một gói khi hạng đó đã có gói đang bán là `PLAN_TIER_TAKEN`. Hạng thuật toán và tính năng theo hạng.
   */
  createSubscriptionPlan(input: PlanInput): Promise<SubscriptionPlan>
  /** Bật / tắt bán một gói. Bật khi hạng đã có gói khác đang bán: `PLAN_TIER_TAKEN`. Công ty đang dùng gói ngừng bán vẫn dùng và gia hạn được. */
  setSubscriptionPlanActive(planId: string, active: boolean): Promise<SubscriptionPlan>
  /** Xoá gói; còn công ty gắn với nó (kể cả đã hết hạn) là `PLAN_IN_USE`. */
  deleteSubscriptionPlan(planId: string): Promise<void>
  /** Số công ty gắn với từng gói (mã gói → số công ty; gói không ai dùng là 0), cho màn danh mục gói. */
  countPlanCompanies(): Promise<Record<string, number>>

  /** Gói hiện tại của công ty và gói cước nó theo; `null` khi công ty chưa từng đăng ký. */
  getCurrentSubscription(): Promise<CurrentSubscription | null>
  /**
   * Quản trị công ty đăng ký một gói: chỉ khi chưa có gói hoặc gói đã hết hạn (`SUBSCRIPTION_ACTIVE`), gói đang bán (`PLAN_INACTIVE`).
   * Tạo thanh toán `PENDING` (thanh toán trước cổng, `settlePayment` mới kích hoạt gói); thanh toán đăng ký chờ trước đó bị thay.
   */
  subscribeToPlan(planId: string): Promise<PaymentTransaction>
  /** Quản trị công ty huỷ gói: còn hiệu lực tới hết kỳ, không tự gia hạn nữa. Gói không còn đang dùng: `SUBSCRIPTION_STATUS_INVALID`. */
  cancelSubscription(): Promise<CompanySubscription>

  /** Số dư credit của công ty (tổng sổ cái). */
  getCreditBalance(): Promise<CreditBalance>
  /** Sổ cái credit, mới nhất trước. */
  listCreditTransactions(): Promise<CreditTransaction[]>
  /** Quản trị công ty nạp credit: gói 50 hoặc 500 (`TOPUP_INVALID`), 1.000 đ mỗi credit. Tạo thanh toán `PENDING`. */
  topUpCredits(credits: number): Promise<PaymentTransaction>

  /** Thanh toán của công ty, mới nhất trước. */
  listPayments(): Promise<PaymentTransaction[]>
  getPayment(paymentId: string): Promise<PaymentTransaction>
  /**
   * Quản trị công ty xử lý một thanh toán — việc của cổng thanh toán (mock: màn thanh toán giả lập). **Đúng một lần**: thanh toán đã
   * xử lý rồi trả nguyên trạng thái cuối, không cộng lần hai. `SUCCESS`: đăng ký thì kích hoạt gói và cấp credit tháng, gia hạn thì nối
   * kỳ và cấp credit tháng, nạp thì cộng credit. `FAILED` không đổi số dư.
   */
  settlePayment(paymentId: string, outcome: 'SUCCESS' | 'FAILED'): Promise<PaymentTransaction>

  /**
   * Giữ credit cho một lần chạy tối ưu 3D của chuyến `tripId` (D-89): gói hết hạn hoặc chưa có gói là `SUBSCRIPTION_EXPIRED`, hết
   * credit là `INSUFFICIENT_CREDITS`, không ghi gì. Còn credit thì ghi giao dịch dùng `RESERVED` (-1; gói không giới hạn: 0) và trả mã
   * tham chiếu: `saveOptimizationRun({ creditReference })` trừ hẳn, `refundOptimizationCredit` hoàn. Số dư từ ngưỡng
   * `lowCreditThreshold` trở xuống thì kho ghi sự kiện hệ thống `credit.lowBalance` cho quản trị công ty.
   */
  reserveOptimizationCredit(tripId: string): Promise<CreditReservation>
  /** Hoàn credit của lần chạy lỗi hoặc bị huỷ: đúng một lần theo tham chiếu, gọi lại không cộng lần hai. Mã lạ: `NOT_FOUND`. */
  refundOptimizationCredit(reference: string): Promise<void>
}
