import { Component, type ReactNode } from 'react'

/**
 * Chặn lỗi của khung 3D trên trang giới thiệu (tải chunk hỏng, mất ngữ cảnh WebGL lúc dựng): báo `onError` để trang đổi sang hình
 * minh hoạ SVG, không để lỗi làm trắng cả trang. Không hiện gì thay chỗ — nơi dùng tự vẽ hình thay thế.
 */
export class StageBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch() {
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
