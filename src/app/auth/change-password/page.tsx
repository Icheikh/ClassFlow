"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { roleRoutes } from "@/lib/roles"
import { LanguageSwitcher } from "@/components/ui"
import { api } from "@/lib/api"

export default function ChangePasswordPage() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

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

      const { error } = await api.post("/api/auth/change-password", { newPassword })

      if (error) {
        toast.error(tAuth("passwordChangeFailed"))
        setLoading(false)
        return
      }

      toast.success(tAuth("passwordChanged"))
      const res = await fetch("/api/auth/session", { cache: "no-store" })
      const session = await res.json()
      const role = session?.user?.role || "TEACHER"
      const route = roleRoutes[role] || "/teacher"
      router.replace(route)
      router.refresh()
    } catch {
      toast.error(tAuth("passwordChangeFailed"))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-md justify-end">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tApp("name")}</h1>
          <p className="text-gray-500 mt-2">{tAuth("changePasswordTitle")}</p>
          <p className="text-gray-400 text-sm mt-1">
            <span className="inline-block bg-amber-50 text-amber-700 text-xs px-3 py-1 rounded-full mt-3">
              {tAuth("mustChangePassword")}
            </span>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth("newPassword")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={tAuth("newPasswordPlaceholder")}
              required
              minLength={8}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tAuth("confirmPassword")}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {loading ? tAuth("redirecting") : tAuth("changePassword")}
          </button>
        </form>
      </div>
    </div>
  )
}