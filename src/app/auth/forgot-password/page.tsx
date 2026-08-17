"use client"

import { useState } from "react"
import Link from "next/link"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { LanguageSwitcher } from "@/components/ui"
import { api } from "@/lib/api"
import { useLocale } from "next-intl"

export default function ForgotPasswordPage() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await api.post("/api/auth/forgot-password", {
        email,
        locale,
      })
      if (error) {
        toast.error(tAuth("forgotRequestFailed"))
        setLoading(false)
        return
      }
      setSent(true)
    } catch {
      toast.error(tAuth("forgotRequestFailed"))
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
          <p className="text-gray-500 mt-2">{tAuth("forgotPasswordTitle")}</p>
        </div>

        {sent ? (
          <div className="text-center py-6 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-700">{tAuth("forgotSent")}</p>
            <Link
              href="/auth/login"
              className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {tAuth("backToLogin")}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tCommon("email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={tAuth("emailPlaceholder")}
                required
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? tAuth("sending") : tAuth("forgotSubmit")}
            </button>

            <div className="text-center">
              <Link
                href="/auth/login"
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                {tAuth("backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}