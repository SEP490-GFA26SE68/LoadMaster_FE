
import { useEffect, useState } from 'react'
import { apiFetchBlob } from '@/lib/api-client'
import { QrCode } from '@/components/QrCode'

type PackageQrImageProps = {
  packageId: string | number
  token: string
  size?: number
  className?: string
}

/**
 * Hiển thị ảnh QR kiện hàng do Backend tạo.
 * Nếu API chưa tải được, hiển thị QR SVG từ token BE trả về.
 */
export function PackageQrImage({
  packageId,
  token,
  size = 160,
  className,
}: PackageQrImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl: string | null = null

    setImageUrl(null)

    async function loadQr() {
      try {
        const blob = await apiFetchBlob(
          `/api/packages/${encodeURIComponent(packageId)}/qr`,
          {
            headers: {
              Accept: 'image/png',
            },
          },
        )

        if (cancelled) return

        objectUrl = URL.createObjectURL(blob)
        setImageUrl(objectUrl)
      } catch {
        if (!cancelled) {
          setImageUrl(null)
        }
      }
    }

    void loadQr()

    return () => {
      cancelled = true

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [packageId])

  if (!imageUrl) {
    return (
      <QrCode
        token={token}
        size={size}
        className={className}
      />
    )
  }

  return (
    <img
      src={imageUrl}
      alt={`QR ${token}`}
      width={size}
      height={size}
      className={className}
    />
  )
}
