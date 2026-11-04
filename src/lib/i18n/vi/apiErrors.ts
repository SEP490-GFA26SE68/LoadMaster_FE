/**
 * Câu cho mã lỗi backend trả về qua `api()` (`ApiError`): mã đường truyền và mã suy từ HTTP của `api-client.ts`, và mọi mã nghiệp vụ
 * của `ErrorCode` backend (`code` trong phong bì). Chỉ gọi qua `dataErrorMessage`; mã chưa có câu dùng `dataErrors.UNKNOWN`. Mã chỉ FE
 * dùng (lỗi do FE tự chặn trước khi gọi) đứng cuối.
 */
export const apiErrors = {
  // Đường truyền và mã suy từ HTTP khi phong bì không có `code`
  NETWORK_ERROR: 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.',
  TIMEOUT: 'Máy chủ phản hồi quá lâu. Thử lại sau.',
  UNAUTHENTICATED: 'Phiên đăng nhập đã hết, hãy đăng nhập lại.',
  UNAUTHORIZED: 'Bạn không có quyền thực hiện thao tác này.',
  BAD_REQUEST: 'Máy chủ không nhận thao tác này: dữ liệu chưa hợp lệ hoặc trạng thái hiện tại không cho phép.',
  PAYMENT_REQUIRED: 'Không đủ credit hoặc gói cước không còn hiệu lực cho thao tác này.',
  NOT_FOUND: 'Không tìm thấy dữ liệu này trên máy chủ — có thể đã bị xoá.',
  CONFLICT: 'Dữ liệu bị trùng hoặc đã thay đổi trên máy chủ. Tải lại rồi thử lại.',
  SERVER_ERROR: 'Máy chủ gặp lỗi. Thử lại sau.',

  // Chung
  UNCATEGORIZED_EXCEPTION: 'Máy chủ gặp lỗi chưa xác định. Thử lại sau.',
  INTERNAL_SERVER_ERROR: 'Máy chủ gặp lỗi. Thử lại sau.',
  INVALID_INPUT: 'Máy chủ không nhận thao tác này: dữ liệu không hợp lệ, hoặc bạn đang thao tác trên chính tài khoản của mình.',
  VALIDATION_ERROR: 'Dữ liệu chưa hợp lệ, kiểm tra lại các ô.',
  RESOURCE_NOT_FOUND: 'Không tìm thấy dữ liệu yêu cầu.',
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',

  // Người dùng, công ty
  USER_NOT_FOUND: 'Không tìm thấy người dùng này.',
  USER_ALREADY_EXISTS: 'Email này đã có người dùng.',
  EMAIL_ALREADY_EXISTS: 'Email này đã có người dùng.',
  USER_PROFILE_NOT_FOUND: 'Không tìm thấy hồ sơ của tài khoản.',
  ROLE_NOT_FOUND: 'Vai trò này không tồn tại.',
  COMPANY_NOT_FOUND: 'Không tìm thấy công ty.',
  COMPANY_ALREADY_EXISTS: 'Công ty này đã có trên hệ thống.',
  COMPANY_REQUIRED: 'Vai trò của công ty cần có công ty.',
  USER_COMPANY_NOT_FOUND: 'Tài khoản của bạn chưa thuộc công ty nào.',
  TAX_CODE_ALREADY_EXISTS: 'Mã số thuế này đã thuộc một công ty khác.',

  // Danh mục và kiện
  CUSTOMER_NOT_FOUND: 'Không tìm thấy khách hàng.',
  ORDER_NOT_FOUND: 'Không tìm thấy đơn hàng.',
  PACKAGE_NOT_FOUND: 'Không tìm thấy kiện hàng.',
  PACKAGE_TYPE_NOT_FOUND: 'Không tìm thấy loại kiện.',
  TRACKING_BARCODE_ALREADY_EXISTS: 'Mã kiện này đã có trong kho kiện.',
  STACKING_RULE_NOT_FOUND: 'Không tìm thấy luật xếp chồng.',
  STACKING_RULE_ALREADY_EXISTS: 'Luật xếp chồng này đã có.',
  VEHICLE_NOT_FOUND: 'Không tìm thấy xe.',
  VEHICLE_TYPE_NOT_FOUND: 'Không tìm thấy loại xe.',

  // Nhập file và xuất nhãn
  FILE_INVALID: 'File không đọc được. Kiểm tra lại file rồi thử lại.',
  UNSUPPORTED_FILE_TYPE: 'Định dạng file chưa được hỗ trợ. Dùng file .xlsx hoặc .csv.',
  EMPTY_FILE: 'File không có dòng dữ liệu nào.',
  IMPORT_FILE_REJECTED: 'Máy chủ không đọc được file này. Thường là file chưa có dòng kiện nào dưới dòng tiêu đề (file mẫu còn trống); cũng có thể file hỏng hoặc quá 1.000 dòng.',
  FILE_SIZE_LIMIT_EXCEEDED: 'File quá lớn so với giới hạn cho phép.',
  BATCH_SIZE_LIMIT_EXCEEDED: 'File có quá nhiều dòng cho một lần nhập.',
  IMPORT_DUPLICATE_CODE: 'File có mã kiện bị trùng.',
  IMPORT_INVALID_LENGTH: 'Có dòng có chiều dài không hợp lệ.',
  IMPORT_INVALID_WIDTH: 'Có dòng có chiều rộng không hợp lệ.',
  IMPORT_INVALID_HEIGHT: 'Có dòng có chiều cao không hợp lệ.',
  IMPORT_INVALID_WEIGHT: 'Có dòng có khối lượng không hợp lệ.',
  IMPORT_INVALID_HANDLING_CLASS: 'Có dòng có loại hàng không hợp lệ.',
  IMPORT_BLANK_DESTINATION: 'Có dòng chưa ghi điểm đến.',
  IMPORT_EXISTING_CODE: 'Có mã kiện đã có trong kho kiện.',
  IMPORT_HAS_ERRORS: 'File còn dòng lỗi, sửa hết rồi mới xác nhận nhập được.',
  EXPORT_FAILED: 'Không tạo được file xuất. Thử lại sau.',
  EXPORT_TOO_MANY_PACKAGES: 'Chọn quá nhiều kiện cho một lần in nhãn.',

  // Chuyến, tuyến, phân tách hàng
  TRIP_NOT_FOUND: 'Không tìm thấy chuyến.',
  DELIVERY_REQUIREMENT_NOT_FOUND: 'Không tìm thấy yêu cầu giao.',
  DELIVERY_REQUIREMENT_NOT_PENDING: 'Yêu cầu giao đã vào chuyến, không sửa được nữa.',
  INVALID_DELIVERY_REQUIREMENT_TRANSITION: 'Yêu cầu giao không chuyển được sang trạng thái này.',
  CARGO_SEGREGATION_CONFLICT: 'Chuyến đã có loại hàng khác — không chở chung được.',
  DELIVERY_STOP_NOT_FOUND: 'Không tìm thấy điểm giao.',
  ROUTE_PLAN_NOT_FOUND: 'Chuyến chưa có tuyến.',
  ROUTE_LEG_NOT_FOUND: 'Không tìm thấy chặng của tuyến.',
  ROUTE_SUGGESTION_NOT_FOUND: 'Không tìm thấy tuyến gợi ý.',
  INVALID_REROUTE_INDEX: 'Tuyến thay thế đã chọn không còn hợp lệ.',

  // Phương án xếp, kho
  LOAD_PLAN_NOT_FOUND: 'Không tìm thấy phương án xếp.',
  PLACEMENT_NOT_FOUND: 'Không tìm thấy vị trí của kiện trong phương án.',
  PLACEMENT_NOT_IN_PLAN: 'Kiện này không thuộc phương án đang xếp.',
  NO_APPROVED_LOAD_PLAN: 'Chuyến chưa có phương án đã duyệt.',
  TRIP_ALREADY_LOADING: 'Chuyến đã bắt đầu xếp hàng.',
  LOADING_EXECUTION_NOT_FOUND: 'Không tìm thấy phiên xếp hàng của chuyến.',
  PLACEMENT_ALREADY_CONFIRMED: 'Kiện này đã được xác nhận xếp.',
  DEVIATION_ALREADY_RECORDED: 'Sai lệch của kiện này đã được ghi.',
  INVALID_SEQUENCE_ORDER: 'Chưa tới lượt kiện này — xếp theo đúng thứ tự.',
  INCOMPLETE_LOADING: 'Còn kiện chưa xếp, chưa hoàn tất được.',

  // Giao hàng, giám sát
  NO_PENDING_DELIVERY_STOP: 'Chuyến không còn điểm giao nào chờ giao.',
  DUPLICATE_UNLOAD: 'Kiện này đã được dỡ.',
  WRONG_DELIVERY_STOP: 'Kiện này không thuộc điểm giao hiện tại.',
  INCOMPLETE_STOP_UNLOAD: 'Còn kiện của điểm này chưa dỡ.',
  GPS_TRIP_NOT_IN_TRANSIT: 'Chuyến không ở trạng thái đang vận chuyển.',
  NO_GPS_LOCATION: 'Chưa có vị trí nào của xe.',
  TRIP_EXCEPTION_NOT_FOUND: 'Không tìm thấy sự cố.',

  // Gói cước, credit, thanh toán
  SUBSCRIPTION_NOT_FOUND: 'Công ty chưa có gói cước.',
  SUBSCRIPTION_PLAN_NOT_FOUND: 'Không tìm thấy gói cước.',
  SUBSCRIPTION_PLAN_ALREADY_EXISTS: 'Gói cước này đã có.',
  SUBSCRIPTION_TIER_ALREADY_EXISTS: 'Hạng gói này đã có gói đang bán.',
  PLAN_IN_USE: 'Gói đang có hoặc từng có công ty dùng nên không xoá được.',
  ACTIVE_SUBSCRIPTION_ALREADY_EXISTS: 'Công ty đang có gói còn hiệu lực.',
  NO_ACTIVE_SUBSCRIPTION: 'Công ty chưa có gói còn hiệu lực.',
  PAYMENT_FAILED: 'Thanh toán không thành công.',
  PAYMENT_TRANSACTION_NOT_FOUND: 'Không tìm thấy giao dịch thanh toán.',
  INVALID_PAYMENT_SIGNATURE: 'Chữ ký thanh toán không hợp lệ.',
  INVOICE_NOT_FOUND: 'Không tìm thấy hoá đơn.',

  // Hợp đồng, liên hệ
  CONTRACT_NOT_FOUND: 'Không tìm thấy hợp đồng.',
  CONTACT_REQUEST_NOT_FOUND: 'Không tìm thấy yêu cầu liên hệ.',

  // Chỉ FE: chặn trước khi gọi vì backend chưa hỗ trợ
  EMAIL_CHANGE_UNSUPPORTED: 'Máy chủ chưa cho đổi email của tài khoản.',
} as const
