import { nextPackageId } from '@/domain/cargo'
import type { CargoPackage } from '@/domain/models'
import type { TFunction } from '@/lib/i18n'
import { IMPORT_FIELDS, type ImportField } from './package-import-columns'

/**
 * File mẫu nhập kiện (LM-093): dòng tiêu đề theo ngôn ngữ đang chọn + hai dòng ví dụ dựng cho đúng chuyến đang mở — mã kiện kế tiếp
 * của chuyến, điểm giao có thật — nên nhập nguyên file mẫu cũng ra hai kiện hợp lệ. Cột cuối `handlingClass` (FE-3b-07) ghi mã loại hàng; hai dòng mẫu cùng một loại hàng vì một chuyến chỉ chở một loại (FE-4b-06) —
 * mẫu khác loại sẽ bật hộp hỏi lý do chở chung ngay khi nhập nguyên file mẫu. CSV dựng bằng Blob; `.xlsx` dựng bằng
 * `write-excel-file`, chỉ tải thư viện khi bấm tải mẫu.
 */

type TemplateValue = string | number

export function importTemplateRows(t: TFunction, existing: readonly CargoPackage[], stopCount: number): TemplateValue[][] {
  const firstId = nextPackageId(existing.map((pkg) => pkg.id))
  const secondId = nextPackageId([...existing.map((pkg) => pkg.id), firstId])
  const yes = t('trips.import.yes')
  const no = t('trips.import.no')
  const samples: Record<ImportField, TemplateValue>[] = [
    {
      id: firstId, name: t('trips.import.sample.first'), lengthCm: 50, widthCm: 35, heightCm: 25, weightKg: 13, quantity: 10,
      deliveryStop: 1, allowedOrientations: 'LWH|WLH', keepUpright: yes, fragilityLevel: 'NONE', stackable: yes, maxTopLoadKg: 60,
      maxStackCount: 5, minSupportRatio: 0.8, priority: 0, mustLoad: no, groupId: '', notes: '', handlingClass: 'STANDARD',
    },
    {
      id: secondId, name: t('trips.import.sample.second'), lengthCm: 70, widthCm: 45, heightCm: 15, weightKg: 25, quantity: 4,
      deliveryStop: Math.min(2, Math.max(1, stopCount)), allowedOrientations: 'LWH|LHW|WLH|WHL|HLW|HWL', keepUpright: no,
      fragilityLevel: 'LOW', stackable: yes, maxTopLoadKg: 150, maxStackCount: 6, minSupportRatio: 0.8, priority: 1, mustLoad: yes,
      groupId: '', notes: t('trips.import.sample.note'), handlingClass: 'STANDARD',
    },
  ]
  return [
    IMPORT_FIELDS.map((field) => t(`trips.import.columns.${field}`)),
    ...samples.map((sample) => IMPORT_FIELDS.map((field) => sample[field])),
  ]
}

/** CSV UTF-8 có BOM (Excel đọc đúng chữ có dấu), dấu phẩy, xuống dòng CRLF; ô có dấu phân cách hoặc ngoặc kép được bọc ngoặc kép. */
export function toCsv(rows: readonly (readonly TemplateValue[])[]): string {
  const cell = (value: TemplateValue) => {
    const text = String(value)
    const quoted = /[,;\r\n]/.test(text) || text.includes('"')
    return quoted ? `"${text.replaceAll('"', '""')}"` : text
  }
  return `﻿${rows.map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`
}

export function csvTemplateBlob(rows: readonly (readonly TemplateValue[])[]): Blob {
  return new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

/** `.xlsx`: dòng tiêu đề chữ đậm, số giữ kiểu số. Thư viện tải lười khi bấm (không vào chunk của màn). */
export async function xlsxTemplateBlob(rows: readonly (readonly TemplateValue[])[], sheet: string): Promise<Blob> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const [header = [], ...body] = rows
  const data = [header.map((value) => ({ value: String(value), fontWeight: 'bold' as const })), ...body.map((row) => [...row])]
  return writeXlsxFile(data, { sheet, columns: header.map(() => ({ width: 18 })) }).toBlob()
}
