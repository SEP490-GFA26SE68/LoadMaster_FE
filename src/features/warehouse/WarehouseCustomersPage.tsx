
import { useEffect, useMemo, useState } from 'react'
import { Building2, ChevronDown, ChevronRight } from 'lucide-react'
import {
    listDeliveryRequirements,
    type RequirementRow,
} from '@/features/requirements/requirements-api'
import { useT } from '@/lib/i18n'
export function WarehouseCustomersPage() {
    const STATUS_KEYS = {
        PENDING: 'warehouseCustomers.status.PENDING',
        ASSIGNED: 'warehouseCustomers.status.ASSIGNED',
        IN_TRIP: 'warehouseCustomers.status.IN_TRIP',
    } as const
    const t = useT()
    const [rows, setRows] = useState<RequirementRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        async function load() {
            try {
                const result = await listDeliveryRequirements()
                if (active) setRows(result)
            } catch (err) {
                if (active) {
                    setError(
                        err instanceof Error ? err.message : t('warehouseCustomers.loadError'),
                    )
                }
            } finally {
                if (active) setLoading(false)
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [t])

    const customers = useMemo(() => {
        const groups = new Map<
            string,
            {
                id: string
                name: string
                requirements: RequirementRow[]
            }
        >()

        for (const row of rows) {
            const req = row.requirement
            const id = req.customerId ?? `unknown-${req.id}`

            if (!groups.has(id)) {
                groups.set(id, {
                    id,
                    name: req.customerName ?? t('warehouseCustomers.unknownCustomer'),
                    requirements: [],
                })
            }

            groups.get(id)!.requirements.push(row)
        }

        return [...groups.values()]
    }, [rows, t])

    return (
        <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-6">
            <header>
                <h1 className="text-2xl font-semibold text-ink-strong">
                    {t('warehouseCustomers.title')}
                </h1>
                <p className="mt-1 text-sm text-ink-3">
                    {t('warehouseCustomers.description')}
                </p>
            </header>

            {loading && <p>{t('warehouseCustomers.loading')}</p>}

            {error && (
                <p role="alert" className="text-red-600">
                    {error}
                </p>
            )}

            {!loading && !error && customers.length === 0 && (
                <p>{t('warehouseCustomers.empty')}</p>
            )}

            {!loading && !error && (
                <div className="space-y-4">
                    {customers.map((customer) => {
                        const expanded = expandedId === customer.id

                        return (
                            <section
                                key={customer.id}
                                className="rounded-xl border border-border bg-white"
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setExpandedId(expanded ? null : customer.id)
                                    }
                                    aria-expanded={expanded}
                                    className="flex w-full items-center justify-between p-5 text-left"
                                >
                                    <span className="flex items-center gap-3">
                                        <Building2 className="size-5 text-cyan-600" />
                                        <span>
                                            <span className="block font-semibold text-ink-strong">
                                                {customer.name}
                                            </span>
                                            <span className="text-sm text-ink-3">
                                                {t('warehouseCustomers.requirementCount', {
                                                    count: customer.requirements.length,
                                                })}
                                            </span>
                                        </span>
                                    </span>

                                    {expanded ? (
                                        <ChevronDown className="size-5" />
                                    ) : (
                                        <ChevronRight className="size-5" />
                                    )}
                                </button>

                                {expanded && (
                                    <div className="space-y-5 border-t border-border p-5">
                                        {customer.requirements.map(({ requirement: req }) => {
                                            const received = req.receivedPackageCount ?? 0
                                            const expected = req.expectedPackageCount

                                            const percent =
                                                expected != null && expected > 0
                                                    ? Math.min((received / expected) * 100, 100)
                                                    : null

                                            const remaining =
                                                expected == null
                                                    ? null
                                                    : Math.max(expected - received, 0)

                                            const exceeded =
                                                expected != null && received > expected

                                            return (
                                                <div key={req.id} className="space-y-2">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="font-medium text-ink-strong">
                                                            {t('warehouseCustomers.requirement', { id: req.id })}
                                                        </span>

                                                        <span className="text-sm text-ink-3">
                                                            {req.status in STATUS_KEYS
                                                                ? t(STATUS_KEYS[req.status as keyof typeof STATUS_KEYS])
                                                                : req.status}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-ink-3">
                                                        {t('warehouseCustomers.destination', {
                                                            address: req.address,
                                                        })}
                                                    </p>

                                                    <p className="font-semibold">
                                                        {expected == null
                                                            ? t('warehouseCustomers.receivedCount', {
                                                                count: received,
                                                            })
                                                            : t('warehouseCustomers.packageCount', {
                                                                received,
                                                                expected,
                                                            })}
                                                    </p>

                                                    {percent != null && (
                                                        <div
                                                            role="progressbar"
                                                            aria-label={t('warehouseCustomers.requirement', { id: req.id })}
                                                            aria-valuenow={Math.min(received, expected!)}
                                                            aria-valuemin={0}
                                                            aria-valuemax={expected!}
                                                            className="h-2 overflow-hidden rounded-full bg-slate-200"
                                                        >
                                                            <div
                                                                className="h-full rounded-full bg-cyan-500"
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    )}

                                                    <p className="text-sm text-ink-3">
                                                        {expected == null
                                                            ? t('warehouseCustomers.noExpected')
                                                            : exceeded
                                                                ? t('warehouseCustomers.exceeded', {
                                                                    count: received - expected,
                                                                })
                                                                : remaining === 0
                                                                    ? t('warehouseCustomers.complete')
                                                                    : t('warehouseCustomers.remaining', {
                                                                        count: remaining,
                                                                    })}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </section>
                        )
                    })}
                </div>
            )}
        </main>
    )
}
