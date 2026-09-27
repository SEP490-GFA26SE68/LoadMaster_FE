/** Máy Mac dùng ⌘, máy khác dùng Ctrl — chỉ để hiện gợi ý phím (nút trên thanh điều hướng, chân hộp thoại); phím tắt nhận cả hai. */
export const SHORTCUT_KEYS = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘ K' : 'Ctrl K'
