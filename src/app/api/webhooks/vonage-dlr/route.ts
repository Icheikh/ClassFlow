import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

/**
 * Vonage SMS Delivery Receipt (DLR) webhook.
 * Vonage calls this when the carrier reports delivered/failed/expired/etc.
 * Configure per-message via VONAGE_DLR_CALLBACK (must be a PUBLIC https URL —
 * Vonage cannot reach localhost), or set it once in the Vonage dashboard.
 *
 * Docs: https://developer.vonage.com/en/messaging/sms/guides/delivery-receipts
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
