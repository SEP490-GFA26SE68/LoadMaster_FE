import { orientDimensions, type OrientationCode } from '@/domain/geometry'
import { computeMetrics } from '@/domain/metrics'
import type { CargoPackage, OptimizationRequest, OptimizationResult, PackagePlacement, VehicleConfig } from '@/domain/models'
import { stopVolumes, stopZones, zonePlacements } from '@/domain/zones'
import type { DeliveryStop } from '@/lib/mock-db'

export const BENCHMARK_COUNTS = [132, 300, 500, 1000] as const
export type BenchmarkCount = (typeof BENCHMARK_COUNTS)[number]

const GRID: Record<BenchmarkCount, readonly [number, number, number]> = {
  132: [11, 4, 3],
  300: [15, 5, 4],
  500: [20, 5, 5],
  1000: [20, 10, 5],
}
const STOP_NAMES = [
  'Thực phẩm Sài Gòn', 'Co.opmart Bình Dương', 'Bách Hoá Xanh Dĩ An', 'Long Châu Biên Hoà',
  'Co.opmart Biên Hoà', 'Bách Hoá Xanh Thủ Đức', 'WinMart Tân Uyên', 'Lotte Mart Thuận An',
]
/** Fixture mặc định có 4 điểm giao và không chia vùng — các phép đo có từ trước giữ nguyên thứ chúng đo. */
const DEFAULT_STOPS = 4

/** `?debug&packages=N&stops=1|4|8` (FE-5b-07): fixture có chừng đó điểm giao **và có vùng theo điểm giao**, để đo draw call của dải vùng. */
export const BENCHMARK_STOP_COUNTS = [1, 4, 8] as const
export type BenchmarkStopCount = (typeof BENCHMARK_STOP_COUNTS)[number]

export function benchmarkStopCountFromSearch(search: string): BenchmarkStopCount | undefined {
  const params = new URLSearchParams(search)
  if (!params.has('debug') || !params.has('stops')) return undefined
  const count = Number(params.get('stops'))
  return BENCHMARK_STOP_COUNTS.find((allowed) => allowed === count)
}
const SIZES = [[0.86, 0.84, 0.8], [0.7, 0.94, 0.9], [0.92, 0.75, 0.72]] as const

/** Chỉ kích hoạt trong debug; không thay dữ liệu nghiệp vụ. */
export function benchmarkCountFromSearch(search: string): BenchmarkCount | undefined {
  const params = new URLSearchParams(search)
  if (!params.has('debug')) return undefined
  const count = Number(params.get('packages'))
  return BENCHMARK_COUNTS.find((allowed) => allowed === count)
}

export type BenchmarkInput = {
  readonly trip: { readonly id: string; readonly stops: readonly DeliveryStop[] }
  readonly request: OptimizationRequest
  readonly result: OptimizationResult
  readonly ordersRecomputed: boolean
}

const BENCHMARK_ORIENTATIONS: readonly OrientationCode[] = ['LWH', 'WLH', 'HWL']
const WALL_GAP_CM = 2

/**
 * Fixture renderer cho Planner (LM-031): request + result đúng contract Spec, cm nguyên. Mỗi kiện một ô riêng nên không chồng
 * lấn, không vượt thùng; kiện gốc ghi kích thước danh nghĩa, placement ghi kích thước đã xoay theo `orientation`.
 * Không phải kết quả tối ưu và không đi qua mock repository.
 *
 * `zonedStops` (FE-5b-07): chia cột theo chừng đó điểm giao rồi chia vùng bằng `stopZones` theo thể tích kiện của từng điểm; placement
 * mang `stopZoneId`, metrics có `rehandlingCount`. Vắng thì fixture như trước: 4 điểm giao, không vùng, một ca LIFO che kín.
 */
