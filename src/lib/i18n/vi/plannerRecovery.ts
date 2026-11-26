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
  /** Câu thứ hai của thanh lỗi thời khi kiện của phương án không còn vừa lòng thùng xe hiện tại của chuyến (xe đã đổi). */
  otherVehicle: 'Phương án được tính cho xe trước khi đổi xe: kiện không còn vừa lòng thùng xe hiện tại nên không vẽ vào xe này. Tối ưu lại để có phương án cho xe này.',
  /** Câu thứ hai của thanh lỗi thời khi máy chủ biết xe của phương án và xe đó khác xe hiện tại: khung 3D vẽ phương án trong xe đó. */
  planVehicle: 'Phương án được tính cho xe {vehicle} trước khi đổi xe; khung 3D vẽ phương án trong xe đó. Tối ưu lại để có phương án cho xe hiện tại.',
  /** Lớp phủ khi khung 3D mất ngữ cảnh WebGL (`SceneCanvas`: Planner, kho, tài xế). */
  contextLost: {
    title: 'Khung 3D bị mất kết nối đồ hoạ',
    description: 'Trình duyệt đã thu hồi bộ nhớ đồ hoạ của khung 3D. Dữ liệu trên màn vẫn còn.',
    reload: 'Tải lại khung 3D',
  },
} as const
