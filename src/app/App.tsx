import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { Spinner } from '@/components/ui/Spinner'
import { useT, type TFunction } from '@/lib/i18n'
import type { Permission } from '@/features/auth/permissions'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequirePermission } from '@/features/auth/RequirePermission'
import { AppShell } from './AppShell'
import { NotFoundPage } from './NotFoundPage'
import { Providers } from './providers'
import { useRouteTitle, type RouteHandle, type TitleSource } from './route-title'

/**
 * Mỗi màn là một chunk riêng: dispatcher không tải code tài xế, tablet kho
 * không tải recharts của dashboard, và Three.js chỉ nằm trong màn 3D.
 */
const LoginPage = lazy(() => import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })))
const DashboardPage = lazy(() => import('@/features/manager/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const TripListPage = lazy(() => import('@/features/trips/TripListPage').then((m) => ({ default: m.TripListPage })))
const TripFormPage = lazy(() => import('@/features/trips/TripFormPage').then((m) => ({ default: m.TripFormPage })))
const TripDetailPage = lazy(() => import('@/features/trips/TripDetailPage').then((m) => ({ default: m.TripDetailPage })))
const OptimizationSetupPage = lazy(() => import('@/features/optimization/OptimizationSetupPage').then((m) => ({ default: m.OptimizationSetupPage })))
const PlanComparisonPage = lazy(() => import('@/features/trips/PlanComparisonPage').then((m) => ({ default: m.PlanComparisonPage })))
const ViewerPage = lazy(() => import('@/features/viewer3d/ViewerPage').then((m) => ({ default: m.ViewerPage })))
const WarehousePage = lazy(() => import('@/features/warehouse/WarehousePage').then((m) => ({ default: m.WarehousePage })))
const MyTripsPage = lazy(() => import('@/features/driver/MyTripsPage').then((m) => ({ default: m.MyTripsPage })))
const DriverStopPage = lazy(() => import('@/features/driver/DriverStopPage').then((m) => ({ default: m.DriverStopPage })))
const FleetPage = lazy(() => import('@/features/fleet/FleetPage').then((m) => ({ default: m.FleetPage })))
const VehicleDetailPage = lazy(() => import('@/features/fleet/VehicleDetailPage').then((m) => ({ default: m.VehicleDetailPage })))
const UsersPage = lazy(() => import('@/features/admin/UsersPage').then((m) => ({ default: m.UsersPage })))
const AuditLogPage = lazy(() => import('@/features/admin/AuditLogPage').then((m) => ({ default: m.AuditLogPage })))
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
// Review 1 (LM-104): 5 luồng Register → Plan → Optimize → Approve → Execute
const PackageTypesPage = lazy(() => import('@/features/packages-source/PackageTypesPage').then((m) => ({ default: m.PackageTypesPage })))
const PackagesPage = lazy(() => import('@/features/packages-source/PackagesPage').then((m) => ({ default: m.PackagesPage })))
const PackageLabelsPage = lazy(() => import('@/features/packages-source/PackageLabelsPage').then((m) => ({ default: m.PackageLabelsPage })))
const ShipmentsPage = lazy(() => import('@/features/shipments/ShipmentsPage').then((m) => ({ default: m.ShipmentsPage })))
const ShipmentDetailPage = lazy(() => import('@/features/shipments/ShipmentDetailPage').then((m) => ({ default: m.ShipmentDetailPage })))
const ReceivingPage = lazy(() => import('@/features/receiving/ReceivingPage').then((m) => ({ default: m.ReceivingPage })))
const OrdersPage = lazy(() => import('@/features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const VehicleTypesPage = lazy(() => import('@/features/vehicle-types/VehicleTypesPage').then((m) => ({ default: m.VehicleTypesPage })))
const TripReportPage = lazy(() => import('@/features/trips/TripReportPage').then((m) => ({ default: m.TripReportPage })))
const StyleSheetPage = lazy(() => import('./design-system/StyleSheetPage').then((m) => ({ default: m.StyleSheetPage })))
const ComponentSheetPage = lazy(() => import('./design-system/ComponentSheetPage').then((m) => ({ default: m.ComponentSheetPage })))

/** Layout của mỗi nhóm route: chờ chunk của màn và đặt tiêu đề tab theo `handle` của route (LM-100). */
function RouteOutlet() {
  const t = useT()
  useRouteTitle()
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8" role="status" aria-label={t('common.loadingScreen')}>
          <Spinner />
        </div>
      }
    >
      <Outlet />
    </Suspense>
  )
}

/** Nhóm route cần một quyền (D-41): thiếu quyền thì màn 403 thay cho màn đích, tab mang tên màn 403. */
function guarded(permission: Permission, children: RouteObject[]): RouteObject {
  return { element: <RequirePermission permission={permission} />, handle: { permission } satisfies RouteHandle, children }
}

/** Tên màn trên tab (nhánh `titles` của từ điển); màn có mã thì hàm đọc mã từ đường dẫn hoặc truy vấn. */
function titled(title: (t: TFunction, source: TitleSource) => string): RouteHandle {
  return { title }
}

/** Mã trên đường dẫn (`:tripId`, `:vehicleId`): route khai đúng tên tham số nên khớp route là có mã. */
const idParam = ({ params }: TitleSource, name: string) => ({ id: params[name] ?? '' })

/** Màn có mã trên truy vấn (`?chuyen=`): có mã thì kèm mã, chưa chọn thì tên chung. */
function withSearchId(source: TitleSource, name: string, withId: (id: string) => string, plain: string): string {
  const id = source.search.get(name)
  return id ? withId(id) : plain
}

/** Bảng route của ứng dụng; test dựng lại bằng `createMemoryRouter(routes)` để kiểm `handle` (tiêu đề tab). */
export const routes: RouteObject[] = [
  {
    errorElement: <NotFoundPage />,
    children: [
      {
        path: '/dang-nhap',
        element: <RouteOutlet />,
        children: [{ index: true, element: <LoginPage />, handle: titled((t) => t('titles.login')) }],
      },

      {
        element: <RequireAuth />,
        children: [
          // Màn desktop có nav rail.
          {
            element: <AppShell />,
            children: [
              {
                element: <RouteOutlet />,
                children: [
                  guarded('dashboard.view', [{ path: '/', element: <DashboardPage />, handle: titled((t) => t('titles.dashboard')) }]),
                  guarded('trips.view', [
                    { path: '/chuyen', element: <TripListPage />, handle: titled((t) => t('titles.trips')) },
                    { path: '/chuyen/:tripId', element: <TripDetailPage />, handle: titled((t, s) => t('titles.trip', idParam(s, 'tripId'))) },
                  ]),
                  guarded('trips.edit', [
                    { path: '/chuyen/moi', element: <TripFormPage />, handle: titled((t) => t('titles.newTrip')) },
                    { path: '/chuyen/:tripId/sua', element: <TripFormPage />, handle: titled((t, s) => t('titles.editTrip', idParam(s, 'tripId'))) },
                  ]),
                  guarded('optimization.run', [
                    { path: '/chuyen/:tripId/toi-uu', element: <OptimizationSetupPage />, handle: titled((t, s) => t('titles.optimize', idParam(s, 'tripId'))) },
                  ]),
                  guarded('plans.view', [
                    { path: '/chuyen/:tripId/so-sanh', element: <PlanComparisonPage />, handle: titled((t, s) => t('titles.compare', idParam(s, 'tripId'))) },
                  ]),
                  guarded('fleet.view', [
                    { path: '/doi-xe', element: <FleetPage />, handle: titled((t) => t('titles.fleet')) },
                    { path: '/doi-xe/:vehicleId', element: <VehicleDetailPage />, handle: titled((t, s) => t('titles.vehicle', idParam(s, 'vehicleId'))) },
                  ]),
                  guarded('fleet.edit', [{ path: '/doi-xe/moi', element: <VehicleDetailPage />, handle: titled((t) => t('titles.newVehicle')) }]),
                  guarded('users.manage', [{ path: '/nguoi-dung', element: <UsersPage />, handle: titled((t) => t('titles.users')) }]),
                  guarded('audit.view', [{ path: '/nhat-ky', element: <AuditLogPage />, handle: titled((t) => t('titles.audit')) }]),
                  // Hồ sơ cá nhân (LM-096): mọi người đã đăng nhập, không cần quyền riêng.
                  { path: '/ho-so', element: <ProfilePage />, handle: titled((t) => t('titles.profile')) },
                  // Review 1 (LM-104): nguồn hàng của nhà sản xuất, nhận hàng của logistics, đơn hàng, loại xe, báo cáo chuyến
                  guarded('packages.register', [
                    { path: '/loai-kien', element: <PackageTypesPage />, handle: titled((t) => t('titles.packageTypes')) },
                    { path: '/kien-hang', element: <PackagesPage />, handle: titled((t) => t('titles.packages')) },
                    { path: '/kien-hang/nhan', element: <PackageLabelsPage />, handle: titled((t) => t('titles.labels')) },
                  ]),
                  guarded('shipments.manage', [
                    { path: '/lo-hang', element: <ShipmentsPage />, handle: titled((t) => t('titles.shipments')) },
                    { path: '/lo-hang/:shipmentId', element: <ShipmentDetailPage />, handle: titled((t, s) => t('titles.shipment', idParam(s, 'shipmentId'))) },
                  ]),
                  guarded('receiving.operate', [{ path: '/nhan-hang', element: <ReceivingPage />, handle: titled((t) => t('titles.receiving')) }]),
                  guarded('orders.view', [{ path: '/don-hang', element: <OrdersPage />, handle: titled((t) => t('titles.orders')) }]),
                  guarded('fleet.view', [{ path: '/doi-xe/loai-xe', element: <VehicleTypesPage />, handle: titled((t) => t('titles.vehicleTypes')) }]),
                  guarded('trips.view', [
                    { path: '/chuyen/:tripId/bao-cao', element: <TripReportPage />, handle: titled((t, s) => t('titles.tripReport', idParam(s, 'tripId'))) },
                  ]),
                ],
              },
            ],
          },

          // Màn toàn màn hình, không nav rail (theo bản design).
          {
            element: <RouteOutlet />,
            children: [
              guarded('plans.view', [
                { path: '/chuyen/:tripId/phuong-an', element: <ViewerPage />, handle: titled((t, s) => t('titles.plan', idParam(s, 'tripId'))) },
              ]),
              // `/kho` là danh sách chuyến cần xếp; `/kho?chuyen=<mã>` là phiên xếp của chuyến đó (LM-086).
              guarded('warehouse.operate', [{
                path: '/kho',
                element: <WarehousePage />,
                handle: titled((t, s) => withSearchId(s, 'chuyen', (id) => t('titles.loading', { id }), t('titles.warehouse'))),
              }]),
              // `/tai-xe` là "Chuyến của tôi"; `/tai-xe/diem-giao?chuyen=<mã>` là một chuyến; đường dẫn lạ về danh sách (LM-087).
              guarded('driver.operate', [
                { path: '/tai-xe', element: <MyTripsPage />, handle: titled((t) => t('titles.driverTrips')) },
                {
                  path: '/tai-xe/diem-giao',
                  element: <DriverStopPage />,
                  handle: titled((t, s) => withSearchId(s, 'chuyen', (id) => t('titles.delivery', { id }), t('titles.driverTrips'))),
                },
                { path: '/tai-xe/*', element: <Navigate to="/tai-xe" replace /> },
              ]),
            ],
          },
        ],
      },

      // Tài liệu bàn giao cho đội dev/design, dựng từ chính component thật.
      {
        element: <RouteOutlet />,
        children: [
          { path: '/kieu-dang', element: <StyleSheetPage />, handle: titled((t) => t('titles.styleSheet')) },
          { path: '/thanh-phan', element: <ComponentSheetPage />, handle: titled((t) => t('titles.componentSheet')) },
        ],
      },

      // Màn 404 và màn lỗi của router tự đặt tiêu đề tab (`useDocumentTitle`): không nằm dưới `RouteOutlet`.
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]

const router = createBrowserRouter(routes)

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}