export function createBenchmarkInput(count: BenchmarkCount, zonedStops?: BenchmarkStopCount): BenchmarkInput {
  const stopCount = zonedStops ?? DEFAULT_STOPS
  const [along, across, layers] = GRID[count]
  const vehicle: VehicleConfig = {
    id: 'BENCH-VEHICLE',
    name: 'Thùng kiểm thử hiệu năng · 60C-446.32',
    innerLengthCm: 720,
    innerWidthCm: 235,
    innerHeightCm: 240,
    maxPayloadKg: 9500,
    doorWidthCm: 235,
    doorHeightCm: 240,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [],
  }
  const cellLength = Math.floor((vehicle.innerLengthCm - WALL_GAP_CM * 2) / along)
  const cellWidth = Math.floor((vehicle.innerWidthCm - WALL_GAP_CM * 2) / across)
  const cellHeight = Math.floor(vehicle.innerHeightCm / layers)
  const packages: CargoPackage[] = []
  const placements: PackagePlacement[] = []
  // Cột sát vách trước giao cuối (điểm 4), cột sát cửa giao đầu (điểm 1).
  const columnStop = (column: number) => stopCount - Math.min(stopCount - 1, Math.floor((column * stopCount) / along))
  // LM-036: đúng một ca LIFO che kín cho browser suite. Kiện tầng trên cùng ở cột cuối của điểm 3 đổi thành điểm 2, kiện cùng ô
  // ở cột ngay sau (phía cửa) đổi thành điểm 3; số kiện mỗi điểm giữ nguyên. Hàng ngang được chọn để kiện chắn (dạng kế tiếp
  // trong SIZES) rộng và cao hơn, phủ trọn mặt sau kiện bị chắn.
  const lifoColumn = Array.from({ length: along }, (_, column) => column).findLast((column) => columnStop(column) === 3) ?? 0
  const lifoIndex = lifoColumn * across * layers + (layers - 1) * across + ((lifoColumn + layers - 1) % SIZES.length === 1 ? 1 : 0)
  const swappedStops = zonedStops === undefined ? new Map([[lifoIndex, 2], [lifoIndex + across * layers, 3]]) : new Map<number, number>()

  for (let index = 0; index < count; index++) {
    const column = Math.floor(index / (across * layers))
    const layer = Math.floor(index / across) % layers
    const slot = index % across
    const shape = SIZES[(column + slot + layer) % SIZES.length] ?? SIZES[0]
    const orientation = BENCHMARK_ORIENTATIONS[index % BENCHMARK_ORIENTATIONS.length] ?? 'LWH'
    const placed = {
      lengthCm: Math.floor(cellLength * shape[0]),
      widthCm: Math.floor(cellWidth * shape[1]),
      heightCm: Math.floor(cellHeight * shape[2]),
    }
    // Ba hướng dùng ở đây tự nghịch đảo: áp lại hướng lên kích thước đã xoay ra kích thước danh nghĩa.
    const nominal = orientDimensions(placed, orientation)
    const id = `BENCH-${String(index + 1).padStart(5, '0')}`
    packages.push({
      id,
      name: `Kiện đo ${index + 1}`,
      lengthCm: nominal.placedLengthCm,
      widthCm: nominal.placedWidthCm,
      heightCm: nominal.placedHeightCm,
      weightKg: 2 + (index % 9) * 0.5,
      quantity: 1,
      allowedOrientations: ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL'],
      keepUpright: false,
      fragilityLevel: index % 11 === 0 ? 'HIGH' : 'NONE',
      stackable: true,
      maxTopLoadKg: 500,
      // Kiện tầng trên nhỏ hơn ô có thể thiếu đỡ: chỉ là cảnh báo, fixture vẫn đo được editor (LM-035).
      minSupportRatio: 0.8,
      deliveryStop: swappedStops.get(index) ?? columnStop(column),
      priority: 0,
      mustLoad: false,
    })
    placements.push({
      packageInstanceId: `${id}-01`,
      orientation,
      xCm: WALL_GAP_CM + column * cellLength,
      yCm: WALL_GAP_CM + slot * cellWidth,
      zCm: layer * cellHeight,
      placedLengthCm: placed.lengthCm,
      placedWidthCm: placed.widthCm,
      placedHeightCm: placed.heightCm,
      loadingOrder: index + 1,
      unloadingOrder: 0,
      supportRatio: 1,
      constraintWarnings: [],
    })
  }

  // Dỡ theo điểm giao tăng, trong một điểm từ cửa vào (chỉ số giảm): ca LIFO ở trên thành một lần mô phỏng dỡ bị chặn.
  placements.map((_, index) => index)
    .sort((a, b) => packages[a]!.deliveryStop - packages[b]!.deliveryStop || b - a)
    .forEach((index, rank) => { placements[index]!.unloadingOrder = rank + 1 })
  const weightByInstanceId = new Map(packages.map((pkg) => [`${pkg.id}-01`, pkg.weightKg]))
  const zones = zonedStops === undefined ? undefined : stopZones(vehicle, stopVolumes(packages))
  const zoned = zones === undefined ? undefined : zonePlacements(zones, placements, new Map(packages.map((pkg) => [`${pkg.id}-01`, pkg.deliveryStop])))
  return {
    trip: {
      id: zonedStops === undefined ? `BENCH-${count}` : `BENCH-${count}-S${zonedStops}`,
      stops: STOP_NAMES.slice(0, stopCount).map((name, index) => ({ id: `BENCH-STOP-${index + 1}`, name, address: name })),
    },
    request: {
      vehicle,
      packages,
      settings: { method: 'MOCK', timeLimitSeconds: 30, enforceLifo: false, prioritizeLowCenterOfGravity: false },
    },
    result: {
      jobId: `BENCH-${count}`,
      status: 'COMPLETED',
      method: 'MOCK',
      isMockResult: true,
      placements: zoned?.placements ?? placements,
      unplacedPackages: [],
      ...(zones === undefined ? {} : { stopZones: zones }),
      metrics: computeMetrics({ vehicle, placements, weightByInstanceId, unplacedCount: 0, runtimeMs: 0, rehandlingCount: zoned?.rehandlingCount }),
    },
    ordersRecomputed: false,
  }
}
