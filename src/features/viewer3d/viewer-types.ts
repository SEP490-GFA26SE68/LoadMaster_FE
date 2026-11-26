/** Kiểu điều khiển của viewer 3D, không gắn đơn vị (LM-062: tách khỏi `types/load-plan` mm cũ). */

export type CameraPreset = 'truoc' | 'cua-sau' | 'ben-hong' | 'tren' | 'goc-cheo' | 'gam-xe'

export type ColorMode = 'diem-giao' | 'kien-goc' | 'khoi-luong'

/** Tốc độ phát theo nhịp cố định của mô phỏng tài xế và phương án mẫu (Planner phát theo `TimeScale`). */
export type PlaybackSpeed = 1 | 2 | 4
export const PLAYBACK_SPEEDS: readonly PlaybackSpeed[] = [1, 2, 4]

/** Planner phát theo **thời gian thật ước tính × hệ số** (Spec vật lý 10.3): ở ×10 một bước 10 giây thật chạy trong 1 giây. */
export type TimeScale = 1 | 2 | 5 | 10
export const TIME_SCALES: readonly TimeScale[] = [1, 2, 5, 10]
export const DEFAULT_TIME_SCALE: TimeScale = 10

/** Kiểu bề mặt vẽ cho kiện; kết quả Spec không có trường này nên `adaptResult` dùng một kiểu trung tính. */
export type Packaging = 'carton' | 'pallet' | 'crate'
