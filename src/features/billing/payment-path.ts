/** Đường dẫn trang thanh toán giả lập của một giao dịch (`?giao-dich=<mã>`, mã là mã thanh toán `PAY-NNN`). Một chỗ cho mọi nơi mở trang đó. */
export const PAYMENT_PATH = '/thanh-toan/gia-lap'
export const PAYMENT_PARAM = 'giao-dich'

export const paymentPath = (paymentId: string) => `${PAYMENT_PATH}?${PAYMENT_PARAM}=${encodeURIComponent(paymentId)}`
