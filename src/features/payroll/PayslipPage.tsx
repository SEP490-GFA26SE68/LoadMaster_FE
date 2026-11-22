import { useCan } from '@/features/auth/useCan'

import { DispatcherPayslipPage } from './DispatcherPayslipPage'
import { WarehousePayslipPage } from './WarehousePayslipPage'

/**
 * `/phieu-luong` (`payroll.viewOwn`): một route cho hai phiếu lương. Nhân viên kho (`warehouse.operate`) xem phiếu lương kho theo kg
 * đã xếp; điều phối viên xem phiếu lương điều phối. Hỏi quyền chứ không hỏi tên vai trò, như nút thoát của màn kho.
 */
export function PayslipPage() {
  const can = useCan()
  return can('warehouse.operate') ? <WarehousePayslipPage /> : <DispatcherPayslipPage />
}
