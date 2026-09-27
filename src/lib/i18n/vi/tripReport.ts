/** Báo cáo chuyến `/chuyen/:tripId/bao-cao` (luồng 5 Review 1, LM-104): số liệu suy từ tiến độ kho và giao hàng của chuyến. */
export const tripReport = {
  title: 'Báo cáo chuyến',
  summary: '{delivered} / {planned} kiện đã giao · {issues} sự cố',
  notCompleted: 'Chuyến chưa hoàn thành, báo cáo đầy đủ khi giao xong điểm cuối.',
} as const
