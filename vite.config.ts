import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, normalizePath } from 'vite'

// `.claude/` ở gốc repo chứa worktree tạm (bản sao cả repo, có file .html): tạo hay đổi nhánh một worktree làm dev server
// báo tải lại trang hàng loạt. Chỉ bỏ qua `.claude` của chính gốc này — dev server chạy bên trong một worktree vẫn theo dõi
// code của nó (mẫu `**/.claude/**` sẽ khớp cả đường dẫn của worktree đó).
const LOCAL_WORKTREES = `${normalizePath(path.resolve(import.meta.dirname, '.claude'))}/**`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Vite đã bỏ qua `test-results`; báo cáo Playwright bị xoá/tạo lại giữa các lượt chạy
    // làm watcher trên Windows ném lỗi scandir và dừng dev server của `pnpm test:e2e`.
    watch: { ignored: ['**/playwright-report/**', '**/blob-report/**', LOCAL_WORKTREES] },
  },
})
