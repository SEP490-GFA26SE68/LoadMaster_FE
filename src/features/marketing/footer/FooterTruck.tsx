/**
 * Xe tải nhìn ngang, đầu xe bên phải, vẽ riêng cho dải đường của chân trang (khung 140 × 60, mặt đường ở y = 56). Màu là token cyan và xám
 * ánh cyan; đèn trước `--amber-200`, đèn sau `--red-500`. Không có chữ hay logo trên thùng (logo không đặt trong ô màu — AGENTS mục 5).
 * Thân xe nằm trong hai nhóm lồng nhau để chuyển động chồng được lên nhau: `footer-truck-pitch` (chúi đầu khi phanh) chứa
 * `footer-truck-bob` (nhún theo mặt đường); bánh xe quay quanh tâm của chính nó (`footer-wheel`). Ống xả đứng sau ca-bin, miệng ống ở
 * (90, 3) — khói của dải đường đặt theo đúng điểm đó (`TRUCK_EXHAUST`).
 */

/** Miệng ống xả theo tỷ lệ của khung hình: khói đặt theo phần trăm nên xe co theo màn vẫn đúng chỗ. */
export const TRUCK_EXHAUST = { left: `${(90 / 140) * 100}%`, top: `${(3 / 60) * 100}%` } as const

/** Bốn chốt quanh tâm bánh: nhìn ra bánh đang quay. */
const BOLTS: readonly (readonly [number, number])[] = [[0, -2.4], [2.4, 0], [0, 2.4], [-2.4, 0]]

function Wheel({ cx }: { cx: number }) {
  return (
    <g className="footer-wheel">
      <circle cx={cx} cy={48} r={8} className="fill-n-900 stroke-n-600" strokeWidth={1.5} />
      <circle cx={cx} cy={48} r={4.2} className="fill-n-300" />
      {BOLTS.map(([dx, dy]) => (
        <circle key={`${dx}:${dy}`} cx={cx + dx} cy={48 + dy} r={0.9} className="fill-n-700" />
      ))}
    </g>
  )
}

export function FooterTruck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 60" className={className} aria-hidden focusable="false">
      <ellipse cx={70} cy={57} rx={64} ry={2.4} className="fill-n-900" opacity={0.6} />
      <g className="footer-truck-pitch">
        <g className="footer-truck-bob">
          {/* Khung gầm */}
          <rect x={6} y={39} width={126} height={5} rx={1.5} className="fill-n-800" />
          {/* Thùng hàng: nẹp dọc, mép trên sáng, bản lề cửa sau, đèn sau */}
          <rect x={4} y={6} width={84} height={34} rx={3} className="fill-cyan-800 stroke-cyan-600" strokeWidth={1} />
          <path d="M7 8.5 H85" className="stroke-cyan-600" strokeWidth={1} strokeLinecap="round" />
          <path d="M25 10 V36 M46 10 V36 M67 10 V36" className="stroke-cyan-700" strokeWidth={1.2} strokeLinecap="round" />
          <path d="M8.5 11 V35" className="stroke-cyan-900" strokeWidth={1.4} strokeLinecap="round" />
          <rect x={2.6} y={32} width={2.4} height={5} rx={0.8} className="fill-red-500" />
          {/* Ống xả đứng sau ca-bin */}
          <rect x={88.5} y={3} width={3} height={36} rx={1.2} className="fill-n-400" />
          <rect x={88} y={2.4} width={4} height={2.2} rx={0.8} className="fill-n-300" />
          {/* Ca-bin: kính trước có vệt phản sáng, khe cửa, tay nắm, cản trước, đèn trước */}
          <path d="M93 40 V14 Q93 10 97 10 H116 L128 23.5 Q134 25.5 134 32 V40 Z" className="fill-cyan-400" />
          <path d="M98 14 H115 L124.5 25 H98 Z" className="fill-cyan-950" />
          <path d="M101 14 H106 L100 22 H98 V17 Z" className="fill-cyan-200" opacity={0.4} />
          <path d="M110 27 V39" className="stroke-cyan-600" strokeWidth={1} strokeLinecap="round" />
          <rect x={104} y={29} width={4} height={1.6} rx={0.8} className="fill-cyan-800" />
          <rect x={128} y={39} width={9} height={4} rx={1.2} className="fill-n-400" />
          <rect x={131.2} y={30} width={2.8} height={4.2} rx={1} className="fill-amber-200" />
        </g>
      </g>
      <Wheel cx={24} />
      <Wheel cx={42} />
      <Wheel cx={114} />
    </svg>
  )
}
