import { language } from './vi/language'
import { nav } from './vi/nav'
import { roles } from './vi/roles'
import { auth } from './vi/auth'
import { notFound } from './vi/notFound'
import { common } from './vi/common'
import { status } from './vi/status'
import { manager } from './vi/manager'
import { driver } from './vi/driver'
import { fleet } from './vi/fleet'
import { issues } from './vi/issues'
import { optimization } from './vi/optimization'
import { trips } from './vi/trips'
import { warehouse } from './vi/warehouse'
import { viewer } from './vi/viewer'
import { fields } from './vi/fields'
import { admin } from './vi/admin'
import { designSystem } from './vi/designSystem'
import { dataErrors } from './vi/dataErrors'
import { audit } from './vi/audit'
import { profile } from './vi/profile'
import { notifications } from './vi/notifications'
import { search } from './vi/search'
import { titles } from './vi/titles'
import { pageHero } from './vi/pageHero'
import { qr } from './vi/qr'
import { sourcing } from './vi/sourcing'
import { requirements } from './vi/requirements'
import { readiness } from './vi/readiness'
import { vehicleTypes } from './vi/vehicleTypes'
import { tripReport } from './vi/tripReport'
import { runs } from './vi/runs'
import { lookup } from './vi/lookup'
import { map } from './vi/map'
import { monitoring } from './vi/monitoring'
import { pickups } from './vi/pickups'
import { platform } from './vi/platform'
import { billing } from './vi/billing'
import { payment } from './vi/payment'
import { companies } from './vi/companies'
import { support } from './vi/support'

/**
 * Từ điển nguồn. Mọi ngôn ngữ khác khai báo `satisfies Dictionary<typeof vi>`,
 * nên thêm key ở đây mà quên dịch là `tsc -b` báo lỗi.
 *
 * - Tham số viết `{ten}` và phải xuất hiện đủ trong mọi bản dịch.
 * - Câu đổi theo số lượng là object đúng hai key `one` / `other`, tham số `{count}`.
 * - Mỗi nhánh cấp 1 là một file trong `vi/` (LM-080): thêm nhánh = thêm file + một dòng ghép ở đây và ở `en.ts`.
 * - Tên riêng không dịch (LoadMaster, MOCK RESULT) thì để thẳng trong JSX, không đưa vào đây.
 */
export const vi = {
  language,
  nav,
  roles,
  auth,
  notFound,
  common,
  status,
  manager,
  driver,
  fleet,
  issues,
  optimization,
  trips,
  warehouse,
  viewer,
  fields,
  admin,
  designSystem,
  dataErrors,
  audit,
  profile,
  notifications,
  search,
  titles,
  pageHero,
  qr,
  sourcing,
  requirements,
  readiness,
  vehicleTypes,
  tripReport,
  runs,
  lookup,
  map,
  monitoring,
  pickups,
  platform,
  billing,
  payment,
  companies,
  support,
} as const
