"use client"

import { useState } from "react"
import Link from "next/link"
import { signIn, getSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import toast from "react-hot-toast"
import { roleRoutes } from "@/lib/roles"
import { LanguageSwitcher } from "@/components/ui"
import { api } from "@/lib/api"

type Step = "phone" | "code" | "password" | "done"

/**
 * First-time activation (one page):
 * phone → OTP (WhatsApp/SMS) → verify (shows stored name) → new password → active.
 */
export default function ActivatePage() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const locale = useLocale()
  const router = useRouter()

  const [step, setStep] = useState<Step>("phone")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [accountName, setAccountName] = useState<string | null>(null)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault()
    if (!phone.trim()) return
    setLoading(true)
    try {
      const { data, error } = await api.post("/api/auth/request-otp", {
        phone: phone.trim(),
        purpose: "ACTIVATION",
        locale,
      })
      if (error) {
        toast.error(tAuth("otpRequestFailed"))
        return
      }
      // Dev/test convenience: provider not configured → code returned directly.
      const devCode = (data as { devCode?: string } | null)?.devCode
      if (devCode) setCode(devCode)
      setStep("code")
      toast.success(tAuth("otpSent"))
    } catch {
      toast.error(tAuth("otpRequestFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await api.post("/api/auth/verify-otp", {
        phone: phone.trim(),
        code: code.trim(),
        purpose: "ACTIVATION",
      })
      if (error) {
        toast.error(mapOtpError(error, tAuth))
        return
      }
      setAccountName((data as { name?: string | null } | null)?.name || null)
      setStep("password")
    } catch {
      toast.error(tAuth("otpVerifyFailed"))
    } finally {
      setLoading(false)
    }
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error(tAuth("newPasswordRequired"))
      return
    }
    if (password !== confirmPassword) {
      toast.error(tAuth("passwordsMismatch"))
      return
    }
    setLoading(true)
    try {
      const { error } = await api.post("/api/auth/activate", {
        phone: phone.trim(),
        code: code.trim(),
        password,
      })
      if (error) {
        toast.error(mapOtpError(error, tAuth))
        if (error === "EXPIRED_OR_NOT_FOUND") setStep("phone")
        return
      }
      // Auto login with the new password.
      const result = await signIn("credentials", {
        phone: phone.trim(),
        password,
        redirect: false,
      })
      if (result?.error) {
        router.replace("/auth/login")
        return
      }
      const session = await getSession()
      const role = session?.user?.role || "TEACHER"
      toast.success(tAuth("accountActivated"))
      setStep("done")
      router.replace(roleRoutes[role] || "/teacher")
      router.refresh()
    } catch {
      toast.error(tAuth("activationFailed"))
    } finally {
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
          <p className="text-gray-500 mt-2">{tAuth("activateTitle")}</p>
        </div>

        {step === "phone" && (
          <form onSubmit={requestCode} className="space-y-4">
            <p className="text-sm text-gray-500">{tAuth("activateHint")}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tCommon("phone")}
              </label>
              <input
                type="tel"
                inputMode="tel"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-left"
                placeholder={tAuth("phonePlaceholder")}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? tAuth("sending") : tAuth("sendCode")}
            </button>
            <BackToLogin />
          </form>
        )}

        {step === "code" && (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-gray-500">{tAuth("otpHint")}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tAuth("otpCode")}
              </label>
              <input
                type="text"
                inputMode="numeric"
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-xl tracking-widest"
                placeholder="••••••"
                required
                autoFocus
                maxLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
            >
              {loading ? tAuth("sending") : tAuth("verifyCode")}
            </button>
            <button
              type="button"
              onClick={() => requestCode()}
              disabled={loading}
              className="w-full text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {tAuth("resendCode")}
            </button>
          </form>
        )}

        {step === "password" && (
          <form onSubmit={activate} className="space-y-4">
            {accountName && (
              <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                {tAuth("welcomeName", { name: accountName })}
              </div>
            )}
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
                autoFocus
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
              {loading ? tAuth("sending") : tAuth("activateSubmit")}
            </button>
          </form>
        )}

        {step === "done" && (
          <p className="text-center text-gray-700">{tAuth("accountActivated")}</p>
        )}
      </div>
    </div>
  )
}

function BackToLogin() {
  const tAuth = useTranslations("auth")
  return (
    <div className="text-center">
      <Link href="/auth/login" className="text-sm font-medium text-blue-600 hover:text-blue-700">
        {tAuth("backToLogin")}
      </Link>
    </div>
  )
}

function mapOtpError(error: string, tAuth: (key: string) => string): string {
  if (error === "INVALID_CODE") return tAuth("otpInvalid")
  if (error === "EXPIRED_OR_NOT_FOUND") return tAuth("otpExpired")
  if (error === "TOO_MANY_ATTEMPTS") return tAuth("otpTooMany")
  if (error === "NO_INVITED_ACCOUNT") return tAuth("noInvitedAccount")
  if (error === "PasswordTooShort") return tAuth("newPasswordRequired")
  return tAuth("otpVerifyFailed")
}
