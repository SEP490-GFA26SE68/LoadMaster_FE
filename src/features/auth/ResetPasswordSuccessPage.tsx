import { useNavigate } from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'

export function ResetPasswordSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 text-center shadow-lg">

        <div className="flex flex-col items-center gap-4">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              Đổi mật khẩu thành công
            </h1>

            <p className="mt-2 text-body text-text-2">
              Bạn có thể sử dụng mật khẩu mới
              để đăng nhập vào LoadMaster.
            </p>
          </div>

          <Button
            variant="primary"
            block
            onClick={() =>
              navigate('/dang-nhap')
            }
          >
            Quay lại đăng nhập
          </Button>
        </div>
      </div>
    </div>
  )
}