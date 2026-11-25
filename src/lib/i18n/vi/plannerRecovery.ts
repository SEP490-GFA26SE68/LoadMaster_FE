/**
 * Planner 3D (`/chuyen/:id/phuong-an`) khi không vẽ được: lỗi lúc vẽ màn, phương án máy chủ có kiện không gắn được điểm giao, phương án
 * lỗi thời tính cho xe trước khi đổi xe, và khung 3D mất ngữ cảnh WebGL (dùng chung cho Planner, kho, tài xế).
 */
export const plannerRecovery = {
  crash: {
    code: 'Lỗi',
    title: 'Không mở được phương án 3D',
    description: 'Khung xem phương án gặp sự cố khi vẽ. Tải lại trang; nếu vẫn lỗi, mở lại chuyến từ Chi tiết chuyến.',
    reload: 'Tải lại trang',
    backToTrip: 'Về Chi tiết chuyến',
  },
  unknownStops: {
    title: 'Phương án không khớp điểm giao của chuyến',
    description: {
      one: '{count} kiện của phương án không thuộc điểm giao nào của chuyến ({codes}). Tối ưu lại để có phương án mới.',
      other: '{count} kiện của phương án không thuộc điểm giao nào của chuyến ({codes}). Tối ưu lại để có phương án mới.',
    },
  },
} as const
