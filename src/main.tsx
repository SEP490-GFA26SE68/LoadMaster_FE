import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './app/App'
import { loadLocale } from './lib/i18n'
import { readInitialLocale } from './lib/i18n/locale'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Không tìm thấy phần tử #root')

// Mở bằng `?lang=en` hay đã chọn tiếng Anh trong phiên: tải từ điển trước để màn đầu tiên đúng ngôn ngữ (tải hỏng thì vẽ tiếng Việt)
await loadLocale(readInitialLocale()).catch(() => undefined)

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
