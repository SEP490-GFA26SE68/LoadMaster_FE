import { transfers } from './en/transfers'
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
import { tripClaims } from './en/tripClaims'
import { assistantStats } from './en/assistantStats'
import { warehouse } from './en/warehouse'
import { viewer } from './en/viewer'
import { plannerRecovery } from './en/plannerRecovery'
import { fields } from './en/fields'
import { admin } from './en/admin'
import { designSystem } from './en/designSystem'
import { apiErrors } from './en/apiErrors'
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
import { platform } from './en/platform'
import { billing } from './en/billing'
import { payroll } from './en/payroll'
import { payment } from './en/payment'
import { companies } from './en/companies'
import { companyProfile } from './en/companyProfile'
import { support } from './en/support'
import { contacts } from './en/contacts'
import { landing } from './en/landing'
import { landingFaq } from './en/landingFaq'
import { landingFooter } from './en/landingFooter'
import { landingHow } from './en/landingHow'
import { landingJourney } from './en/landingJourney'
import { landingMotion } from './en/landingMotion'
import { landingRoles } from './en/landingRoles'
import { landingStage } from './en/landingStage'
import { landingStory } from './en/landingStory'
import { landingTry } from './en/landingTry'
import { samplePlan } from './en/samplePlan'
import { landingWhy } from './en/landingWhy'
import { pricing } from './en/pricing'
import { privacy } from './en/privacy'
import { terms } from './en/terms'
import { legal } from './en/legal'
import { seo } from './en/seo'
import { warehouseCustomers } from './en/warehouseCustomers'
import { backendTripRoute } from './en/backendTripRoute'
import { serverPlans } from './en/serverPlans'
import { companyWarehouses } from './en/companyWarehouses'
import { tripWarehouse } from './en/tripWarehouse'
import { packageStatus } from './en/packageStatus'
import { serverAudit } from './en/serverAudit'
import { serverWarehouse } from './en/serverWarehouse'
import { trialRegistration } from './en/trialRegistration'
import { guestRegistration } from './en/guestRegistration'
import { assistant } from './en/assistant'

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
  tripClaims,
  assistantStats,
  warehouse,
  viewer,
  plannerRecovery,
  fields,
  admin,
  designSystem,
  dataErrors,
  apiErrors,
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
  platform,
  billing,
  payroll,
  payment,
  companies,
  companyProfile,
  support,
  contacts,
  landing,
  landingFaq,
  landingFooter,
  landingHow,
  landingJourney,
  landingMotion,
  landingRoles,
  landingStage,
  landingStory,
  landingTry,
  samplePlan,
  landingWhy,
  pricing,
  privacy,
  terms,
  legal,
  seo,
  warehouseCustomers,
  backendTripRoute,
  serverPlans,
  companyWarehouses,
  tripWarehouse,
  packageStatus,
  serverAudit,
  serverWarehouse,
  trialRegistration,
  guestRegistration,
  transfers,

  assistant,
} satisfies Dictionary<typeof vi>
