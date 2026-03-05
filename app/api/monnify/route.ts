/**
 * Monnify API Proxy Route
 *
 * All Monnify API calls MUST go through this server-side route because:
 * 1. `Buffer.from()` (used for Basic Auth) is Node.js-only and crashes in the browser
 * 2. Monnify sandbox blocks direct browser requests (CORS)
 * 3. API keys must remain server-side (not exposed as NEXT_PUBLIC_*)
 *
 * Client calls: POST /api/monnify  { action: "...", ...params }
 */

import { NextRequest, NextResponse } from "next/server"

// These are server-only env vars (no NEXT_PUBLIC_ prefix)
const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY || process.env.NEXT_PUBLIC_MONNIFY_API_KEY || ""
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY || process.env.NEXT_PUBLIC_MONNIFY_SECRET_KEY || ""
const MONNIFY_ACCOUNT_NUMBER =
  process.env.MONNIFY_WALLET_ACCOUNT_NUMBER ||
  process.env.NEXT_PUBLIC_MONNIFY_WALLET_ACCOUNT_NUMBER ||
  ""
const MONNIFY_BASE_URL =
  process.env.MONNIFY_BASE_URL ||
  process.env.NEXT_PUBLIC_MONNIFY_BASE_URL ||
  "https://sandbox.monnify.com"

let cachedToken: string | null = null
let tokenExpiry: number | null = null

async function getToken(): Promise<string> {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken
  }

  const credentials = Buffer.from(`${MONNIFY_API_KEY}:${MONNIFY_SECRET_KEY}`).toString("base64")
  const res = await fetch(`${MONNIFY_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Monnify auth failed: ${res.status} - ${text}`)
  }

  const data = await res.json()
  if (!data.requestSuccessful) {
    throw new Error(`Monnify auth failed: ${data.responseMessage}`)
  }

  cachedToken = data.responseBody.accessToken
  tokenExpiry = Date.now() + 55 * 60 * 1000 // 55 minutes
  return cachedToken!
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ...params } = body

    if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY) {
      return NextResponse.json(
        { error: "Monnify API credentials are not configured on this server." },
        { status: 500 }
      )
    }

    const token = await getToken()

    let result: unknown

    switch (action) {
      case "getWalletBalance": {
        if (!MONNIFY_ACCOUNT_NUMBER) {
          return NextResponse.json(
            { error: "MONNIFY_WALLET_ACCOUNT_NUMBER is not configured on this server." },
            { status: 500 }
          )
        }
        const res = await fetch(
          `${MONNIFY_BASE_URL}/api/v2/disbursements/wallet-balance?accountNumber=${MONNIFY_ACCOUNT_NUMBER}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          }
        )
        result = await res.json()
        break
      }

      case "initiateSingleTransfer": {
        const res = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(params.transferRequest),
        })
        result = await res.json()
        break
      }

      case "authorizeSingleTransfer": {
        const res = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single/validate-otp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ reference: params.reference, authorizationCode: params.authorizationCode }),
        })
        result = await res.json()
        break
      }

      case "resendOTP": {
        const res = await fetch(`${MONNIFY_BASE_URL}/api/v2/disbursements/single/resend-otp`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ reference: params.reference }),
        })
        result = await res.json()
        break
      }

      case "getSingleTransferStatus": {
        const res = await fetch(
          `${MONNIFY_BASE_URL}/api/v2/disbursements/single/summary?reference=${params.reference}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          }
        )
        result = await res.json()
        break
      }

      case "getBankList": {
        const res = await fetch(`${MONNIFY_BASE_URL}/api/v1/banks`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        })
        result = await res.json()
        break
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[Monnify proxy error]", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
