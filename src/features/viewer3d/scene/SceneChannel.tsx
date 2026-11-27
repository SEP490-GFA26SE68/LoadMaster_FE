import { useEffect, useState, type ReactNode } from 'react'

/**
 * Kênh đưa nội dung cảnh vào root R3F mà không vẽ lại phần tử `<Canvas>`. R3F v9 cấu hình lại root mỗi lần `<Canvas>` vẽ lại và so cỡ
 * khung đo được (có thêm `x`, `y`, `right`, `bottom`) với `state.size` (chỉ `width`, `height`, `top`, `left`): hai bên không bao giờ
 * khớp nên `setSize` chạy mọi lần — store đổi, mọi `useThree` (camera-controls, `<Html>`…) vẽ lại và cảnh tự vẽ thêm một khung. Giữ
 * `<Canvas>` nguyên vẹn qua bước phát lại và chọn kiện, đẩy cây cảnh mới qua kênh này: chỉ cây cảnh được đối chiếu lại; cỡ khung và
 * ngữ cảnh của app vẫn đi đường cũ (R3F tự đo, cầu ngữ cảnh của `<Canvas>` theo dõi `useContext`).
 */
export type SceneChannel = {
  get: () => ReactNode
  set: (node: ReactNode) => void
  /** Gọi `listener` ngay với nút đang có (người đọc gắn sau lần `set` cuối vẫn bắt kịp), rồi mỗi lần có nút mới. */
  subscribe: (listener: (node: ReactNode) => void) => () => void
}

export function createSceneChannel(): SceneChannel {
  let current: ReactNode = null
  const listeners = new Set<(node: ReactNode) => void>()
  return {
    get: () => current,
    set(node) {
      if (node === current) return
      current = node
      for (const listener of listeners) listener(node)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(current)
      return () => { listeners.delete(listener) }
    },
  }
}

/**
 * Đọc kênh bên trong root R3F. Dùng state thường, không `useSyncExternalStore`: cập nhật đi theo độ ưu tiên sự kiện của R3F như
 * `root.render` vẫn làm, không bị ép đồng bộ vào cùng tác vụ với lần vẽ DOM.
 */
export function SceneChannelContent({ channel }: { channel: SceneChannel }) {
  const [node, setNode] = useState(channel.get)
  // Lần gọi đầu của `subscribe` bắt kịp nút được đặt giữa lần vẽ đầu và lúc gắn; cùng nút thì React bỏ qua, không vẽ lại
  useEffect(() => channel.subscribe(setNode), [channel])
  return node
}
