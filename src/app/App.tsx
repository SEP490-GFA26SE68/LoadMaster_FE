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
// Review 1 (LM-104): kho kiện (FE-3b-03), loại xe, báo cáo chuyến; yêu cầu giao thay đơn hàng (FE-4b-02). Lô hàng và nhận hàng đã bỏ (FE-0-06): đường dẫn cũ là màn 404.
const PackageTypesPage = lazy(() => import('@/features/package-pool/PackageTypesPage').then((m) => ({ default: m.PackageTypesPage })))
const PackagesPage = lazy(() => import('@/features/package-pool/PackagesPage').then((m) => ({ default: m.PackagesPage })))
const PackageLabelsPage = lazy(() => import('@/features/package-pool/PackageLabelsPage').then((m) => ({ default: m.PackageLabelsPage })))
const PackageLookupPage = lazy(() => import('@/features/package-pool/PackageLookupPage').then((m) => ({ default: m.PackageLookupPage })))
const MonitoringPage = lazy(() => import('@/features/monitoring/MonitoringPage').then((m) => ({ default: m.MonitoringPage })))
const RequirementsPage = lazy(() => import('@/features/requirements/RequirementsPage').then((m) => ({ default: m.RequirementsPage })))
const VehicleTypesPage = lazy(() => import('@/features/vehicle-types/VehicleTypesPage').then((m) => ({ default: m.VehicleTypesPage })))
const TripReportPage = lazy(() => import('@/features/trips/TripReportPage').then((m) => ({ default: m.TripReportPage })))
const CompaniesPage = lazy(() => import('@/features/platform/CompaniesPage').then((m) => ({ default: m.CompaniesPage })))
const PlansPage = lazy(() => import('@/features/platform/PlansPage').then((m) => ({ default: m.PlansPage })))
const BillingPage = lazy(() => import('@/features/billing/BillingPage').then((m) => ({ default: m.BillingPage })))
const PaymentSimulationPage = lazy(() => import('@/features/billing/PaymentSimulationPage').then((m) => ({ default: m.PaymentSimulationPage })))
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
                  // Công ty: màn chính của quản trị hệ thống (FE-8-06, D-65)
                  guarded('companies.manage', [{ path: '/nen-tang/cong-ty', element: <CompaniesPage />, handle: titled((t) => t('titles.companies')) }]),
                  // Danh mục gói cước: màn chính của quản lý nền tảng (FE-8-02, D-90)
                  guarded('subscriptionPlans.manage', [{ path: '/nen-tang/goi', element: <PlansPage />, handle: titled((t) => t('titles.subscriptionPlans')) }]),
                  // Gói cước và credit của công ty, thanh toán giả lập (FE-8-03, FE-8-04): quản trị công ty
                  guarded('billing.manage', [
                    { path: '/goi-cuoc', element: <BillingPage />, handle: titled((t) => t('titles.billing')) },
                    { path: '/thanh-toan/gia-lap', element: <PaymentSimulationPage />, handle: titled((t) => t('titles.payment')) },
                  ]),
                  // Hồ sơ cá nhân (LM-096): mọi người đã đăng nhập, không cần quyền riêng.
                  { path: '/ho-so', element: <ProfilePage />, handle: titled((t) => t('titles.profile')) },
                  // Kho kiện (FE-3b-03): điều phối viên quản lý, quản lý công ty xem (`packages.view`); loại kiện là của điều phối viên
                  guarded('packages.view', [{ path: '/kien-hang', element: <PackagesPage />, handle: titled((t) => t('titles.packages')) }]),
                  guarded('packages.manage', [
                    { path: '/loai-kien', element: <PackageTypesPage />, handle: titled((t) => t('titles.packageTypes')) },
                  ]),
                  // In nhãn (FE-3b-05) và Tra cứu kiện (FE-3b-06): điều phối viên và nhân viên kho — kho mở từ màn chính `/kho`
                  guarded('labels.print', [{ path: '/kien-hang/nhan', element: <PackageLabelsPage />, handle: titled((t) => t('titles.labels')) }]),
                  guarded('packages.lookup', [{ path: '/tra-cuu-kien', element: <PackageLookupPage />, handle: titled((t) => t('titles.lookup')) }]),
                  // Yêu cầu giao (FE-4b-02, D-72): quản lý công ty tạo và sửa, điều phối viên xem và đưa vào chuyến. Đường dẫn cũ của màn Đơn
                  // hàng chuyển hướng sang đây (PRD v2 mục 9)
                  guarded('requirements.view', [
                    { path: '/yeu-cau-giao', element: <RequirementsPage />, handle: titled((t) => t('titles.requirements')) },
                    { path: '/don-hang', element: <Navigate to="/yeu-cau-giao" replace />, handle: titled((t) => t('titles.requirements')) },
                  ]),
                  // Giám sát chuyến Đang vận chuyển (FE-6-10, D-86): điều phối viên và quản lý công ty
                  guarded('monitoring.view', [{ path: '/giam-sat', element: <MonitoringPage />, handle: titled((t) => t('titles.monitoring')) }]),
                  // Loại xe, báo cáo chuyến (LM-104)
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
