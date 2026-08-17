"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { LanguageSwitcher } from "@/components/ui"
import { api } from "@/lib/api"

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}

function ResetPasswordForm() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams?.get("token") || ""
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      if (password.length < 8) {
        toast.error(tAuth("newPasswordRequired"))
        setLoading(false)
        return
      }
      if (password !== confirmPassword) {
        toast.error(tAuth("passwordsMismatch"))
        setLoading(false)
        return
      }

      const { error } = await api.post("/api/auth/reset-password", { token, password })

      if (error) {
        if (error === "PasswordTooShort") toast.error(tAuth("newPasswordRequired"))
        else if (error === "SameAsCurrent") toast.error(tAuth("sameAsCurrent"))
        else toast.error(tAuth("resetLinkInvalid"))
        setLoading(false)
        return
      }

      setDone(true)
      toast.success(tAuth("passwordChanged"))
      setTimeout(() => router.replace("/auth/login"), 1500)
    } catch {
      toast.error(tAuth("resetFailed"))
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mt-4 text-gray-700">{tAuth("resetSuccess")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-md justify-end">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{tApp("name")}</h1>
          <p className="text-gray-500 mt-2">{tAuth("resetPasswordTitle")}</p>
        </div>

        {!token ? (
          <p className="text-center text-red-600 text-sm">{tAuth("resetLinkInvalid")}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAuth("newPassword")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? tAuth("sending") : tAuth("changePassword")}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}