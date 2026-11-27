import { BoxGeometry, type BufferGeometry } from 'three'
import type { SceneMaterials } from './materials'
import { partAdders } from './truck-chassis'
import { tintGeometry } from './tint-geometry'
import type { TruckLayout } from './truck-layout'

/**
 * Chi tiết cabin theo hạng (gộp vào hình học chi tiết màu theo đỉnh, một draw): ga-lăng, cản, đèn pha / xi-nhan, cần gạt, kính hông,
 * khe cửa và tay nắm, gương, bậc lên xuống, chắn bùn bánh trước theo cỡ bánh; tải trung / nặng thêm cánh gió nóc và đèn cờ, tải nặng
 * thêm ống xả đứng, còi hơi và tấm che nắng. Mọi vị trí suy từ `layout.cab` và cỡ bánh.
 */
export function addCabDetails(parts: BufferGeometry[], layout: TruckLayout, width: number, m: SceneMaterials) {
  const { box, cylinder } = partAdders(parts)
  const { cab, wheelY, wheelRadius: r, profile, axles } = layout
  const { frontX, backX, bottomY, topY, beltY } = cab
  const [z0, z1] = cab.z
  const mid = width / 2, cabW = z1 - z0
  const van = cab.kind === 'van'
  /** Chiều cao phần mặt trước dưới kính: ga-lăng và đèn nằm ở đây */
  const face = beltY - bottomY

  // Cản trước: từ dưới đáy cabin xuống gần tâm bánh, rộng hết cabin; biển số trước ở giữa.
  const bumperTop = bottomY + 0.06, bumperBottom = Math.max(layout.groundY + 0.22, wheelY - r * 0.1)
  box([0.16, bumperTop - bumperBottom, cabW + 0.04], [frontX - 0.04, (bumperTop + bumperBottom) / 2, mid], m.metal)
  box([0.03, 0.1, cabW - 0.1], [frontX - 0.13, bumperBottom + 0.07, mid], m.chassis)
  box([0.02, 0.11, 0.34], [frontX - 0.125, (bumperTop + bumperBottom) / 2, mid], m.light)

  // Ga-lăng: khung tối và các nan ngang, giữa hai cụm đèn.
  const grilleH = face * 0.38, grilleY = bottomY + face * (van ? 0.42 : 0.46)
  const grilleW = cabW * (van ? 0.5 : 0.62)
  box([0.04, grilleH, grilleW], [frontX - 0.01, grilleY, mid], m.chassis)
  const slats = van ? 3 : 4
  for (let i = 0; i < slats; i++) box([0.05, 0.016, grilleW - 0.06], [frontX - 0.02, grilleY - grilleH / 2 + (i + 0.5) * grilleH / slats, mid], m.metal)

  for (const side of [-1, 1]) {
    const edge = side < 0 ? z0 : z1
    const inward = -side
    // Đèn pha, xi-nhan hổ phách ngay ngoài đèn pha.
    const lampW = Math.min(0.32, cabW * 0.16)
    box([0.045, face * 0.2, lampW], [frontX - 0.02, bottomY + face * 0.3, edge + inward * (lampW / 2 + 0.06)], m.light)
    box([0.045, face * 0.1, 0.1], [frontX - 0.02, bottomY + face * 0.13, edge + inward * 0.1], m.marker)

    // Kính hông (cửa), khe cửa trước / sau, tay nắm.
    const doorFront = van ? cab.windshield[1][0] : frontX + 0.3
    const doorBack = van ? Math.min(backX - 0.1, doorFront + 0.95) : backX - 0.1
    const windowTop = topY - (van ? 0.08 : 0.1)
    box([doorBack - doorFront - 0.12, windowTop - beltY - 0.04, 0.018], [(doorFront + doorBack) / 2 + 0.02, (beltY + windowTop) / 2 + 0.02, edge + side * 0.022], m.windshield)
    for (const x of [doorFront, doorBack]) box([0.02, topY - bottomY - 0.12, 0.02], [x, (topY + bottomY) / 2, edge + side * 0.02], m.skirt)
    box([0.2, 0.045, 0.04], [doorBack - 0.22, beltY - 0.06, edge + side * 0.03], m.chassis)

    // Gương chiếu hậu: cần đỡ từ trụ A ra ngoài và mặt gương (tải nặng gương to, van gương nhỏ trên cửa).
    const mirrorH = van ? 0.16 : profile.stackExhaust ? 0.42 : 0.32
    const armX = van ? cab.windshield[1][0] - 0.12 : frontX + 0.08
    const mirrorY = van ? beltY + 0.12 : beltY + 0.18
    box([0.04, 0.04, 0.26], [armX, mirrorY, edge + side * 0.13], m.metal)
    box([0.13, mirrorH, 0.09], [armX + 0.02, mirrorY + mirrorH / 2 - 0.04, edge + side * 0.28], m.chassis)
    box([0.012, mirrorH - 0.05, 0.07], [armX - 0.05, mirrorY + mirrorH / 2 - 0.04, edge + side * 0.28], m.metal)

    // Bậc lên xuống dưới cửa (cabin cao): một tới hai bậc theo khoảng từ đáy cabin xuống đất.
    const climb = bottomY - layout.groundY
    if (!van) {
      const steps = climb > 0.75 ? 2 : 1
      for (let i = 0; i < steps; i++) box([0.42, 0.05, 0.22], [doorBack - 0.3, bottomY - 0.12 - i * (climb - 0.3) / steps, edge + inward * 0.08], m.metal)
      box([0.03, 0.62, 0.03], [doorBack + 0.04, (beltY + bottomY) / 2, edge + side * 0.012], m.metal)
    }

    // Chắn bùn bánh trước: vòm ba tấm bám theo cỡ bánh, dưới đáy cabin.
    const steer = axles.find((axle) => axle.kind === 'steer')
    if (steer) {
      const archY = wheelY + r + 0.03
      const zTyre = edge + inward * 0.2
      box([r * 2.2, 0.035, 0.36], [steer.x, archY, zTyre], m.chassis)
      for (const dx of [-1, 1]) box([0.035, r * 0.6, 0.36], [steer.x + dx * r * 1.1, archY - r * 0.3, zTyre], m.chassis)
    }
  }

  // Cần gạt nước trên kính chắn gió.
  const [[gx0, gy0], [gx1, gy1]] = cab.windshield
  const wiperX = gx0 + (gx1 - gx0) * 0.08 - 0.02, wiperY = gy0 + (gy1 - gy0) * 0.08
  for (const k of [0.3, 0.64]) box([0.015, 0.018, cabW * 0.28], [wiperX, wiperY, z0 + cabW * k], m.chassis)

  if (profile.roofDeflector) {
    // Cánh gió nghiêng trên nóc (không cao quá nóc thùng hay đáy dàn lạnh), năm đèn cờ ở mép trước nóc.
    const deflector = Math.min(0.8, (layout.reefer?.y[0] ?? layout.boxTopY) - topY - 0.04)
    if (deflector > 0.2) {
      // Tấm nghiêng từ sau mép kính lên tới gần lưng cabin, đỉnh ngang nóc thùng
      const x0 = gx1 + 0.15, x1 = backX - 0.05
      parts.push(tintGeometry(new BoxGeometry(Math.hypot(x1 - x0, deflector), 0.04, cabW - 0.4).rotateZ(Math.atan2(deflector, x1 - x0))
        .translate((x0 + x1) / 2, topY + deflector / 2, mid), m.cab))
    }
    for (let i = 0; i < 5; i++) box([0.05, 0.035, 0.09], [gx1 + 0.06, topY + 0.03, z0 + cabW * (0.3 + i * 0.1)], m.marker)
  }
  if (profile.stackExhaust) {
    // Tải nặng: ống xả đứng sau lưng cabin, tấm che nắng trên kính, hai còi hơi trên nóc.
    const stackZ = Math.min(width - 0.12, z1 - 0.15)
    cylinder(0.065, topY + 0.35 - bottomY, 'y', [backX + 0.13, (topY + 0.35 + bottomY) / 2, stackZ], m.metal, 12)
    cylinder(0.08, 0.3, 'y', [backX + 0.13, topY + 0.1, stackZ], m.chassis, 12)
    box([0.34, 0.03, cabW - 0.1], [gx1 - 0.12, topY + 0.04, mid], m.cab)
    for (const dz of [-0.18, 0.18]) cylinder(0.035, 0.32, 'x', [backX - 0.5, topY + 0.05, mid + dz], m.metal, 10)
  }
}
