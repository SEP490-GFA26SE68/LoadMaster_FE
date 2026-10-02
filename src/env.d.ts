/** Biến môi trường của app (Vite chỉ lộ biến có tiền tố `VITE_`). Mẫu ở `.env.example`. */
interface ImportMetaEnv {
  /** Khoá map tiles của Goong cho nền bản đồ (FE-4b-07). Để trống: bản đồ dùng nền trống. */
  readonly VITE_GOONG_MAPTILES_KEY?: string
}
