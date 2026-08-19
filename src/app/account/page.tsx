"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { api } from "@/lib/api"
import { Button, Card, Input } from "@/components/ui"
import { Lock, Eye, EyeOff } from "lucide-react"

export default function AccountSettingsPage() {
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const t = useTranslations("settingsPage")
  const router = useRouter()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [loading, setLoading] = useState(false)

  const passwordInputClass =
    "w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (newPassword.length < 8) {
        toast.error(tAuth("newPasswordRequired"))
        setLoading(false)
        return
      }
      if (newPassword !== confirmPassword) {
        toast.error(tAuth("passwordsMismatch"))
        setLoading(false)
        return
      }

      const { error } = await api.post("/api/auth/change-password", {
        currentPassword,
        newPassword,
      })

      if (error) {
        if (error === "كلمة المرور الحالية غير صحيحة") toast.error(tAuth("incorrectCurrentPassword"))
        else toast.error(tAuth("passwordChangeFailed"))
        setLoading(false)
        return
      }

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      toast.success(tAuth("passwordChanged"))
      router.refresh()
    } catch {
      toast.error(tAuth("passwordChangeFailed"))
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <Card padding="lg">
        <div className="mb-6 flex items-center gap-3">
          <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t("changePassword")}</h2>
            <p className="text-sm text-gray-500">{t("changePasswordHint")}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth("currentPassword")}
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={passwordInputClass}
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="toggle"
              >
                {showCurrent ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth("newPassword")}
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={passwordInputClass}
                placeholder={tAuth("newPasswordPlaceholder")}
                required
                minLength={8}
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
                aria-label="toggle"
              >
                {showNew ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth("confirmPassword")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={passwordInputClass}
              placeholder="••••••••"
              required
            />
          </div>

          <Button fullWidth loading={loading} type="submit">
            {tAuth("changePassword")}
          </Button>
        </form>
      </Card>
    </div>
  )
}