/**
 * Monnify Service (Client-side)
 *
 * All calls are proxied through /api/monnify to avoid:
 * - Buffer.from() crash in browser
 * - CORS issues with direct calls to Monnify
 * - Exposing secret API keys as NEXT_PUBLIC_ env vars
 */

// Still exported so callers that import it don't break;
// the actual value is used server-side via the env var without NEXT_PUBLIC_ prefix.
export const MONNIFY_ACCOUNT_NUMBER =
  process.env.NEXT_PUBLIC_MONNIFY_WALLET_ACCOUNT_NUMBER || ""

async function callProxy(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch("/api/monnify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...params }),
  })

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(errorData.error || `API error: ${res.status}`)
  }

  return res.json()
}

export async function getBankList(): Promise<{ name: string; code: string }[]> {
  const data = await callProxy("getBankList") as { responseBody: { name: string; code: string }[] }
  if (!data.responseBody) throw new Error("Failed to get bank list")
  return data.responseBody
}

export async function getWalletBalance(): Promise<{ availableBalance: number; ledgerBalance: number }> {
  const data = await callProxy("getWalletBalance") as {
    requestSuccessful: boolean
    responseMessage: string
    responseBody: { availableBalance: number; ledgerBalance: number }
  }
  if (!data.requestSuccessful) throw new Error(`Failed to get wallet balance: ${data.responseMessage}`)
  return {
    availableBalance: data.responseBody.availableBalance,
    ledgerBalance: data.responseBody.ledgerBalance,
  }
}

export async function initiateSingleTransfer(transferRequest: {
  amount: number
  reference: string
  narration: string
  destinationBankCode: string
  destinationAccountNumber: string
  currency: string
  async?: boolean
}): Promise<{
  requestSuccessful: boolean
  responseMessage: string
  responseCode: string
  responseBody: {
    amount: number
    reference: string
    narration: string
    destinationAccountNumber: string
    destinationAccountName: string
    destinationBankCode: string
    destinationBankName: string
    status: string
    transactionReference: string
    dateCreated: string
  }
}> {
  const data = await callProxy("initiateSingleTransfer", { transferRequest })
  return data as ReturnType<typeof initiateSingleTransfer> extends Promise<infer T> ? T : never
}

export async function authorizeSingleTransfer(
  reference: string,
  authorizationCode: string
): Promise<{
  requestSuccessful: boolean
  responseMessage: string
  responseCode: string
  responseBody: { amount: number; reference: string; status: string; transactionReference: string }
}> {
  const data = await callProxy("authorizeSingleTransfer", { reference, authorizationCode })
  return data as ReturnType<typeof authorizeSingleTransfer> extends Promise<infer T> ? T : never
}

export async function resendOTP(reference: string): Promise<{
  requestSuccessful: boolean
  responseCode: string
  responseMessage: string
}> {
  const data = await callProxy("resendOTP", { reference })
  return data as ReturnType<typeof resendOTP> extends Promise<infer T> ? T : never
}

export async function getSingleTransferStatus(reference: string): Promise<{
  requestSuccessful: boolean
  responseMessage: string
  responseCode: string
  responseBody: {
    amount: number
    reference: string
    status: string
    transactionReference: string
    destinationAccountNumber: string
    destinationAccountName: string
    destinationBankCode: string
    destinationBankName: string
    dateCreated: string
  }
}> {
  const data = await callProxy("getSingleTransferStatus", { reference })
  return data as ReturnType<typeof getSingleTransferStatus> extends Promise<infer T> ? T : never
}

export function formatMonnifyError(error: unknown): string {
  if (error instanceof Error) return error.message
  return "An unknown error occurred"
}

export function isTransferFinal(status: string): boolean {
  return ["SUCCESS", "FAILED", "REVERSED"].includes(status.toUpperCase())
}

export function isTransferSuccessful(status: string): boolean {
  return status.toUpperCase() === "SUCCESS"
}

// Kept for compatibility — Monnify auth is now handled server-side
export async function authenticateMonnify(): Promise<string> {
  return "server-side-only"
}
