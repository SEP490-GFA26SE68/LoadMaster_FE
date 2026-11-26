import { useEffect } from 'react'

/**
 * Giải phóng một tài nguyên GPU (geometry, material) khi nó bị thay bằng bản mới hoặc khi gỡ component. Mỗi tài nguyên một lần gọi: gộp
 * nhiều tài nguyên vào một effect thì chỉ một cái đổi cũng giải phóng cả những cái còn đang vẽ.
 */
export function useDisposeOnChange(resource: { dispose(): void } | null | undefined) {
  useEffect(() => () => resource?.dispose(), [resource])
}
