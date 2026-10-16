/**
 * Câu cho mã lỗi backend trả về qua `api()` (`ApiError`): mã đường truyền của `api-client.ts` và mã nghiệp vụ backend (`code` trong
 * phong bì) của các màn đã nối. Chỉ gọi qua `dataErrorMessage`; mã chưa có câu dùng `dataErrors.UNKNOWN`. Màn nối thêm thì thêm mã của nó.
 */
export const apiErrors = {
  NETWORK_ERROR: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  TIMEOUT: 'Máy chủ phản hồi quá lâu. Thử lại sau.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.',
  UNAUTHORIZED: 'Bạn không có quyền thực hiện thao tác này.',
  SERVER_ERROR: 'Máy chủ gặp lỗi. Thử lại sau.',
  INVALID_INPUT: 'Máy chủ không nhận thao tác này: dữ liệu không hợp lệ, hoặc bạn đang thao tác trên chính tài khoản của mình.',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ, kiểm tra lại các ô.',
  EMAIL_ALREADY_EXISTS: 'Email này đã có người dùng.',
  USER_ALREADY_EXISTS: 'Email này đã có người dùng.',
  USER_NOT_FOUND: 'Không tìm thấy người dùng này.',
  COMPANY_REQUIRED: 'Vai trò của công ty cần có công ty.',
  COMPANY_NOT_FOUND: 'Không tìm thấy công ty.',
  EMAIL_CHANGE_UNSUPPORTED: 'Máy chủ chưa cho đổi email của tài khoản.',
  USER_COMPANY_NOT_FOUND: 'Tài khoản của bạn chưa thuộc công ty nào.',
} as const
