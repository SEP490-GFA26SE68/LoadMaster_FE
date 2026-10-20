import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig, normalizePath, runnerImport, type Plugin } from 'vite'
import { seo } from './src/lib/i18n/vi/seo.ts'
import { faqEntries, robotsTxt, seoBlock, sitemapXml, withFontPreloads, withSeoBlock, type FaqEntry } from './src/lib/seo/html-head.ts'
import { SEO_PAGES, type SeoPage } from './src/lib/seo/pages.ts'

// `.claude/` ở gốc repo chứa worktree tạm (bản sao cả repo, có file .html): tạo hay đổi nhánh một worktree làm dev server
// báo tải lại trang hàng loạt. Chỉ bỏ qua `.claude` của chính gốc này — dev server chạy bên trong một worktree vẫn theo dõi
// code của nó (mẫu `**/.claude/**` sẽ khớp cả đường dẫn của worktree đó).
const LOCAL_WORKTREES = `${normalizePath(path.resolve(import.meta.dirname, '.claude'))}/**`

const SRC = path.resolve(import.meta.dirname, './src')

/**
 * Câu hỏi của mục Hỏi đáp (bản tiếng Việt) cho JSON-LD `FAQPage`. Nhánh `landingFaq` có thể import qua `@/`, nên đọc bằng module runner
 * của Vite thay vì import thẳng vào cấu hình; đọc không được thì trang vẫn build, chỉ thiếu khối Hỏi đáp.
 */
async function loadFaq(root: string): Promise<{ entries: FaqEntry[]; error?: unknown }> {
  try {
    const { module } = await runnerImport<{ landingFaq?: unknown }>(path.join(SRC, 'lib/i18n/vi/landingFaq.ts'), {
      root,
      logLevel: 'silent',
      resolve: { alias: { '@': SRC } },
    })
    return { entries: faqEntries(module.landingFaq) }
  } catch (error) {
    return { entries: [], error }
  }
}

/**
 * Trang công khai cho công cụ tìm kiếm và ô xem trước khi chia sẻ (thẻ meta, Open Graph, JSON-LD — `src/lib/seo/html-head.ts`):
 * - mọi HTML mang khối thẻ của trang giới thiệu (khách mở gốc `/` là sang đó); build ghi thêm `<đường dẫn>/index.html` và
 *   `<đường dẫn>.html` cho từng trang công khai với thẻ của chính trang — bot không chạy JavaScript vẫn đọc đúng tiêu đề, mô tả, canonical
 *   của trang đó. Bản `.html` để máy chủ tĩnh trả đúng trang ở địa chỉ không có `/` cuối (`vite preview`, URL gọn của Netlify, Vercel,
 *   Cloudflare Pages) thay vì rơi về HTML gốc;
 * - `robots.txt`, `sitemap.xml` sinh từ `SITE_INFO` (dev trả qua middleware, build ghi vào thư mục ra) — không có bản viết tay;
 * - build tải trước hai file font Archivo của phần đầu trang để chữ tiêu đề không đổi font giữa chừng (CLS).
 */
function seoPlugin(): Plugin {
  let command: 'build' | 'serve' = 'serve'
  let base = '/'
  let root = import.meta.dirname
  let faq: FaqEntry[] = []
  const files: Readonly<Record<string, () => { type: string; body: string }>> = {
    '/robots.txt': () => ({ type: 'text/plain; charset=utf-8', body: robotsTxt() }),
    '/sitemap.xml': () => ({ type: 'application/xml; charset=utf-8', body: sitemapXml() }),
  }
  return {
    name: 'loadmaster-seo',
    configResolved(config) {
      command = config.command
      base = config.base
      root = config.root
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = files[req.url?.split('?')[0] ?? '']
        if (file === undefined) return next()
        const { type, body } = file()
        res.setHeader('Content-Type', type)
        res.end(body)
      })
    },
    async buildStart() {
      if (command !== 'build') return
      const loaded = await loadFaq(root)
      faq = loaded.entries
      if (loaded.error !== undefined) this.warn(`landingFaq: bỏ JSON-LD FAQPage (${String(loaded.error)})`)
      else if (faq.length === 0) this.warn('landingFaq: chưa có câu hỏi nào (items) — bỏ JSON-LD FAQPage')
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        // HTML gốc phục vụ cả màn ứng dụng: mang thẻ của trang giới thiệu nhưng không mang Hỏi đáp (chỉ trang giới thiệu có mục đó)
        const withHead = withSeoBlock(html, seoBlock('landing', seo))
        return ctx.bundle ? withFontPreloads(withHead, Object.keys(ctx.bundle), base) : withHead
      },
    },
    generateBundle() {
      for (const [url, file] of Object.entries(files)) this.emitFile({ type: 'asset', fileName: url.slice(1), source: file().body })
    },
    async writeBundle(options) {
      const dir = options.dir ?? path.resolve(root, 'dist')
      const html = await readFile(path.join(dir, 'index.html'), 'utf8')
      for (const [page, pagePath] of Object.entries(SEO_PAGES) as [SeoPage, string][]) {
        const pageDir = path.join(dir, pagePath)
        const pageHtml = withSeoBlock(html, seoBlock(page, seo, page === 'landing' ? faq : []))
        await mkdir(pageDir, { recursive: true })
        await writeFile(path.join(pageDir, 'index.html'), pageHtml)
        await writeFile(`${pageDir}.html`, pageHtml)
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin()],
  resolve: {
    alias: {
      '@': SRC,
    },
  },
  server: {
    // Vite đã bỏ qua `test-results`; báo cáo Playwright bị xoá/tạo lại giữa các lượt chạy
    // làm watcher trên Windows ném lỗi scandir và dừng dev server của `pnpm test:e2e`.
    watch: { ignored: ['**/playwright-report/**', '**/blob-report/**', LOCAL_WORKTREES] },
  },
})
