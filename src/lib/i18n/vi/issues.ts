/**
 * Câu cho mã ràng buộc của `@/domain/constraints` (LM-028), key trùng tên mã. Chỉ gọi qua `formatIssue`:
 * số có đơn vị đã được format theo ngôn ngữ trước khi điền vào.
 */
export const issues = {
  /** Chủ thể đứng đầu câu: kiện đã xếp, hoặc dòng vật cản trong form xe. */
  subject: { placement: 'Kiện {id}', obstacle: 'Vật cản {id}' },
  DIMENSION_NOT_POSITIVE: {
    vehicle: '{field} phải lớn hơn {zero}.',
    obstacle: '{field} của vật cản {obstacleId} phải lớn hơn {zero}.',
    package: '{field} của kiện {packageId} phải lớn hơn {zero}.',
  },
  DOOR_EXCEEDS_INNER: {
    y: 'Chiều rộng cửa {doorCm} không được lớn hơn chiều rộng lòng thùng {innerCm}.',
    z: 'Chiều cao cửa {doorCm} không được lớn hơn chiều cao lòng thùng {innerCm}.',
  },
  NO_ALLOWED_ORIENTATION: 'Kiện {packageId} chưa có hướng đặt nào được phép.',
  PAYLOAD_EXCEEDED: 'Tổng khối lượng hàng {totalKg} vượt tải trọng xe {maxPayloadKg}.',
  MUST_LOAD_PAYLOAD_EXCEEDED: 'Riêng các kiện bắt buộc đã nặng {totalKg}, vượt tải trọng xe {maxPayloadKg}.',
  DOOR_TOO_SMALL: 'Kiện {packageId} không lọt qua cửa {door}.',
  EXCEEDS_BOUNDARY: {
    x: {
      beforeOrigin: '{subject} lấn qua vách đầu thùng {overCm}.',
      beyondInterior: '{subject} vượt chiều dài thùng {overCm}.',
    },
    y: {
      beforeOrigin: '{subject} lấn qua vách trái {overCm}.',
      beyondInterior: '{subject} vượt chiều rộng thùng {overCm}.',
    },
    z: {
      beforeOrigin: '{subject} thấp hơn sàn thùng {overCm}.',
      beyondInterior: '{subject} vượt chiều cao thùng {overCm}.',
    },
  },
  OVERLAP: '{id} chồng lấn {related}.',
  OBSTACLE_OVERLAP: '{id} chồng lấn vật cản {obstacleId}.',
  NON_BEARING_SUPPORT: '{id} đặt lên vật cản {obstacleId} không chịu tải.',
  SUPPORT_BELOW_MIN: '{id} có tỷ lệ đỡ đáy {ratio}, thấp hơn mức yêu cầu {required}.',
  TOP_LOAD_EXCEEDED: '{subject} chịu {loadKg} bên trên, vượt mức chịu tải {maxKg}.',
  NOT_STACKABLE: '{id} không được xếp chồng nhưng đang đỡ {related}.',
  STACK_COUNT_EXCEEDED: '{id} nằm trong chồng {layers} tầng, vượt giới hạn {maxStackCount} tầng.',
  LIFO_BLOCKED: '{id} bị kiện giao sau che kín lối dỡ.',
  LIFO_PARTIAL: '{id} bị kiện giao sau che {coverage} lối dỡ.',
  COG_LATERAL: 'Trọng tâm hàng lệch {offsetCm} khỏi đường giữa thùng, vượt ngưỡng {limitCm}.',
  COG_LONGITUDINAL: {
    front: 'Trọng tâm hàng dồn về đầu thùng {offsetCm} so với giữa thùng, vượt ngưỡng {limitCm}.',
    rear: 'Trọng tâm hàng dồn về cửa thùng {offsetCm} so với giữa thùng, vượt ngưỡng {limitCm}.',
  },
  COG_HIGH: 'Trọng tâm hàng cao {heightCm} so với sàn, vượt ngưỡng {limitCm}.',
  AXLE_OVERLOAD: {
    front: 'Tải trục trước {loadKg} vượt giới hạn {limitKg} (quá {overKg}).',
    rear: 'Tải trục sau {loadKg} vượt giới hạn {limitKg} (quá {overKg}).',
  },
  MUST_LOAD_UNPLACED: 'Kiện bắt buộc {packageId} chưa được xếp lên xe.',
  LOADING_ORDER_INFEASIBLE: '{id} được xếp trước kiện đỡ nó: {related}.',
  DUPLICATE_INSTANCE_ID: 'Mã {id} bị trùng ở {occurrences} dòng kiện: {related}.',
  ORIENTATION_MISMATCH: 'Kích thước đã xếp của {id} không khớp hướng {orientation}.',
  ORIENTATION_NOT_ALLOWED: '{id} được đặt theo hướng {orientation}, không thuộc các hướng được phép của kiện.',
  PINNED_INSTANCE_UNKNOWN: 'Kiện đã ghim {id} không còn trong chuyến nên không giữ được.',
} as const
