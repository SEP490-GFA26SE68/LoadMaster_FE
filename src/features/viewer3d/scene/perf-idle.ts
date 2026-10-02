/** Khoảng lặng tối thiểu trước khi coi là nghỉ, tính từ frame cuối. */
export const IDLE_AFTER_MS = 250

/**
 * Scene nghỉ khi **demand loop đã dừng**: frame cuối không xin frame tiếp, sau đó không ai xin thêm frame nào, và đã lặng đủ lâu.
 *
 * Không dùng riêng khoảng lặng: máy yếu vẽ 2–3 FPS thì frame nào cũng cách nhau hơn 250 ms, báo nghỉ sẽ giấu FPS ngay lúc cần
 * nhất và `quality-policy` (bỏ qua mẫu nghỉ) sẽ không bao giờ hạ tier (LM-101).
 *
 * `pendingFrames` là số frame R3F còn nợ lúc hỏi (`internal.frames`). Frame cuối chỉ biết những lời xin đến trước khi nó ghi xong;
 * react-spring xin frame kế bằng microtask ngay sau đó, sự kiện con trỏ và effect của React còn đến muộn hơn. Trên máy yếu frame
 * được xin kiểu ấy mất hơn 250 ms mới vẽ, nên thiếu tham số này scene bị báo nghỉ giữa lúc animation đang chạy.
 */
export function isSceneIdle(requestedNextFrame: boolean, msSinceLastFrame: number, pendingFrames = 0): boolean {
  return !requestedNextFrame && pendingFrames === 0 && msSinceLastFrame >= IDLE_AFTER_MS
}
