"use client"

import { useState } from "react"
import { getSession, signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import toast from "react-hot-toast"
import { roleRoutes } from "@/lib/roles"
import { LanguageSwitcher } from "@/components/ui"

export default function LoginPage() {
  const tApp = useTranslations("app")
  const tAuth = useTranslations("auth")
  const tCommon = useTranslations("common")
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (!result || result.error) {
        toast.error(tAuth("invalidCredentials"))
        return
      }

      const session = await getSession()

      if (session?.user?.mustChangePassword) {
        router.replace("/auth/change-password")
        router.refresh()
        return
      }

      const role = session?.user?.role || "TEACHER"
      const route = roleRoutes[role] || "/teacher"

      router.replace(route)
      router.refresh()
    } catch {
      toast.error(tAuth("loginError"))
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
          <p className="text-gray-500 mt-2">{tApp("tagline")}</p>
        </div>

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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {tCommon("password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? tAuth("loggingIn") : tCommon("login")}
          </button>

          <div className="text-center pt-1">
            <Link
              href="/auth/forgot-password"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {tAuth("forgotPassword")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
