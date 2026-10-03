import type { Dictionary } from './types'
import type { vi } from './vi'
import { language } from './en/language'
import { nav } from './en/nav'
import { roles } from './en/roles'
import { auth } from './en/auth'
import { notFound } from './en/notFound'
import { common } from './en/common'
import { status } from './en/status'
import { manager } from './en/manager'
import { driver } from './en/driver'
import { fleet } from './en/fleet'
import { issues } from './en/issues'
import { optimization } from './en/optimization'
import { trips } from './en/trips'
import { warehouse } from './en/warehouse'
import { viewer } from './en/viewer'
import { fields } from './en/fields'
import { admin } from './en/admin'
import { designSystem } from './en/designSystem'
import { dataErrors } from './en/dataErrors'
import { audit } from './en/audit'
import { profile } from './en/profile'
import { notifications } from './en/notifications'
import { search } from './en/search'
import { titles } from './en/titles'
import { pageHero } from './en/pageHero'
import { qr } from './en/qr'
import { sourcing } from './en/sourcing'
import { requirements } from './en/requirements'
import { readiness } from './en/readiness'
import { vehicleTypes } from './en/vehicleTypes'
import { tripReport } from './en/tripReport'
import { runs } from './en/runs'
import { lookup } from './en/lookup'
import { map } from './en/map'
import { monitoring } from './en/monitoring'

/** Bản tiếng Anh: mỗi nhánh một file trong `en/`, kiểm thiếu/thừa key theo nhánh nguồn `vi/`. */
export const en = {
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
} satisfies Dictionary<typeof vi>
