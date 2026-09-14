import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Vonage SMS Delivery Receipt (DLR) webhook — DISABLED.
 * Vonage معطل (المزود المعتمد الوحيد Wasender)، هذا المسار يُبقي
 * استقبال أي callbacks قديمة متأخرة دون كسر، ولا يُستخدم في الإرسال.
 */
async function handleDlr(req: Request) {
  const url = new URL(req.url)
  const params: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    params[k] = v
  })

  if (req.method === "POST") {
    const contentType = req.headers.get("content-type") || ""
    try {
      if (contentType.includes("application/json")) {
        Object.assign(params, await req.json())
      } else {
        const form = await req.formData()
        form.forEach((v, k) => {
          params[k] = String(v)
        })
      }
    } catch {
      // ignore malformed bodies — still acknowledge
    }
  }

  const { messageId, msisdn, status, ["err-code"]: errCode, price, ["network-code"]: network } = params
  console.log(
    `[vonage-dlr] to=${msisdn || "?"} status=${status || "?"} err=${errCode || "0"} ` +
      `network=${network || "?"} price=${price || "?"} id=${messageId || "?"}`
  )

  return NextResponse.json({ ok: true })
}

export async function GET(req: Request) {
  return handleDlr(req)
}

export async function POST(req: Request) {
  return handleDlr(req)
}
