import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// Seed ghi giờ theo đồng hồ Việt Nam và giao diện hiện giờ theo múi máy. Máy CI chạy UTC nên "07:50" thành "00:50";
// khoá múi giờ cho mọi worker để test đọc đúng giờ người dùng thấy.
process.env.TZ = 'Asia/Ho_Chi_Minh'

/**
 * Hai project dùng chung alias `@/` của Vite:
 * - unit: domain và logic thuần, môi trường node, nhanh.
 * - dom: component React qua React Testing Library, file `*.dom.test.tsx`.
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Test luôn chạy trên kho mẫu, kể cả khi `.env.local` của máy dev đang bật chế độ keycloak để chạy với backend
      env: { VITE_AUTH_SOURCE: 'mock' },
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
          },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'jsdom',
            include: ['src/**/*.dom.test.tsx'],
            setupFiles: ['./src/test/setup-dom.ts'],
            // Test màn đi cả luồng người dùng (gõ form, mở Select, chuyển route) mất 2–3 giây khi chạy riêng; chạy song song
            // với cả bộ thì vượt mức 5 giây mặc định dù không hỏng gì (TripFormPage, DriverStopPage — LM-085).
            testTimeout: 15_000,
            // Benchmark domain chỉ chạy một lần, ở project unit (node). `include: []` bị coi là mặc định nên dùng exclude.
            benchmark: { exclude: ['**/*'] },
          },
        },
      ],
      benchmark: {
        include: ['tests/**/*.bench.ts', 'src/**/*.bench.ts'],
      },
    },
  }),
)
