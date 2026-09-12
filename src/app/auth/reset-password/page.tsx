"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { LanguageSwitcher } from "@/components/ui"

/**
 * Legacy email-token reset links are retired (phone-based identity).
 * This page now points users to the phone recovery flow.
 */
export default function ResetPasswordPage() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto mb-6 flex w-full max-w-md justify-end">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">{tApp("name")}</h1>
        <p className="text-gray-600 text-sm">{tAuth("resetLinkRetired")}</p>
        <Link
          href="/auth/forgot-password"
          className="inline-block py-2.5 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          {tAuth("forgotPasswordTitle")}
        </Link>
        <div>
          <Link
            href="/auth/login"
            className="text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {tAuth("backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  )
}
