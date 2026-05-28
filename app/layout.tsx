import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { Analytics } from "@vercel/analytics/next"
import { Suspense } from "react"
import { AuthProvider } from "@/contexts/auth-context"
import { Toaster } from "react-hot-toast"
import "./globals.css"

// Force all pages to be rendered dynamically (at request time) rather than
// statically pre-rendered at build time. This prevents Firebase from being
// initialised during `next build` when NEXT_PUBLIC_* env vars are not set.
export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Eddix Admin",
  description:
    "Comprehensive admin dashboard for managing Eddix Savings platform - monitor contributions, process withdrawals, manage users, and track financial metrics in real-time.",
  generator: "v0.app",
}


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <AuthProvider>
          <Toaster position="top-right" />
          <Suspense fallback={null}>{children}</Suspense>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
