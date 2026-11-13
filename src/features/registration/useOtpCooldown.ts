import { useEffect, useState } from 'react'

/** Số giây phải chờ trước khi gửi lại mã OTP: `start()` đặt lại 60 giây, đếm lùi mỗi giây. */
export function useOtpCooldown(seconds = 60) {
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  return { cooldown, start: () => setCooldown(seconds) }
}
