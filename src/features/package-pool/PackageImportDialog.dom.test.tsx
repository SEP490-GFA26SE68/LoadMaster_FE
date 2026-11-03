import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { PackageImportDialog } from './PackageImportDialog'
import * as packageImportApi from './package-import-api'
import * as requirementsApi from '@/features/requirements/requirements-api'

vi.mock('./package-import-api', async () => {
  const actual = await vi.importActual<typeof import('./package-import-api')>('./package-import-api')
  return {
    ...actual,
    previewCargoPackageImport: vi.fn(),
    confirmCargoPackageImport: vi.fn(),
  }
})

vi.mock('@/features/requirements/requirements-api', () => ({
  listDeliveryRequirements: vi.fn(),
}))

function renderImportDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const onClose = vi.fn()
  const onDone = vi.fn()

  render(
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <PackageImportDialog onClose={onClose} onDone={onDone} />
      </QueryClientProvider>
    </I18nProvider>,
  )

  return { user: userEvent.setup(), onClose, onDone }
}

describe('PackageImportDialog backend integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirementsApi.listDeliveryRequirements).mockResolvedValue([
      {
        requirement: {
          id: '50',
          customerName: 'Công ty ABC',
          destinationName: 'Kho Đà Nẵng',
          address: 'KCN Hoà Khánh, Đà Nẵng',
          status: 'PENDING',
          expectedPackageCount: 100,
          receivedPackageCount: 0,
        } as never,
        packages: [],
      },
    ])
  })

  it('displays row-level decimal scale errors (>2 decimals) and 1001-package batch limit errors with clear Vietnamese column names', async () => {
    vi.mocked(packageImportApi.previewCargoPackageImport).mockResolvedValueOnce({
      totalRows: 3,
      validCount: 1,
      errors: [
        {
          rowIndex: 3,
          field: 'lengthCm',
          errorCode: 'IMPORT_DECIMAL_SCALE_EXCEEDED',
          detail: "'2.225'",
          message: "Giá trị số chỉ được phép tối đa 2 chữ số sau dấu phẩy ('2.225')",
        },
        {
          rowIndex: 4,
          field: 'quantity',
          errorCode: 'BATCH_SIZE_LIMIT_EXCEEDED',
          detail: 'Tổng số kiện vật lý vượt quá 1000',
          message:
            'Số lượng bản ghi trong file vượt quá giới hạn tối đa cho phép (1000 dòng) (Tổng số kiện vật lý vượt quá 1000)',
        },
      ],
      warnings: [],
      validRows: [
        {
          rowIndex: 2,
          packageCode: 'PKG-DEC-01',
          packageName: 'Thùng linh kiện',
          lengthCm: 2.22,
          widthCm: 3.45,
          heightCm: 10.55,
          weightKg: 5.25,
          quantity: 2,
          handlingClass: 'STANDARD',
          destination: 'Đà Nẵng',
        },
      ],
    })

    const { user } = renderImportDialog()
    const file = new File(['dummy'], 'packages.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(screen.getByLabelText(/File kiện/i), file)

    // Verify clear row error logs with Vietnamese field names & error code
    expect(
      await screen.findByText(
        /Dòng 3, cột Chiều dài \(lengthCm\): Giá trị số chỉ được phép tối đa 2 chữ số sau dấu phẩy \('2\.225'\)/i,
      ),
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        /Dòng 4, cột Số lượng \(quantity\): Số lượng bản ghi trong file vượt quá giới hạn tối đa cho phép \(1000 dòng\) \(Tổng số kiện vật lý vượt quá 1000\)/i,
      ),
    ).toBeInTheDocument()

    // Verify validRows preview table renders decimal dimensions (up to 2 decimal places) fetched from Backend
    expect(screen.getByText('PKG-DEC-01')).toBeInTheDocument()
    expect(screen.getByText('2,22 × 3,45 × 10,55 cm')).toBeInTheDocument()
    expect(screen.getByText('5,25 kg')).toBeInTheDocument()
  })

  it('displays clear Backend error message when file has 1001 rows (BATCH_SIZE_LIMIT_EXCEEDED)', async () => {
    vi.mocked(packageImportApi.previewCargoPackageImport).mockRejectedValueOnce(
      new ApiError(
        400,
        'Số lượng bản ghi trong file vượt quá giới hạn tối đa cho phép (1000 dòng)',
        { code: 'BATCH_SIZE_LIMIT_EXCEEDED' },
      ),
    )

    const { user } = renderImportDialog()
    const file = new File(['dummy'], '1001-rows.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    await user.upload(screen.getByLabelText(/File kiện/i), file)

    await waitFor(() => {
      expect(
        screen.getByText('Số lượng bản ghi trong file vượt quá giới hạn tối đa cho phép (1000 dòng)'),
      ).toBeInTheDocument()
    })
  })
})
