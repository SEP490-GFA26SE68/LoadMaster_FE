import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig } from 'vite'

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
  },
})


