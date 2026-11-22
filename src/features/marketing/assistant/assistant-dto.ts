/**
 * Hợp đồng của `POST /api/assistant/messages` (trong ứng dụng) và `POST /api/assistant/public/messages` (trang công khai). Chỉ
 * `assistant-api.ts` import file này; kiểu của app nằm ở đó.
 */

/** Màn đang mở: chỉ là gợi ý cho máy chủ, máy chủ không đưa tiêu đề cho mô hình. */
export type AssistantPageDto = { readonly path: string; readonly title: string }

/** Planner bản máy chủ đang mở: chuyến, mã số phương án, mã kiện đang chọn. Chỉ gửi khi có Planner. */
export type AssistantViewerDto = { readonly tripCode: string; readonly loadPlanId: number; readonly selectedPackageCode: string | null }

export type AssistantMessageRequestDto = {
  readonly conversationId?: string
  readonly message: string
  readonly locale: string
  readonly page?: AssistantPageDto
  readonly viewer?: AssistantViewerDto
}

/** `guestKey`: mã ngẫu nhiên của phiên trình duyệt (`^[A-Za-z0-9_-]{16,64}$`), hội thoại của khách chỉ đọc tiếp được với đúng mã đó. */
export type AssistantPublicMessageRequestDto = {
  readonly conversationId?: string
  readonly message: string
  readonly locale: string
  readonly guestKey: string
}

/** Lệnh giao diện cho màn 3D; trường không dùng vắng. */
export type UiActionDto = {
  readonly type: string
  readonly packageCode?: string | null
  readonly preset?: string | null
  readonly step?: number | null
  readonly mode?: string | null
  readonly tab?: string | null
}

export type AssistantLinkDto = { readonly label: string; readonly to: string }

/** `offered`: trợ lý đang hỏi có chuyển cho nhân viên không. `ticketCode`: mã yêu cầu hỗ trợ đã tạo. */
export type HandoffDto = { readonly offered: boolean; readonly ticketCode: string | null }

export type AssistantReplyDto = {
  readonly conversationId: string
  readonly reply: string
  readonly uiActions?: readonly UiActionDto[] | null
  readonly links?: readonly AssistantLinkDto[] | null
  readonly handoff?: HandoffDto | null
}
