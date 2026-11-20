import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { defineConfig, normalizePath, type Plugin } from 'vite'
import { resolveSiteUrl, robotsTxt, sitemapXml, withAbsoluteShareImage } from './src/lib/seo/site-files.ts'

// `.claude/` ở gốc repo chứa worktree tạm (bản sao cả repo, có file .html): tạo hay đổi nhánh một worktree làm dev server
// báo tải lại trang hàng loạt. Chỉ bỏ qua `.claude` của chính gốc này — dev server chạy bên trong một worktree vẫn theo dõi
// code của nó (mẫu `**/.claude/**` sẽ khớp cả đường dẫn của worktree đó).
const LOCAL_WORKTREES = `${normalizePath(path.resolve(import.meta.dirname, '.claude'))}/**`

/**
 * Phần SEO của bản build (hàm thuần ở `src/lib/seo/site-files.ts`): `robots.txt` luôn có; `sitemap.xml` và dòng `Sitemap:` chỉ khi
 * bản cài đặt khai `VITE_SITE_URL` — code không viết tên miền nào —, lúc đó ảnh chia sẻ trong `index.html` cũng thành địa chỉ tuyệt
 * đối. Thẻ theo trang (mô tả, canonical, robots) do app ghi lúc chạy (`app/route-title.ts`).
 */
function seoPlugin(): Plugin {
  let siteUrl: string | null = null
  return {
    name: 'loadmaster-seo',
    configResolved(config) {
      siteUrl = resolveSiteUrl(config.env.VITE_SITE_URL as string | undefined)
    },
    transformIndexHtml(html) {
      return withAbsoluteShareImage(html, siteUrl)
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(siteUrl) })
      if (siteUrl !== null) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin()],
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
